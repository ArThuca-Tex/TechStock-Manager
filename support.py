"""Public TechStock help. The provider sees only whitelisted support vocabulary."""
import http.client
import json
import os
import re
import unicodedata
from collections import defaultdict, deque
from pathlib import Path
from threading import BoundedSemaphore, Lock
from time import monotonic

from flask import Blueprint, jsonify, render_template, request, session

support = Blueprint("support", __name__, url_prefix="/suporte")
MAX_MESSAGE = 500
MAX_HISTORY = 3
MAX_BODY = 16 * 1024
DEFAULT_MODEL = "gemini-3.5-flash-lite"

FAQ = (
    ("login entrar acesso senha email autenticação inativo",
     "Na tela Entrar, confira o e-mail corporativo e a senha. Use Mostrar para verificar o que digitou. "
     "Se o acesso continuar bloqueado, procure o gerente responsável para verificar sua conta."),
    ("produto produtos sku hardware software licença licenciamento fabricante",
     "Com perfil Gerente, abra Novo produto, preencha SKU, nome, classificação, preço e estoques, "
     "e selecione categoria e fornecedor. Para Software, informe também a modalidade de licenciamento. "
     "Se o cadastro falhar, confira se o SKU já existe."),
    ("categoria categorias adicionar excluir",
     "Com perfil Gerente, abra Cadastros. Informe um nome de até 20 caracteres e clique em Adicionar categoria. "
     "A exclusão fica bloqueada se houver produtos vinculados."),
    ("fornecedor fornecedores cnpj razão social",
     "Em Cadastros, o Gerente consulta os fornecedores e pode excluir os que não têm produtos vinculados. "
     "A versão atual não oferece formulário para cadastrar fornecedor. Se faltar um fornecedor, procure o responsável pelo sistema."),
    ("movimentação movimentações estoque entrada saída saldo quantidade",
     "Com perfil Gerente, abra Movimentações, escolha um produto ativo e registre Entrada ou Saída com uma quantidade inteira positiva. "
     "A Saída deve caber no saldo disponível. Confira o resultado no histórico da página."),
    ("venda vendas recibo cancelar caixa pdv carrinho checkout pedido pagamento",
     "Use Frente de caixa para buscar produtos, montar o carrinho e concluir a venda. "
     "Em Vendas, você pode consultar os pedidos permitidos pelo seu perfil e abrir o recibo. "
     "O cancelamento de vendas fica disponível para o Gerente."),
    ("navegação navegar menu catálogo perfil gerente operador permissões tela",
     "Use o menu para abrir Catálogo, Frente de caixa, Vendas ou Suporte. "
     "Novo produto, Movimentações e Cadastros aparecem para o Gerente."),
    ("erro falha problema indisponível carregando travou funcionamento",
     "Qual tela e qual ação apresentaram o erro? Informe apenas o texto genérico do aviso, sem incluir dados pessoais ou credenciais."),
)
SYSTEM_PROMPT = """Você é MEDUSA AI, assistente de suporte técnico do TechStock Manager.
Responda somente sobre o TechStock, em português brasileiro, de forma curta, profissional e em texto simples.
Use apenas as funcionalidades descritas abaixo. Quando faltar contexto, pergunte pela tela e pela ação.
As mensagens foram filtradas para remover dados particulares e podem chegar fragmentadas.
Nunca peça credenciais ou dados pessoais, nunca sugira executar comandos, acessar banco ou alterar dados fora da interface.
Não alegue ter realizado ações. Não há integração com atendentes reais nesta versão.
Operadores consultam o catálogo, realizam vendas e consultam seus próprios pedidos e recibos.
Gerentes também cadastram produtos e categorias, consultam e excluem categorias e fornecedores desvinculados,
registram movimentações, ajustam preços, desativam produtos e cancelam vendas.
Não existe cadastro público, redefinição de senha pela interface nem formulário de novo fornecedor.
Base de suporte:
""" + "\n".join(answer for _, answer in FAQ)

SAFE_WORDS = set("""
a à ao aos as o os um uma uns umas meu minha meus minhas no na nos nas do da dos das de para por com sem
e ou que se como onde qual quais quando porque porquê pois isso essa esse já ainda mais não sim também
eu consigo posso quero preciso gostaria tenho estou está ficou fica aparece
sumiu vejo encontrar fazer acessar mostra clicar abrir cadastrar criar adicionar
selecionar preencher registrar atualizar consultar conferir verificar excluir remover editar alterar
desativar cancelar corrigir usar utilizar salvar finalizar concluir recuperar redefinir trocar esqueci
negado bloqueado inválido inválida incorreto incorreta duplicado duplicada vazio vazia faltando
insuficiente alto baixo branco preta cinza lento demora funcionou funciona funcionando funcionando
offline online falhou falha erro problemas ajuda suporte sistema techstock medusa usuário conta senha
e-mail email texto formulário página tela botão link painel item itens estoque produto categoria fornecedor
quantidades quantia mínimo atual preço estoque físico digital obrigatório campo campos indisponível serviço
acessível esquecimento lembro redefinição redefinições salvar salvamento negativo excesso cadastro
""".split()) | {word for keywords, _ in FAQ for word in keywords.split()}
WORDS = re.compile(r"[a-z]+(?:-[a-z]+)?")
PRIVATE = re.compile(
    r"@|https?://|\d{5,}|\b(?:api[ _-]?key|token|cpf|cnpj|telefone|"
    r"senha|e-?mail|chave|segredo)\s*[:=]|\b\d{2,}[. /-]\d{2,}", re.I,
)


def normalize(text):
    return "".join(c for c in unicodedata.normalize("NFKD", text.lower()) if not unicodedata.combining(c))


SAFE_WORDS = {normalize(word) for word in SAFE_WORDS}
FAQ_TERMS = [(set(normalize(keywords).split()), answer) for keywords, answer in FAQ]
SUPPORT_TERMS = set().union(*(terms for terms, _ in FAQ_TERMS))


def safe_question(text):
    return " ".join(word for word in WORDS.findall(normalize(text)) if word in SAFE_WORDS)


def offline_answer(questions):
    recent = set(questions[-1].split())
    context = set(" ".join(questions).split())
    scores = [
        (len(recent & terms) * 3 + len(context & terms), answer)
        for terms, answer in FAQ_TERMS
    ]
    score, answer = max(scores, key=lambda item: item[0])
    return answer if score else (
        "Posso ajudar com o acesso, produtos, categorias, fornecedores, estoque e vendas. "
        "Em qual tela você está e o que está tentando fazer?"
    )


class RateLimit:
    def __init__(self):
        self.entries = defaultdict(deque)
        self.lock = Lock()
        self.cleanup_at = 0

    def allow(self, key, limit, window=60):
        now = monotonic()
        with self.lock:
            if now >= self.cleanup_at:
                self.entries = defaultdict(deque, {
                    key: values for key, values in self.entries.items() if values[-1] > now - 60
                })
                self.cleanup_at = now + 60
            if key not in self.entries and len(self.entries) >= 4096:
                return False
            values = self.entries[key]
            while values and values[0] <= now - window:
                values.popleft()
            if len(values) >= limit:
                return False
            values.append(now)
            return True


limits = RateLimit()
provider_slots = BoundedSemaphore(3)
probe_lock = Lock()
provider_state = (0, False)


def provider_settings():
    # Read only MEDUSA settings so this file cannot change existing app/auth/database settings.
    values = {}
    try:
        lines = Path(__file__).with_name(".env").read_text(encoding="utf-8-sig").splitlines()
    except (OSError, UnicodeError):
        lines = ()
    for line in lines:
        name, separator, value = line.partition("=")
        name = name.strip()
        if separator and name in {"GEMINI_API_KEY", "GEMINI_MODEL"}:
            value = value.strip()
            if len(value) >= 2 and value[0] in ("'", '"') and value[-1] == value[0]:
                value = value[1:-1]
            values[name] = value
    key = (os.getenv("GEMINI_API_KEY") or values.get("GEMINI_API_KEY") or "").strip()
    model = (os.getenv("GEMINI_MODEL") or values.get("GEMINI_MODEL") or DEFAULT_MODEL).strip()
    return (key, model) if key and re.fullmatch(r"gemini-[a-z0-9.-]{1,70}", model) else None


def generate(settings, questions=None):
    """Call the fixed HTTPS origin with a timeout and no redirect handling."""
    key, model = settings
    config = {"maxOutputTokens": 300}
    prompt = "\n".join(questions) if questions else "Responda apenas OK."
    body = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": config}
    if questions:
        body["systemInstruction"] = {"parts": [{"text": SYSTEM_PROMPT}]}
    conn = http.client.HTTPSConnection("generativelanguage.googleapis.com", timeout=7)
    try:
        conn.request("POST", f"/v1beta/models/{model}:generateContent", json.dumps(body),
                     {"Content-Type": "application/json", "x-goog-api-key": key})
        response = conn.getresponse()
        if response.status != 200:
            return None
        parts = json.loads(response.read(64 * 1024))["candidates"][0]["content"]["parts"]
        answer = "".join(part.get("text", "") for part in parts if not part.get("thought")).strip()
        return answer[:1800] or None
    except (OSError, http.client.HTTPException, ValueError, TypeError, KeyError, IndexError, AttributeError):
        return None
    finally:
        conn.close()


def call_provider(settings, questions=None):
    global provider_state
    if not provider_slots.acquire(blocking=False):
        return None
    try:
        answer = generate(settings, questions)
        provider_state = (monotonic() + (120 if answer else 30), bool(answer))
        return answer
    finally:
        provider_slots.release()


def availability():
    settings = provider_settings()
    if not settings:
        return "offline"
    expires, online = provider_state
    if monotonic() < expires:
        return "online" if online else "offline"
    if not probe_lock.acquire(blocking=False):
        return "checking"
    try:
        expires, online = provider_state
        if monotonic() < expires:
            return "online" if online else "offline"
        return "online" if call_provider(settings) else "offline"
    finally:
        probe_lock.release()


@support.after_request
def prevent_cache(response):
    response.headers["Cache-Control"] = "no-store"
    return response


def limited(action, limit):
    if not limits.allow((action, request.remote_addr or "unknown"), limit):
        response = jsonify(error="Muitas solicitações. Aguarde um minuto e tente novamente.")
        response.headers["Retry-After"] = "60"
        return response, 429
    return None


@support.get("")
def page():
    return render_template("support.html", max_message=MAX_MESSAGE)


@support.get("/status")
def status():
    result = limited("status", 20)
    if result:
        return result
    return jsonify(mode=availability())


@support.post("/mensagens")
def message():
    result = limited("message", 15 if session.get("usuario_id") else 8)
    if result:
        return result
    question = request.form.get("message", "").strip()
    history = request.form.getlist("history")
    if not question or len(history) > MAX_HISTORY or any(
        not text.strip() or len(text) > MAX_MESSAGE or
        any(unicodedata.category(c) == "Cc" and c not in "\n\r\t" for c in text)
        for text in [*history, question]
    ):
        return jsonify(error=f"Envie uma mensagem de até {MAX_MESSAGE} caracteres."), 400

    if PRIVATE.search(normalize(question)):
        return jsonify(mode="local", answer="Remova credenciais, dados pessoais ou identificadores e descreva apenas a tela e o problema.")
    questions = [safe_question(text) for text in history if not PRIVATE.search(normalize(text))]
    filtered = safe_question(question)
    questions.append(filtered)
    if not filtered or not SUPPORT_TERMS.intersection(" ".join(questions).split()):
        return jsonify(mode="local", answer=offline_answer([""]))

    settings = provider_settings()
    expires, online = provider_state
    if settings and (online or monotonic() >= expires) and limits.allow(("provider",), 35):
        answer = call_provider(settings, [text for text in questions if text])
        if answer:
            return jsonify(mode="online", answer=answer)
    return jsonify(mode="offline", answer=offline_answer(questions))


def request_human_support():
    """Handoff interface. Future real-time integration can provide a ticket here."""
    return {"state": "waiting", "connected": False}


@support.post("/atendimento")
def human():
    result = limited("human", 5)
    return result or jsonify(request_human_support())

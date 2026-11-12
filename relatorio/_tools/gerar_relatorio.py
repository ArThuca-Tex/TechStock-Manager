"""Gera o relatório técnico em HTML, Markdown e Word a partir do mesmo conteúdo."""
from pathlib import Path
from html import escape
import json
import struct
from io import BytesIO
from zipfile import ZipFile
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[1]
AUTHORS = ['Arthur', 'Dimitri Santos', 'Enzo Frugeri', 'Maria Julia', 'Matheus Ribeiro', 'Vitor Ribeiro']
def p(text): return {'type':'p','text':text}
def image(name,caption): return {'type':'image','file':name,'caption':caption}
def table(headers,rows): return {'type':'table','headers':headers,'rows':rows}
def bullets(items): return {'type':'bullets','items':items}
def code(text): return {'type':'code','text':text}
PAGES = [
{'title':'1. Apresentação e objetivos', 'blocks':[
p('Este relatório apresenta a evolução do TechStock Manager, desenvolvido para a demanda #2026-INV05 da TechStore Informática & Serviços Corporativos. O projeto amplia o inventário da etapa anterior com autenticação, controle de acesso por perfil, frente de caixa, processamento transacional de vendas e emissão de recibos.'),
p('O cenário proposto envolve a venda conjunta de componentes físicos e licenças digitais. A solução reúne esses itens em um único pedido, calcula os valores e mantém o vínculo entre a transação comercial, a baixa de estoque e o operador responsável.'),
bullets(['Evitar vendas parciais: pedido, itens, estoque e auditoria devem ser confirmados ou revertidos em conjunto.', 'Separar as permissões de Operador e Gerente, protegendo alterações de catálogo e cancelamentos.', 'Preservar os dados históricos da venda e oferecer um comprovante organizado para consulta e impressão.']),
table(['Tecnologia','Aplicação no projeto'],[['Python e Flask','Rotas, sessões, validações e regras de negócio.'],['Jinja, HTML e CSS','Telas, mensagens e versão de impressão.'],['JavaScript','Busca, carrinho e cálculo dinâmico dos subtotais.'],['SQLite','Banco local utilizado e validado nesta entrega.'],['SQL Server / pyodbc','Backend opcional e scripts de estrutura e migração.'],['unittest','Testes isolados e integração com banco temporário.']]),
p('A execução local utiliza SQLite para dispensar a instalação de SQL Express e driver ODBC. Os arquivos para SQL Server foram mantidos, mas esse backend não foi validado contra um servidor real neste ambiente. As capturas deste relatório usam dados fictícios em um banco isolado, sem alterar os registros do usuário.')
]},
{'title':'2. Arquitetura e modelagem relacional', 'blocks':[
p('A aplicação segue uma organização simples: o navegador apresenta as telas; as rotas Flask aplicam as permissões e regras; db.py seleciona a conexão; e o banco mantém o catálogo, as vendas e o histórico. A camada SQLite adapta os recursos de SQL Server usados nas consultas, incluindo o retorno do identificador da venda e a abertura da transação.'),
image('modelo-relacional.png','Figura 1 — Modelo relacional simplificado, elaborado a partir dos esquemas e das consultas do projeto.'),
table(['Entidade adicionada','Informações principais'],[['Usuarios','Nome, e-mail único, hash da senha, perfil e status.'],['Vendas','Pedido único, cliente, pagamento, total, status e operador.'],['Itens_Venda','Venda, produto, quantidade, preço praticado e subtotal.']]),
p('As tabelas Categorias, Fornecedores, Produtos e Movimentacoes foram preservadas. As movimentações receberam vínculos opcionais de usuário e venda, permitindo identificar a origem das saídas de checkout e das entradas de estorno. Chaves estrangeiras e restrições CHECK protegem os vínculos e os valores positivos.'),
p('Nome, classificação e preço do produto são copiados para o item no momento da venda. Assim, alterações posteriores no catálogo não reescrevem o conteúdo do recibo histórico. Os scripts de criação, migração e demonstração acompanham o código-fonte.')
]},
{'title':'3. Autenticação e controle de acesso', 'blocks':[
p('O acesso é realizado por e-mail e senha, com verificação de hash pelo Werkzeug. A sessão é persistente por até oito horas e os formulários POST exigem token CSRF. O perfil e o status do usuário são consultados no servidor a cada requisição, de modo que a proteção não depende apenas dos botões exibidos na interface.'),
image('01-login.png','Figura 2 — Tela de autenticação com identificação visual do TechStock e opção de mostrar ou ocultar a senha.'),
table(['Perfil','Permissões implementadas'],[['Operador','Consultar catálogo, montar carrinho, registrar vendas e consultar/imprimir seus recibos.'],['Gerente','Operações do operador, cadastros, alteração de preços, movimentações manuais, todos os pedidos, indicadores financeiros e cancelamento.']]),
p('Foram disponibilizadas as contas operador@techstore.com e gerente@techstore.com para a demonstração. Usuários inativos são impedidos de operar e o logout encerra a sessão. As senhas iniciais e as instruções de acesso estão no README; devem ser alteradas antes de uma disponibilização fora do contexto de demonstração.')
]},
{'title':'4. Catálogo e acompanhamento do estoque', 'blocks':[
p('O catálogo consolida produtos, categorias e fornecedores, exibindo SKU, fabricante, classificação, preço, saldo, estoque mínimo e localização ou modalidade de licenciamento. Os indicadores resumem a quantidade de produtos ativos, as unidades disponíveis e os itens que precisam de reposição.'),
image('02-catalogo.png','Figura 3 — Inventário no perfil Gerente, com indicadores de estoque e controles de preço.'),
p('A busca filtra os registros apresentados por nome, SKU ou outros textos visíveis. Itens com saldo no mínimo ou abaixo dele recebem destaque. O gerente pode ajustar preços; essa mudança vale para compras futuras, preservando os valores praticados nos pedidos já registrados.'),
p('A navegação utiliza a mesma identidade visual em todas as telas: tons de verde, superfícies claras, cartões, mensagens de retorno e indicação da página ativa. Os componentes possuem adaptações para telas menores; a avaliação visual final em celular permanece uma conferência manual recomendada.')
]},
{'title':'5. Cadastros e validação de produtos', 'blocks':[
p('O formulário de produto reúne identificação, classificação, especificação, preço, estoque inicial e mínimo, localização, categoria e fornecedor. A modalidade de licenciamento é exigida para software. O servidor verifica os campos numéricos e aplica os limites dos textos antes da gravação.'),
image('11-novo-produto.png','Figura 4 — Cadastro de produto com seleção de categoria e fornecedor.'),
p('A área Cadastros permite criar categorias e consultar categorias e fornecedores, com tratamento de vínculos nas exclusões. Referências usadas por produtos são protegidas por integridade referencial. Não há uma tela pública de criação de usuários; as contas de demonstração são preparadas por script.'),
p('Na entrega, schema_sqlite.sql oferece o esquema local completo. Para SQL Server, schema_v1.sql prepara a estrutura legada e migration_v2.sql acrescenta o módulo comercial. As cargas de demonstração são idempotentes: repetir a preparação não duplica os pedidos fictícios identificados pelo sistema.')
]},
{'title':'6. Frente de caixa e carrinho multi-itens', 'blocks':[
p('A frente de caixa permite buscar e selecionar produtos, informar quantidades, adicionar diferentes itens, alterar quantidades e remover linhas antes da confirmação. O cliente é identificado por nome ou razão social e CPF/CNPJ. As opções de pagamento são PIX, cartão de crédito e boleto faturado.'),
image('03-caixa.png','Figura 5 — Carrinho com duas memórias RAM e duas licenças, totalizando R$ 1.299,60.'),
p('No exemplo, as memórias totalizam R$ 499,80 e as licenças R$ 799,80. O navegador calcula a apresentação em centavos inteiros. Na confirmação, o servidor desconsidera qualquer preço enviado pelo cliente e recalcula os valores com Decimal a partir do catálogo do banco.'),
p('O carrinho é mantido temporariamente no sessionStorage da aba para facilitar correções após erros. Quando o recibo concluído é aberto, esse carrinho é limpo. Essa persistência temporária não substitui a conferência de preços e estoque no momento da venda.')
]},
{'title':'7. Checkout transacional e tratamento de falhas', 'blocks':[
p('A confirmação abre uma transação explícita. No SQLite é utilizado BEGIN IMMEDIATE, que reserva a escrita antes da leitura dos saldos; no SQL Server, o código utiliza BEGIN TRANSACTION e bloqueios de atualização. Os produtos são processados na ordem dos identificadores para manter uma ordem consistente de acesso.'),
bullets(['Conferir existência, situação ativa, preço e saldo de cada produto.', 'Criar o cabeçalho em Vendas e inserir as linhas em Itens_Venda.', 'Debitar o estoque e registrar as saídas em Movimentacoes com usuário e venda.', 'Confirmar o conjunto com COMMIT; em caso de erro, executar rollback da conexão.']),
image('08-saldo-insuficiente.png','Figura 6 — Mensagem de estoque insuficiente após tentativa de compra acima do saldo disponível.'),
p('A interface informa a impossibilidade da operação sem registrar uma venda parcial. Os testes comparam o conteúdo de Produtos, Vendas, Itens_Venda e Movimentacoes antes e depois da falha. Também foi induzido um erro tardio no banco, após o início da gravação, para verificar a reversão do cabeçalho, dos itens, da baixa e da auditoria.')
]},
{'title':'8. Histórico, indicadores e cancelamento', 'blocks':[
p('O histórico apresenta número e data do pedido, cliente, operador, valor e situação. O operador visualiza seus próprios pedidos; o gerente acessa o conjunto das vendas e os indicadores de receita concluída, quantidade de pedidos e cancelamentos. Cada registro disponibiliza o acesso ao recibo.'),
image('09-cancelamento.png','Figura 7 — Histórico após cancelamento de uma venda no banco isolado de demonstração.'),
p('O cancelamento é restrito ao gerente e ocorre em uma transação. O pedido permanece armazenado com status CANCELADA; todas as quantidades são devolvidas ao estoque; as entradas de estorno recebem o usuário responsável e o vínculo com a venda. O registro também informa quem cancelou e quando.'),
p('O backend impede cancelamento repetido. Nos testes, duas solicitações de cancelamento do mesmo pedido produziram uma única restituição de estoque. Os indicadores financeiros consideram apenas vendas concluídas no cálculo da receita exibida.')
]},
{'title':'9. Recibo e impressão', 'blocks':[
p('Após uma venda bem-sucedida, o sistema redireciona para o recibo. O documento identifica a TechStore, o cliente, o operador, o pedido, a data, a forma de pagamento e os itens, com quantidades, preços e total. Badges distinguem componentes físicos de licenças digitais.'),
image('05-recibo.png','Figura 8 — Recibo de uma venda concluída, com acesso ao botão Imprimir recibo.'),
image('06-impressao.png','Figura 9 — O mesmo recibo com o CSS de impressão aplicado, sem menu nem botões.'),
p('O botão abre o diálogo de impressão do navegador, que permite imprimir ou salvar em PDF. A prévia em uma página também foi demonstrada pelo usuário. O arquivo Recibo_Demonstracao.pdf acompanha este relatório. A chave apresentada corresponde ao identificador único do pedido para conferência interna; não é uma assinatura criptográfica e o recibo não substitui documento fiscal.')
]},
{'title':'10. Movimentações e rastreabilidade', 'blocks':[
p('A tela de movimentações é restrita ao gerente e permite registrar entradas e saídas manuais. Uma entrada soma ao saldo; uma saída subtrai apenas quando existe quantidade suficiente. O ajuste e seu histórico são gravados na mesma transação, com identificação do usuário responsável.'),
image('07-movimentacoes.png','Figura 10 — Formulário e histórico de movimentações, incluindo a carga inicial e as saídas das vendas fictícias.'),
p('O histórico apresenta data, produto, tipo, quantidade e observação. Os vínculos de usuário e venda são mantidos no banco, inclusive para os movimentos automáticos de checkout e estorno.'),
p('Foi corrigida uma incompatibilidade na apresentação de datas: o SQLite retorna texto e o SQL Server retorna datetime. Um filtro compartilhado aceita os dois formatos e exibe dia/mês/ano e horário. Essa correção passou a ser coberta por testes de abertura das telas e de registro de entradas e saídas.')
]},
{'title':'11. Validação e evidências dos testes', 'blocks':[
p('A execução registrada para esta entrega aprovou 17 testes: seis com conexão simulada e onze com SQLite real em arquivos temporários. A base do usuário não é alterada por esses testes. O log completo está em testes-execucao.txt.'),
table(['Grupo de verificação','Evidência obtida'],[['Acesso e segurança','Login com hash real, navegação, acesso anônimo, CSRF e restrições do operador.'],['Telas e datas','Abertura das telas do gerente e recibos; formatação de texto, datetime e ausência de data.'],['Venda multi-itens','Pedido e duas linhas de itens, baixa de saldo, auditoria e recibo acessível.'],['Estoque insuficiente','Operação bloqueada, sem mudanças nas quatro tabelas envolvidas.'],['Falha tardia no banco','Trigger de teste provoca erro de gravação; todo o conjunto é revertido.'],['Concorrência','Duas conexões tentam comprar a última unidade; apenas uma conclui.'],['Cancelamento','Restauração integral do saldo, entradas de estorno e prevenção de duplicidade.'],['Integridade e carga','FKs, quantidade positiva e execução repetida da carga sem duplicação.'],['Movimentação manual','Entrada, saída, identificação do gerente e bloqueio de saída sem saldo.']]),
code('.\\.venv\\Scripts\\python.exe -m unittest discover -s tests -v\n\nRan 17 tests\nOK'),
p('A execução contém mensagens de erro esperadas dos cenários de falha simulada e trigger proposital; esses registros não indicam reprovação. O resultado final do unittest foi OK. As capturas do sistema foram produzidas no Chrome em ambiente separado e o recibo de demonstração foi exportado em PDF.'),
p('Limites da validação: SQL Server não foi testado em um servidor real nesta máquina; a revisão visual em celular e em impressora física não foi automatizada. A prévia de impressão e o fluxo geral foram conferidos pelo usuário.')
]},
{'title':'12. Atendimento aos requisitos e entrega', 'blocks':[
table(['Requisito','Implementação e evidência'],[['REQ-01 · 2,0 pontos','Entidades, PK/FK e CHECKs; esquema e migração, Figura 1 e testes de integridade.'],['REQ-02 · 2,0 pontos','Hash, sessão e RBAC; Figura 2 e testes de segurança e permissões.'],['REQ-03 · 2,0 pontos','Carrinho multi-itens e totais dinâmicos; Figura 5 e teste de venda.'],['REQ-04 · 2,5 pontos','Transação, saldo, auditoria e rollback; Figura 6 e testes de falha tardia e concorrência no SQLite.'],['REQ-05 · 1,5 ponto','Recibo, impressão, mensagens e README; Figuras 8 e 9, PDF de exemplo e documentação.']]),
p('A matriz relaciona a implementação aos critérios fornecidos na atividade; não representa atribuição de nota. A execução validada utiliza SQLite. Caso haja orientação adicional exigindo especificamente SQL Server, deve-se selecionar esse backend e realizar a validação correspondente antes da entrega.'),
p('Para reproduzir a demonstração, instalar as dependências, executar o preparador e iniciar a aplicação:'),
code('python -m venv .venv\n.\\.venv\\Scripts\\python.exe -m pip install -r requirements.txt\n.\\.venv\\Scripts\\python.exe preparar_banco.py --demo\n.\\.venv\\Scripts\\python.exe app.py'),
p('Acesso local: http://127.0.0.1:5000. O README descreve as contas, variáveis de ambiente e a alternativa SQL Server. O .gitignore exclui ambientes virtuais, segredos e bancos locais; o avaliador pode reconstruir os dados fictícios com o preparador.'),
p('A entrega deve incluir o código-fonte, os arquivos SQL, os testes, o README e este relatório. A publicação no GitHub e o envio do link ao Google Classroom são etapas de submissão ainda dependentes da equipe. Não foi informado um endereço de repositório para inserir neste documento.'),
p('O resultado consolida inventário e vendas com controle de acesso, consistência transacional e comprovante. Como evolução futura, podem ser acrescentados filtros por período aos indicadores, manutenção de usuários pela interface e um mecanismo público de verificação de recibos. Essas melhorias não fazem parte do escopo implementado aqui.')
]}
]


def png_ratio(file):
    with open(file,'rb') as f:
        head=f.read(24)
    width,height=struct.unpack('>II',head[16:24])
    return height/width


def build_html():
    css = '''
@page {size:A4; margin:17mm 18mm 17mm;}
* {box-sizing:border-box} body {margin:0;color:#26382e;background:#e8ece4;font:10.5pt Arial,sans-serif;line-height:1.48}
.sheet {width:174mm;min-height:258mm;margin:12mm auto;padding:0;background:white;page-break-after:always;position:relative}
.sheet:last-child {page-break-after:auto}
.kicker {font-size:8pt;letter-spacing:2px;color:#527057;font-weight:bold;border-bottom:1px solid #cbd8c6;padding:0 0 9px;margin-bottom:20px}
h1 {font-size:23pt;color:#173e2e;line-height:1.18;letter-spacing:-.6px;margin:0 0 18px} p {margin:0 0 11px;text-align:justify}
ul {padding-left:19px;margin:0 0 14px} li {margin:0 0 7px}
figure {margin:14px 0 15px;break-inside:avoid} figure img {width:100%;height:auto;display:block;border:1px solid #dce3d7;border-radius:6px}
.sheet:nth-of-type(10) figure {width:145mm;margin-left:auto;margin-right:auto}.sheet:nth-of-type(11) figure {width:163mm;margin-left:auto;margin-right:auto} figcaption {font-size:8.2pt;color:#5f6e62;line-height:1.35;margin-top:7px;text-align:left}
table {width:100%;border-collapse:collapse;font-size:9pt;margin:14px 0 17px;break-inside:avoid}
th {background:#173e2e;color:white;text-align:left;padding:9px 10px;font-size:8.7pt} td {padding:8px 10px;border-bottom:1px solid #d9e2d4;vertical-align:top}tr:nth-child(even) td {background:#f3f6ef}
pre {white-space:pre-wrap;word-break:break-word;background:#f0f4eb;border-left:3px solid #b68b53;padding:12px;font:8.3pt Consolas,monospace;line-height:1.5;margin:14px 0}
.cover {padding-top:20mm;display:flex;flex-direction:column}
.cover .logo {width:62px;height:62px;background:#deb074;color:#173e2e;font-weight:bold;display:grid;place-items:center;border-radius:16px 16px 16px 3px;font-size:17pt;margin-bottom:26px}
.cover .overline {color:#677b61;font-size:9pt;font-weight:bold;letter-spacing:2px;margin-bottom:18px}
.cover h1 {font-size:46pt;line-height:1.05;margin:0 0 14px;letter-spacing:-2px}
.cover .subtitle {font-size:18pt;color:#4c6651;text-align:left;max-width:150mm;margin-bottom:30px}
.cover .rule {height:5px;width:65px;background:#c19a64;margin-bottom:30px}
.cover .team {font-size:14pt;font-weight:bold;color:#173e2e;margin-bottom:12px}
.cover .authors {font-size:11pt;line-height:1.8;text-align:left}
.cover .bottom {margin-top:auto;border-top:1px solid #cad8c5;padding-top:14px;font-size:9pt;color:#63735e;text-align:left}
@media print {body {background:white}.sheet {margin:0;width:174mm;box-shadow:none}}
@media screen {.sheet {padding:10mm; width:194mm;box-shadow:0 4px 30px #173e2e15}.sheet.cover {padding-top:20mm}}
'''
    out=['<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>Relatório TechStock — Equipe Over</title><style>'+css+'</style></head><body>']
    out.append('<section class="sheet cover"><div class="logo">TS</div><div class="overline">RELATÓRIO DE IMPLEMENTAÇÃO E VALIDAÇÃO</div><h1>TechStock<br>Manager</h1><p class="subtitle">Módulo de vendas, checkout transacional<br>e controle de acesso operacional</p><div class="rule"></div><div class="team">Equipe Over</div><p class="authors">'+'<br>'.join(map(escape,AUTHORS))+'</p><p class="bottom">TechStore Informática & Serviços Corporativos<br>Demanda #2026-INV05 · 11 de novembro de 2026</p></section>')
    for i,page in enumerate(PAGES):
        out.append('<section class="sheet"><div class="kicker">TECHSTOCK MANAGER · EQUIPE OVER</div><h1>'+escape(page['title'])+'</h1>')
        for b in page['blocks']:
            kind=b['type']
            if kind=='p':out.append('<p>'+escape(b['text'])+'</p>')
            elif kind=='bullets':out.append('<ul>'+''.join('<li>'+escape(x)+'</li>' for x in b['items'])+'</ul>')
            elif kind=='code':out.append('<pre>'+escape(b['text'])+'</pre>')
            elif kind=='image':out.append('<figure><img src="imagens/'+escape(b['file'])+'"><figcaption>'+escape(b['caption'])+'</figcaption></figure>')
            elif kind=='table':out.append('<table><thead><tr>'+''.join('<th>'+escape(x)+'</th>' for x in b['headers'])+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+escape(x)+'</td>' for x in row)+'</tr>' for row in b['rows'])+'</tbody></table>')
        out.append('</section>')
    out.append('</body></html>')
    (ROOT/'Relatorio_TechStock_Equipe_Over.html').write_text(''.join(out),encoding='utf-8')


def build_markdown():
    out=['# TechStock Manager\n\nRelatório de implementação e validação · Equipe Over\n\n**Integrantes:** '+', '.join(AUTHORS)+'\n\n**Data:** 11 de novembro de 2026\n']
    for page in PAGES:
        out.append('\n## '+page['title']+'\n')
        for b in page['blocks']:
            if b['type']=='p':out.append(b['text']+'\n')
            elif b['type']=='bullets':out.append('\n'.join('- '+x for x in b['items'])+'\n')
            elif b['type']=='code':out.append('```text\n'+b['text']+'\n```\n')
            elif b['type']=='image':out.append('!['+b['caption']+'](imagens/'+b['file']+')\n\n'+b['caption']+'\n')
            elif b['type']=='table':
                out.append('| '+' | '.join(b['headers'])+' |\n| '+' | '.join('---' for _ in b['headers'])+' |\n'+'\n'.join('| '+' | '.join(row)+' |' for row in b['rows'])+'\n')
    (ROOT/'Relatorio_TechStock_Equipe_Over.md').write_text('\n'.join(out),encoding='utf-8')


def shade(cell, color):
    shading=OxmlElement('w:shd');shading.set(qn('w:fill'),color);cell._tc.get_or_add_tcPr().append(shading)


def build_docx():
    doc=Document()
    sec=doc.sections[0];sec.page_width=Cm(21);sec.page_height=Cm(29.7)
    sec.top_margin=Cm(1.8);sec.bottom_margin=Cm(1.8);sec.left_margin=Cm(1.8);sec.right_margin=Cm(1.8)
    sec.header_distance=Cm(.75);sec.footer_distance=Cm(.75);sec.different_first_page_header_footer=True
    normal=doc.styles['Normal'];normal.font.name='Calibri';normal.font.size=Pt(10.5);normal.font.color.rgb=RGBColor.from_string('26382E')
    normal.paragraph_format.space_after=Pt(7);normal.paragraph_format.line_spacing=1.1
    for name,size in [('Title',36),('Heading 1',22),('Heading 2',15)]:
        style=doc.styles[name];style.font.name='Calibri';style.font.size=Pt(size);style.font.color.rgb=RGBColor.from_string('173E2E');style.font.bold=True
    cap=doc.styles['Caption'];cap.font.name='Calibri';cap.font.size=Pt(8);cap.font.color.rgb=RGBColor.from_string('5F6E62');cap.font.italic=False
    head=sec.header.paragraphs[0];head.text='TECHSTOCK MANAGER  |  EQUIPE OVER';head.style='Caption'
    foot=sec.footer.paragraphs[0];foot.text='Relatório de implementação · 11/11/2026                                      Página '
    foot.style='Caption'
    field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');foot._p.append(field)
    cover=doc.add_paragraph();cover.paragraph_format.space_before=Pt(60)
    run=cover.add_run('TS  /  TECHSTOCK');run.bold=True;run.font.color.rgb=RGBColor.from_string('947043');run.font.size=Pt(14)
    doc.add_paragraph('Relatório de implementação\ne validação',style='Subtitle')
    doc.add_paragraph('TechStock\nManager',style='Title')
    doc.add_paragraph('Módulo de vendas, checkout transacional\ne controle de acesso operacional',style='Subtitle')
    label=doc.add_paragraph('Equipe Over');label.paragraph_format.space_before=Pt(28);label.runs[0].bold=True;label.runs[0].font.size=Pt(16)
    for author in AUTHORS:doc.add_paragraph(author)
    bottom=doc.add_paragraph('TechStore Informática & Serviços Corporativos\nDemanda #2026-INV05\n11 de novembro de 2026');bottom.paragraph_format.space_before=Pt(32)
    for page in PAGES:
        doc.add_page_break();doc.add_heading(page['title'],level=1)
        for b in page['blocks']:
            kind=b['type']
            if kind=='p':doc.add_paragraph(b['text'])
            elif kind=='bullets':
                for item in b['items']:doc.add_paragraph(item,style='List Bullet')
            elif kind=='image':
                para=doc.add_paragraph();para.paragraph_format.space_before=Pt(3);para.paragraph_format.space_after=Pt(3)
                para.alignment = 1
                image_width = 14.5 if page['title'].startswith('9.') else 16.3 if page['title'].startswith('10.') else 17.2
                para.add_run().add_picture(str(ROOT/'imagens'/b['file']),width=Cm(image_width))
                doc.add_paragraph(b['caption'],style='Caption')
            elif kind=='code':
                para=doc.add_paragraph();para.paragraph_format.space_before=Pt(5)
                run=para.add_run(b['text']);run.font.name='Consolas';run.font.size=Pt(8)
            elif kind=='table':
                t=doc.add_table(rows=1,cols=len(b['headers']));t.style='Light Shading Accent 1'
                for j,text in enumerate(b['headers']):
                    cell=t.rows[0].cells[j];cell.text=text;shade(cell,'173E2E')
                    for run in cell.paragraphs[0].runs:run.font.bold=True;run.font.color.rgb=RGBColor(255,255,255);run.font.size=Pt(9)
                for row in b['rows']:
                    cells=t.add_row().cells
                    for j,text in enumerate(row):
                        cells[j].text=text
                        for para in cells[j].paragraphs:
                            para.paragraph_format.space_after=Pt(4);para.paragraph_format.space_before=Pt(3)
                            for run in para.runs:run.font.size=Pt(9)
                doc.add_paragraph().paragraph_format.space_after=Pt(2)
    doc.core_properties.title='TechStock Manager — Relatório de implementação e validação'
    doc.core_properties.author='Equipe Over — '+', '.join(AUTHORS)
    doc.core_properties.subject='Demanda #2026-INV05'
    buffer = BytesIO()
    doc.save(buffer)
    data = buffer.getvalue()
    with ZipFile(BytesIO(data)) as archive:
        xml = archive.read('word/document.xml').decode('utf-8')
        assert all(author in xml for author in AUTHORS)
        assert len([name for name in archive.namelist() if name.startswith('word/media/')]) == 10
        assert '\ufffd' not in xml
    (ROOT/'Relatorio_TechStock_Equipe_Over_Final.docx').write_bytes(data)
    print('Word validado: seis integrantes e dez figuras incorporadas.')

if __name__=='__main__':
    (ROOT/'conteudo-relatorio.json').write_text(json.dumps({'authors':AUTHORS,'pages':PAGES},ensure_ascii=False,indent=2),encoding='utf-8')
    build_html();build_markdown();build_docx()
    print('Relatório criado: Word, HTML, Markdown; 13 páginas planejadas.')

from flask import Flask, render_template, request, redirect, url_for, flash, session, g, abort
from werkzeug.security import check_password_hash
from datetime import datetime, timedelta
import os
import secrets
from decimal import Decimal, InvalidOperation
from db import get_connection
import pyodbc

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
app.config.update(PERMANENT_SESSION_LIFETIME=timedelta(hours=8), SESSION_COOKIE_HTTPONLY=True,
                  SESSION_COOKIE_SAMESITE="Lax", SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE") == "1")


@app.template_filter('data_hora')
def formatar_data_hora(valor):
    if not valor:
        return '—'
    if isinstance(valor, str):
        try:
            valor = datetime.fromisoformat(valor)
        except ValueError:
            return valor
    return valor.strftime('%d/%m/%Y %H:%M')


@app.before_request
def proteger_rotas():
    g.usuario = None
    if request.endpoint == 'static':
        return
    session.setdefault('csrf', secrets.token_hex(32))
    if request.method == 'POST' and not secrets.compare_digest(session['csrf'], request.form.get('csrf_token', '')):
        abort(400, description='Formulário expirado. Recarregue a página e tente novamente.')
    if session.get('usuario_id'):
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute('SELECT id, nome_completo, perfil_acesso FROM Usuarios WHERE id = ? AND status = ?', session['usuario_id'], 'ATIVO')
            users = rows_to_dicts(cur)
            g.usuario = users[0] if users else None
        finally:
            conn.close()
    if request.endpoint == 'login':
        return
    if not g.usuario:
        return redirect(url_for('login'))
    livres = {'dashboard', 'pdv', 'vendas', 'recibo', 'logout'}
    if request.endpoint not in livres and g.usuario['perfil_acesso'] != 'GERENTE':
        abort(403)


@app.context_processor
def contexto_usuario():
    return {'usuario': g.get('usuario'), 'csrf_token': session.get('csrf', ''),
            'asset_version': int(os.path.getmtime(os.path.join(app.static_folder, 'css', 'style.css')))}


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute('SELECT id, senha_hash FROM Usuarios WHERE email = ? AND status = ?', request.form.get('email', '').strip().lower(), 'ATIVO')
            row = cur.fetchone()
            if row and check_password_hash(row[1], request.form.get('senha', '')):
                session.clear()
                session.update(usuario_id=row[0], csrf=secrets.token_hex(32))
                session.permanent = True
                return redirect(url_for('dashboard'))
            flash('E-mail ou senha inválidos, ou usuário inativo.', 'danger')
        finally:
            conn.close()
    return render_template('login.html')


@app.post('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


def rows_to_dicts(cursor):
    columns = [column[0] for column in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


@app.route("/")
def dashboard():
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT p.id_produto, p.sku, p.nome, p.fabricante,
                   p.classificacao, c.nome AS categoria,
                   f.razao_social AS fornecedor, p.preco_venda,
                   p.estoque_atual, p.estoque_minimo, p.localizacao,
                   p.modalidade_licenciamento, p.ativo
            FROM Produtos p
            INNER JOIN Categorias c ON c.id_categoria = p.id_categoria
            INNER JOIN Fornecedores f ON f.id_fornecedor = p.id_fornecedor
            WHERE p.ativo = 1
            ORDER BY p.nome
        """)
        products = rows_to_dicts(cur)
        cur.execute("SELECT COUNT(*) FROM Produtos WHERE ativo = 1")
        total = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM Produtos WHERE ativo = 1 AND estoque_atual <= estoque_minimo")
        low_stock = cur.fetchone()[0]
        cur.execute("SELECT COALESCE(SUM(estoque_atual), 0) FROM Produtos WHERE ativo = 1")
        total_units = cur.fetchone()[0]
        return render_template("dashboard.html", products=products, total=total,
                               low_stock=low_stock, total_units=total_units)
    finally:
        conn.close()


@app.route("/produtos/novo", methods=["GET", "POST"])
def novo_produto():
    conn = get_connection()
    try:
        cur = conn.cursor()
        if request.method == "POST":
            try:
                preco = Decimal(request.form["preco_venda"].replace(",", "."))
                estoque = int(request.form["estoque_atual"])
                minimo = int(request.form["estoque_minimo"])
                if preco <= 0 or estoque < 0 or minimo < 0:
                    raise ValueError("Preço deve ser maior que zero e estoques não podem ser negativos.")
            except (ValueError, InvalidOperation, KeyError):
                flash("Confira o preço e as quantidades informadas.", "danger")
                cur.execute("SELECT id_categoria, nome FROM Categorias ORDER BY nome")
                categorias = rows_to_dicts(cur)
                cur.execute("SELECT id_fornecedor, razao_social FROM Fornecedores ORDER BY razao_social")
                fornecedores = rows_to_dicts(cur)
                return render_template("produto_form.html", categorias=categorias, fornecedores=fornecedores)

            limites_texto = {
                "sku": 20,
                "nome": 20,
                "fabricante": 20,
                "especificacao": 20,
                "modalidade_licenciamento": 20,
                "localizacao": 20,
            }
            excedidos = [
                campo for campo, limite in limites_texto.items()
                if len(request.form.get(campo, "").strip()) > limite
            ]
            if excedidos:
                flash("Algum campo de texto ultrapassou o limite permitido. Reduza o conteúdo e tente novamente.", "danger")
                return redirect(url_for("novo_produto"))

            classificacao = request.form["classificacao"]
            licenca = request.form.get("modalidade_licenciamento") or None
            if classificacao == "Software" and not licenca:
                flash("Informe a modalidade de licenciamento para softwares.", "danger")
                return redirect(url_for("novo_produto"))
            try:
                cur.execute("""
                    INSERT INTO Produtos
                    (sku, nome, fabricante, classificacao, especificacao,
                     modalidade_licenciamento, preco_venda, estoque_atual,
                     estoque_minimo, localizacao, id_categoria, id_fornecedor)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, request.form["sku"].strip(), request.form["nome"].strip(),
                     request.form["fabricante"].strip(), classificacao,
                     request.form.get("especificacao", "").strip(), licenca,
                     preco, estoque, minimo, request.form["localizacao"].strip(),
                     int(request.form["id_categoria"]), int(request.form["id_fornecedor"]))
                conn.commit()
                flash("Produto cadastrado com sucesso!", "success")
                return redirect(url_for("dashboard"))
            except pyodbc.IntegrityError:
                conn.rollback()
                flash("Não foi possível cadastrar. Verifique se o SKU já existe e se categoria e fornecedor são válidos.", "danger")

        cur.execute("SELECT id_categoria, nome FROM Categorias ORDER BY nome")
        categorias = rows_to_dicts(cur)
        cur.execute("SELECT id_fornecedor, razao_social FROM Fornecedores ORDER BY razao_social")
        fornecedores = rows_to_dicts(cur)
        return render_template("produto_form.html", categorias=categorias, fornecedores=fornecedores)
    finally:
        conn.close()


@app.route("/movimentacoes", methods=["GET", "POST"])
def movimentacoes():
    conn = get_connection()
    try:
        cur = conn.cursor()
        if request.method == "POST":
            try:
                produto_id = int(request.form["id_produto"])
                quantidade = int(request.form["quantidade"])
                tipo = request.form["tipo"]
                if quantidade <= 0 or tipo not in ("Entrada", "Saida"):
                    raise ValueError()
                conn.autocommit = False
                cur.execute("SELECT estoque_atual FROM Produtos WITH (UPDLOCK, ROWLOCK) WHERE id_produto = ? AND ativo = 1", produto_id)
                result = cur.fetchone()
                if not result:
                    raise ValueError("Produto não encontrado ou desativado.")
                saldo = result[0]
                if tipo == "Saida" and quantidade > saldo:
                    raise ValueError(f"Estoque insuficiente. Saldo disponível: {saldo} unidade(s).")
                novo_saldo = saldo + quantidade if tipo == "Entrada" else saldo - quantidade
                cur.execute("UPDATE Produtos SET estoque_atual = ? WHERE id_produto = ?", novo_saldo, produto_id)
                cur.execute("""
                    INSERT INTO Movimentacoes (tipo, quantidade, observacao, id_produto, usuario_id)
                    VALUES (?, ?, ?, ?, ?)
                """, tipo, quantidade, request.form.get("observacao", "").strip(), produto_id, g.usuario['id'])
                conn.commit()
                flash(f"Movimentação registrada. Novo saldo: {novo_saldo}.", "success")
            except ValueError as exc:
                conn.rollback()
                flash(str(exc) or "Informe uma quantidade válida.", "danger")
            except Exception:
                conn.rollback()
                flash("Não foi possível concluir a movimentação. Nenhuma alteração foi mantida.", "danger")
            finally:
                conn.autocommit = True
            return redirect(url_for("movimentacoes"))

        cur.execute("SELECT id_produto, sku, nome, estoque_atual FROM Produtos WHERE ativo = 1 ORDER BY nome")
        produtos = rows_to_dicts(cur)
        cur.execute("""
            SELECT m.id_movimentacao, m.tipo, m.quantidade, m.data_movimentacao,
                   m.observacao, p.sku, p.nome
            FROM Movimentacoes m
            INNER JOIN Produtos p ON p.id_produto = m.id_produto
            ORDER BY m.data_movimentacao DESC, m.id_movimentacao DESC
        """)
        historico = rows_to_dicts(cur)
        return render_template("movimentacoes.html", produtos=produtos, historico=historico)
    finally:
        conn.close()


@app.post("/produtos/<int:produto_id>/desativar")
def desativar_produto(produto_id):
    conn = get_connection()

    try:
        cur = conn.cursor()

        # Verifica se existem movimentações
        cur.execute("""
            SELECT COUNT(*)
            FROM Movimentacoes
            WHERE id_produto = ?
        """, produto_id)

        movimentacoes = cur.fetchone()[0]

        if movimentacoes > 0:
            flash(
                "Não é possível excluir este produto "
                "porque ele possui movimentações registradas.",
                "danger"
            )
        else:
            cur.execute("""
                UPDATE Produtos SET ativo = 0
                WHERE id_produto = ?
            """, produto_id)

            conn.commit()
            flash("Produto desativado com sucesso!", "success")

    except Exception:
        conn.rollback()
        flash("Erro ao excluir o produto.", "danger")

    finally:
        conn.close()

    return redirect(url_for("dashboard"))


@app.post("/categorias/<int:categoria_id>/excluir")
def excluir_categoria(categoria_id):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM Categorias WHERE id_categoria = ?", categoria_id)
        conn.commit()
        flash("Categoria excluída.", "success")
    except pyodbc.IntegrityError:
        conn.rollback()
        flash("Esta categoria possui produtos vinculados. Transfira os produtos para outra categoria antes de excluí-la.", "danger")
    finally:
        conn.close()
    return redirect(url_for("cadastros"))


@app.post("/categorias/novo")
def adicionar_categoria():
    nome = request.form.get("nome", "").strip()
    if not nome:
        flash("Informe o nome da categoria.", "danger")
        return redirect(url_for("cadastros"))
    if len(nome) > 20:
        flash("O nome da categoria deve ter no máximo 20 caracteres.", "danger")
        return redirect(url_for("cadastros"))

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO Categorias (nome) VALUES (?)", nome)
        conn.commit()
        flash("Categoria cadastrada com sucesso.", "success")
    except pyodbc.IntegrityError:
        conn.rollback()
        flash("Já existe uma categoria com esse nome.", "danger")
    finally:
        conn.close()
    return redirect(url_for("cadastros"))


@app.post("/fornecedores/<int:fornecedor_id>/excluir")
def excluir_fornecedor(fornecedor_id):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM Fornecedores WHERE id_fornecedor = ?", fornecedor_id)
        conn.commit()
        flash("Fornecedor excluído.", "success")
    except pyodbc.IntegrityError:
        conn.rollback()
        flash("Este fornecedor possui produtos vinculados. Atualize os vínculos antes de excluí-lo.", "danger")
    finally:
        conn.close()
    return redirect(url_for("cadastros"))


@app.route("/cadastros")
def cadastros():
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id_categoria, nome FROM Categorias ORDER BY nome")
        categorias = rows_to_dicts(cur)
        cur.execute("SELECT id_fornecedor, razao_social, cnpj FROM Fornecedores ORDER BY razao_social")
        fornecedores = rows_to_dicts(cur)
        return render_template("cadastros.html", categorias=categorias, fornecedores=fornecedores)
    finally:
        conn.close()


@app.errorhandler(pyodbc.Error)
def database_error(error):
    app.logger.exception("Erro de banco de dados")
    return render_template("error.html"), 500


@app.errorhandler(403)
def acesso_negado(error):
    return render_template('mensagem.html', titulo='Acesso restrito', mensagem='Seu perfil não permite realizar esta operação.'), 403


@app.errorhandler(400)
def formulario_invalido(error):
    return render_template('mensagem.html', titulo='Formulário inválido', mensagem='Recarregue a página e envie o formulário novamente.'), 400


@app.errorhandler(404)
def nao_encontrado(error):
    return render_template('mensagem.html', titulo='Página não encontrada', mensagem='O registro solicitado não foi encontrado.'), 404


@app.post('/produtos/<int:produto_id>/preco')
def alterar_preco(produto_id):
    try:
        preco = Decimal(request.form.get('preco_venda', '').replace(',', '.')).quantize(Decimal('.01'))
        if not preco.is_finite() or preco <= 0 or preco > Decimal('99999999.99'):
            raise ValueError()
    except (ValueError, InvalidOperation):
        flash('Informe um preço positivo válido.', 'danger')
        return redirect(url_for('dashboard'))
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute('UPDATE Produtos SET preco_venda = ? WHERE id_produto = ? AND ativo = 1', preco, produto_id)
        conn.commit()
        flash('Preço atualizado. Recibos anteriores preservam o valor original.', 'success')
    except pyodbc.Error:
        conn.rollback()
        raise
    finally:
        conn.close()
    return redirect(url_for('dashboard'))


@app.route('/pdv', methods=['GET', 'POST'])
def pdv():
    conn = get_connection()
    try:
        cur = conn.cursor()
        if request.method == 'POST':
            try:
                ids = request.form.getlist('produto_id')
                quantidades = request.form.getlist('quantidade')
                if not ids or len(ids) != len(quantidades) or len(ids) > 100:
                    raise ValueError('Adicione entre 1 e 100 itens ao carrinho.')
                carrinho = {}
                for pid, qtd in zip(ids, quantidades):
                    pid, qtd = int(pid), int(qtd)
                    if qtd <= 0 or qtd > 1000000:
                        raise ValueError('Quantidade inválida.')
                    carrinho[pid] = carrinho.get(pid, 0) + qtd
                nome = request.form.get('cliente_nome', '').strip()
                documento = request.form.get('cliente_documento', '').strip()
                pagamento = request.form.get('forma_pagamento')
                if not nome or len(nome) > 160 or not documento or len(documento) > 18:
                    raise ValueError('Informe o nome e CPF/CNPJ do cliente nos limites indicados.')
                if pagamento not in ('PIX', 'CARTAO_CREDITO', 'BOLETO_FATURADO'):
                    raise ValueError('Selecione uma forma de pagamento válida.')
                cur.execute('SET XACT_ABORT ON; BEGIN TRANSACTION')
                itens, total = [], Decimal('0.00')
                for pid, qtd in sorted(carrinho.items()):
                    cur.execute('SELECT nome, preco_venda, estoque_atual FROM Produtos WITH (UPDLOCK, HOLDLOCK) WHERE id_produto = ? AND ativo = 1', pid)
                    p = cur.fetchone()
                    if not p:
                        raise ValueError('Um produto foi desativado ou não existe. Revise o carrinho.')
                    if p[2] < qtd:
                        raise ValueError(f'Estoque insuficiente para {p[0]}. Disponível: {p[2]}. Nenhum item foi vendido.')
                    preco = Decimal(str(p[1])).quantize(Decimal('.01'))
                    if not preco.is_finite() or preco <= 0:
                        raise ValueError('Produto com preço inválido. Solicite a correção ao gerente.')
                    subtotal = preco * qtd
                    total += subtotal
                    itens.append((pid, qtd, preco, subtotal))
                pedido = 'TS-' + secrets.token_hex(10).upper()
                cur.execute('''INSERT INTO Vendas (numero_pedido, cliente_nome, cliente_documento, forma_pagamento, valor_total, usuario_id)
                    OUTPUT INSERTED.id VALUES (?, ?, ?, ?, ?, ?)''', pedido, nome, documento, pagamento, total, g.usuario['id'])
                venda_id = cur.fetchone()[0]
                for pid, qtd, preco, subtotal in itens:
                    cur.execute('INSERT INTO Itens_Venda (venda_id, produto_id, quantidade_vendida, preco_unitario_praticado, subtotal_item, produto_nome, classificacao) SELECT ?, id_produto, ?, ?, ?, nome, classificacao FROM Produtos WHERE id_produto = ?', venda_id, qtd, preco, subtotal, pid)
                    cur.execute('UPDATE Produtos SET estoque_atual = estoque_atual - ? WHERE id_produto = ?', qtd, pid)
                    cur.execute('INSERT INTO Movimentacoes (tipo, quantidade, observacao, id_produto, usuario_id, venda_id) VALUES (?, ?, ?, ?, ?, ?)', 'Saida', qtd, 'Venda', pid, g.usuario['id'], venda_id)
                cur.execute('COMMIT TRANSACTION')
                conn.commit()
                return redirect(url_for('recibo', venda_id=venda_id))
            except (ValueError, InvalidOperation) as exc:
                conn.rollback()
                flash(str(exc) or 'Revise as quantidades do carrinho.', 'danger')
            except pyodbc.Error:
                conn.rollback()
                app.logger.exception('Checkout revertido')
                flash('Não foi possível concluir a venda. Toda a operação foi desfeita.', 'danger')
        cur.execute('SELECT id_produto, sku, nome, classificacao, preco_venda, estoque_atual FROM Produtos WHERE ativo = 1 ORDER BY nome')
        return render_template('pdv.html', produtos=rows_to_dicts(cur))
    finally:
        conn.close()


@app.get('/vendas')
def vendas():
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute('''SELECT v.*, u.nome_completo FROM Vendas v JOIN Usuarios u ON u.id = v.usuario_id
            WHERE (? = 'GERENTE' OR v.usuario_id = ?) ORDER BY v.data_hora DESC''', g.usuario['perfil_acesso'], g.usuario['id'])
        return render_template('vendas.html', vendas=rows_to_dicts(cur))
    finally:
        conn.close()


@app.get('/vendas/<int:venda_id>')
def recibo(venda_id):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute('''SELECT v.*, u.nome_completo FROM Vendas v JOIN Usuarios u ON u.id = v.usuario_id WHERE v.id = ?''', venda_id)
        rows = rows_to_dicts(cur)
        if not rows:
            abort(404)
        venda = rows[0]
        if g.usuario['perfil_acesso'] != 'GERENTE' and venda['usuario_id'] != g.usuario['id']:
            abort(403)
        cur.execute('SELECT * FROM Itens_Venda WHERE venda_id = ? ORDER BY id', venda_id)
        return render_template('recibo.html', venda=venda, itens=rows_to_dicts(cur))
    finally:
        conn.close()


@app.post('/vendas/<int:venda_id>/cancelar')
def cancelar_venda(venda_id):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute('SET XACT_ABORT ON; BEGIN TRANSACTION')
        cur.execute('SELECT status_venda FROM Vendas WITH (UPDLOCK, HOLDLOCK) WHERE id = ?', venda_id)
        row = cur.fetchone()
        if not row or row[0] != 'CONCLUIDA':
            raise ValueError('Venda inexistente ou já cancelada.')
        cur.execute('SELECT produto_id, quantidade_vendida FROM Itens_Venda WHERE venda_id = ? ORDER BY produto_id', venda_id)
        for pid, qtd in cur.fetchall():
            cur.execute('UPDATE Produtos SET estoque_atual = estoque_atual + ? WHERE id_produto = ?', qtd, pid)
            cur.execute('INSERT INTO Movimentacoes (tipo, quantidade, observacao, id_produto, usuario_id, venda_id) VALUES (?, ?, ?, ?, ?, ?)', 'Entrada', qtd, 'Estorno', pid, g.usuario['id'], venda_id)
        cur.execute("UPDATE Vendas SET status_venda = 'CANCELADA', cancelado_por = ?, cancelado_em = SYSDATETIME() WHERE id = ?", g.usuario['id'], venda_id)
        cur.execute('COMMIT TRANSACTION')
        conn.commit()
        flash('Venda cancelada e estoque restituído.', 'success')
    except ValueError as exc:
        conn.rollback()
        flash(str(exc), 'danger')
    except pyodbc.Error:
        conn.rollback()
        app.logger.exception('Cancelamento revertido')
        flash('Não foi possível cancelar. Nenhuma alteração foi mantida.', 'danger')
    finally:
        conn.close()
    return redirect(url_for('vendas'))


if __name__ == "__main__":
    app.run(debug=os.environ.get('FLASK_DEBUG') == '1')

"""Dados fictícios idempotentes para demonstração do SQLite local."""
from decimal import Decimal
from db import get_connection


def seed_sqlite_demo():
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute('SET XACT_ABORT ON; BEGIN TRANSACTION')
        cur.execute('SELECT id FROM Usuarios WHERE email=?', 'operador@techstore.com')
        uid = cur.fetchone()[0]
        cur.execute('SELECT id_categoria FROM Categorias WHERE nome=?', 'Demo TechStock')
        row = cur.fetchone()
        if not row:
            cur.execute('INSERT INTO Categorias(nome) VALUES(?)', 'Demo TechStock')
            cur.execute('SELECT id_categoria FROM Categorias WHERE nome=?', 'Demo TechStock')
            row = cur.fetchone()
        cid = row[0]
        cur.execute('SELECT id_fornecedor FROM Fornecedores WHERE cnpj=?', '00.000.000/0000-00')
        row = cur.fetchone()
        if not row:
            cur.execute('INSERT INTO Fornecedores(razao_social,cnpj) VALUES(?,?)', 'Fornecedor fictício TechStock', '00.000.000/0000-00')
            cur.execute('SELECT id_fornecedor FROM Fornecedores WHERE cnpj=?', '00.000.000/0000-00')
            row = cur.fetchone()
        fid = row[0]
        ids = []
        for sku, nome, tipo, preco, licenca in (
            ('DEMO-RAM-16', 'Memória RAM 16GB', 'Hardware', Decimal('249.90'), None),
            ('DEMO-WIN-PRO', 'Windows Pro Demo', 'Software', Decimal('399.90'), 'Corporativa'),
        ):
            cur.execute('SELECT id_produto FROM Produtos WHERE sku=?', sku)
            row = cur.fetchone()
            if not row:
                cur.execute('''INSERT INTO Produtos(sku,nome,fabricante,classificacao,modalidade_licenciamento,
                    preco_venda,estoque_atual,estoque_minimo,localizacao,id_categoria,id_fornecedor)
                    VALUES(?,?,?,?,?,?,20,5,?,?,?)''', sku, nome, 'Demo', tipo, licenca, preco,
                            'Cofre digital' if licenca else 'Prateleira A1', cid, fid)
                cur.execute('SELECT id_produto FROM Produtos WHERE sku=?', sku)
                row = cur.fetchone()
                cur.execute('INSERT INTO Movimentacoes(tipo,quantidade,observacao,id_produto,usuario_id) VALUES(?,?,?,?,?)', 'Entrada', 20, 'Carga demo', row[0], uid)
            ids.append(row[0])
        for numero, pagamento in (('TS-DEMO-002', 'PIX'), ('TS-DEMO-003', 'BOLETO_FATURADO')):
            cur.execute('SELECT id FROM Vendas WHERE numero_pedido=?', numero)
            if cur.fetchone():
                continue
            itens = []
            total = Decimal('0.00')
            for pid in ids:
                cur.execute('SELECT preco_venda,estoque_atual,ativo FROM Produtos WHERE id_produto=?', pid)
                preco, estoque, ativo = cur.fetchone()
                if not ativo or estoque < 2:
                    raise ValueError('Produtos demo sem saldo ou inativos. Nenhuma alteração foi mantida.')
                preco = Decimal(str(preco)).quantize(Decimal('.01'))
                itens.append((pid, preco))
                total += preco * 2
            cur.execute('''INSERT INTO Vendas(numero_pedido,cliente_nome,cliente_documento,forma_pagamento,valor_total,usuario_id)
                OUTPUT INSERTED.id VALUES(?,?,?,?,?,?)''', numero, 'Empresa fictícia de teste', '00.000.000/0000-00', pagamento, total, uid)
            vid = cur.fetchone()[0]
            for pid, preco in itens:
                cur.execute('''INSERT INTO Itens_Venda(venda_id,produto_id,quantidade_vendida,preco_unitario_praticado,subtotal_item,produto_nome,classificacao)
                    SELECT ?,id_produto,2,?,?,nome,classificacao FROM Produtos WHERE id_produto=?''', vid, preco, preco*2, pid)
                cur.execute('UPDATE Produtos SET estoque_atual=estoque_atual-2 WHERE id_produto=?', pid)
                cur.execute('INSERT INTO Movimentacoes(tipo,quantidade,observacao,id_produto,usuario_id,venda_id) VALUES(?,?,?,?,?,?)', 'Saida', 2, 'Venda demo', pid, uid, vid)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

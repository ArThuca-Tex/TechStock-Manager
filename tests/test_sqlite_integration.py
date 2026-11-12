"""Testes de integração com SQLite real isolado em diretório temporário."""
import os
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
import pyodbc
from app import app
from db import get_connection
from demo_data import seed_sqlite_demo


class SQLiteIntegrationTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {'DB_ENGINE': 'sqlite', 'SQLITE_PATH': os.path.join(self.temp.name, 'test.db')})
        self.env.start()
        app.config['TESTING'] = True
        seed_sqlite_demo()
        conn = get_connection()
        cur = conn.cursor()
        cur.execute('SELECT id FROM Usuarios WHERE perfil_acesso=?', 'OPERADOR')
        self.operator = cur.fetchone()[0]
        cur.execute('SELECT id FROM Usuarios WHERE perfil_acesso=?', 'GERENTE')
        self.manager = cur.fetchone()[0]
        cur.execute('SELECT id_produto FROM Produtos ORDER BY id_produto')
        self.ids = [r[0] for r in cur.fetchall()]
        conn.close()

    def tearDown(self):
        self.env.stop()
        self.temp.cleanup()

    def client(self, manager=False):
        client = app.test_client()
        with client.session_transaction() as session:
            session.update(usuario_id=self.manager if manager else self.operator, csrf='token')
        return client

    def query(self, sql, *args):
        conn = get_connection()
        try:
            cur = conn.cursor().execute(sql, *args)
            return cur.fetchall()
        finally:
            conn.close()

    def checkout(self, client=None, quantities=None, ids=None):
        ids = ids or self.ids
        return (client or self.client()).post('/pdv', data={
            'csrf_token':'token', 'produto_id':[str(pid) for pid in ids],
            'quantidade':quantities or ['2','1'], 'cliente_nome':'Teste de integração',
            'cliente_documento':'000.000.000-00', 'forma_pagamento':'PIX'})

    def test_login_real_hash_and_pages(self):
        for email, password in (('operador@techstore.com','Operador@123'), ('gerente@techstore.com','Gerente@123')):
            client = app.test_client()
            self.assertEqual(client.get('/login').status_code, 200)
            with client.session_transaction() as session:
                token = session['csrf']
            response = client.post('/login', data={'csrf_token':token,'email':email,'senha':password})
            self.assertEqual(response.status_code, 302)
            for page in ('/', '/pdv', '/vendas'):
                self.assertEqual(client.get(page).status_code, 200)
        self.assertEqual(self.client().get('/cadastros').status_code,403)
        self.assertEqual(self.client(manager=True).get('/cadastros').status_code,200)

    def test_multi_item_checkout_receipt_and_stock(self):
        before = self.query('SELECT estoque_atual FROM Produtos ORDER BY id_produto')
        client = self.client()
        response = self.checkout(client)
        self.assertEqual(response.status_code,302)
        self.assertEqual(client.get(response.location).status_code,200)
        after = self.query('SELECT estoque_atual FROM Produtos ORDER BY id_produto')
        self.assertEqual(before[0][0]-after[0][0],2)
        self.assertEqual(before[1][0]-after[1][0],1)
        self.assertEqual(self.query('SELECT COUNT(*) FROM Vendas')[0][0],3)
        self.assertEqual(self.query('SELECT COUNT(*) FROM Itens_Venda')[0][0],6)
        self.assertEqual(self.query('SELECT COUNT(*) FROM Movimentacoes WHERE venda_id IS NOT NULL')[0][0],6)

    def test_insufficient_stock_leaves_all_tables_unchanged(self):
        tables = ('Vendas','Itens_Venda','Movimentacoes','Produtos')
        before = [self.query('SELECT * FROM '+t) for t in tables]
        response = self.checkout(quantities=['1','999'])
        self.assertEqual(response.status_code,200)
        self.assertIn('Estoque insuficiente',response.get_data(as_text=True))
        self.assertEqual(before,[self.query('SELECT * FROM '+t) for t in tables])

    def test_late_database_failure_reverts_header_items_stock_and_audit(self):
        conn = get_connection()
        conn.cursor().execute(f'''CREATE TRIGGER falha_teste BEFORE INSERT ON Itens_Venda
            WHEN NEW.produto_id={self.ids[1]} BEGIN SELECT RAISE(ABORT,'Falha proposital'); END''')
        conn.commit()
        conn.close()
        tables = ('Vendas','Itens_Venda','Movimentacoes','Produtos')
        before = [self.query('SELECT * FROM '+t) for t in tables]
        self.assertEqual(self.checkout().status_code,200)
        self.assertEqual(before,[self.query('SELECT * FROM '+t) for t in tables])

    def test_cancellation_restores_stock_exactly_once(self):
        before = self.query('SELECT estoque_atual FROM Produtos ORDER BY id_produto')
        response = self.checkout()
        sale_id = int(response.location.rsplit('/',1)[1])
        manager = self.client(manager=True)
        for _ in range(2):
            self.assertEqual(manager.post(f'/vendas/{sale_id}/cancelar',data={'csrf_token':'token'}).status_code,302)
        self.assertEqual(before,self.query('SELECT estoque_atual FROM Produtos ORDER BY id_produto'))
        self.assertEqual(self.query('SELECT status_venda FROM Vendas WHERE id=?',sale_id)[0][0],'CANCELADA')
        self.assertEqual(self.query("SELECT COUNT(*) FROM Movimentacoes WHERE venda_id=? AND tipo='Entrada'",sale_id)[0][0],2)

    def test_two_checkouts_cannot_sell_last_unit_twice(self):
        conn = get_connection()
        conn.cursor().execute('UPDATE Produtos SET estoque_atual=1 WHERE id_produto=?',self.ids[0])
        conn.commit()
        conn.close()
        barrier = threading.Barrier(2)
        def buy():
            client = self.client()
            barrier.wait(timeout=5)
            return self.checkout(client, quantities=['1'],ids=[self.ids[0]]).status_code
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(lambda _:buy(),range(2)))
        self.assertEqual(sorted(results),[200,302])
        self.assertEqual(self.query('SELECT estoque_atual FROM Produtos WHERE id_produto=?',self.ids[0])[0][0],0)
        self.assertEqual(self.query('SELECT COUNT(*) FROM Vendas')[0][0],3)

    def test_demo_seed_is_idempotent(self):
        tables = ('Produtos','Vendas','Itens_Venda','Movimentacoes')
        before = [self.query('SELECT * FROM '+t) for t in tables]
        seed_sqlite_demo()
        self.assertEqual(before,[self.query('SELECT * FROM '+t) for t in tables])

    def test_foreign_keys_and_positive_quantities(self):
        conn = get_connection()
        try:
            with self.assertRaises(pyodbc.IntegrityError):
                conn.cursor().execute('INSERT INTO Itens_Venda(venda_id,produto_id,quantidade_vendida,preco_unitario_praticado,subtotal_item,produto_nome,classificacao) VALUES(1,?,0,10,0,?,?)',self.ids[0],'Inválido','Hardware')
            with self.assertRaises(pyodbc.IntegrityError):
                conn.cursor().execute('INSERT INTO Vendas(numero_pedido,cliente_nome,cliente_documento,forma_pagamento,valor_total,usuario_id) VALUES(?,?,?,?,?,?)','FK-TEST','Cliente','123','PIX',10,999999)
        finally:
            conn.rollback()
            conn.close()

    def test_all_manager_pages_and_receipts_render(self):
        manager = self.client(manager=True)
        for page in ('/', '/pdv', '/vendas', '/movimentacoes', '/cadastros', '/produtos/novo'):
            with self.subTest(page=page):
                self.assertEqual(manager.get(page).status_code, 200)
        for (sale_id,) in self.query('SELECT id FROM Vendas'):
            self.assertEqual(manager.get(f'/vendas/{sale_id}').status_code, 200)
        conn = get_connection()
        conn.cursor().execute("UPDATE Movimentacoes SET data_movimentacao='2026-11-11 15:30:00' WHERE id_movimentacao=1")
        conn.commit()
        conn.close()
        self.assertIn('11/11/2026 15:30', manager.get('/movimentacoes').get_data(as_text=True))

    def test_manual_entry_exit_and_insufficient_stock(self):
        manager = self.client(manager=True)
        pid = self.ids[0]
        before = self.query('SELECT estoque_atual FROM Produtos WHERE id_produto=?', pid)[0][0]
        for tipo, quantidade, saldo in (('Entrada',3,before+3), ('Saida',2,before+1)):
            response = manager.post('/movimentacoes', data={
                'csrf_token':'token', 'id_produto':pid, 'tipo':tipo,
                'quantidade':quantidade, 'observacao':'Teste manual'}, follow_redirects=True)
            self.assertEqual(response.status_code,200)
            self.assertIn('Movimentação registrada',response.get_data(as_text=True))
            self.assertEqual(self.query('SELECT estoque_atual FROM Produtos WHERE id_produto=?',pid)[0][0],saldo)
        audit = self.query("SELECT tipo,quantidade,usuario_id,venda_id FROM Movimentacoes WHERE observacao='Teste manual' ORDER BY id_movimentacao")
        self.assertEqual(audit,[('Entrada',3,self.manager,None),('Saida',2,self.manager,None)])
        before_tables = [self.query('SELECT * FROM '+table) for table in ('Produtos','Movimentacoes')]
        response = manager.post('/movimentacoes', data={
            'csrf_token':'token','id_produto':pid,'tipo':'Saida','quantidade':999}, follow_redirects=True)
        self.assertEqual(response.status_code,200)
        self.assertIn('Estoque insuficiente',response.get_data(as_text=True))
        self.assertEqual(before_tables,[self.query('SELECT * FROM '+table) for table in ('Produtos','Movimentacoes')])

    def test_datetime_filter_accepts_both_database_types(self):
        from datetime import datetime
        from app import formatar_data_hora
        expected = '11/11/2026 15:30'
        self.assertEqual(formatar_data_hora('2026-11-11 15:30:00'),expected)
        self.assertEqual(formatar_data_hora(datetime(2026,11,11,15,30)),expected)
        self.assertEqual(formatar_data_hora(None),'—')
        self.assertEqual(formatar_data_hora('data antiga inválida'),'data antiga inválida')


if __name__ == '__main__':
    unittest.main()

import unittest
from decimal import Decimal
from unittest.mock import patch
from app import app


class Cursor:
    def __init__(self, stock=5, fail_item=False):
        self.stock = stock
        self.fail_item = fail_item
        self.description = []
        self.result = []
        self.writes = []

    def execute(self, sql, *args):
        self.writes.append((sql, args))
        if 'FROM Usuarios' in sql:
            self.description = [('id',), ('nome_completo',), ('perfil_acesso',)]
            self.result = [(1, 'Operador', 'OPERADOR')]
        elif 'SELECT nome, preco_venda' in sql:
            self.result = [('Produto', Decimal('10.50'), self.stock)]
        elif 'OUTPUT INSERTED.id' in sql:
            self.result = [(77,)]
        elif sql.startswith('INSERT INTO Itens_Venda') and self.fail_item:
            import pyodbc
            raise pyodbc.Error('Falha simulada na gravação')
        elif 'FROM Produtos WHERE ativo' in sql:
            self.description = [('id_produto',), ('nome',)]
            self.result = []
        return self

    def fetchone(self):
        return self.result[0] if self.result else None

    def fetchall(self):
        return self.result


class Connection:
    def __init__(self, **kwargs):
        self.cur = Cursor(**kwargs)
        self.commits = self.rollbacks = 0

    def cursor(self):
        return self.cur

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        pass


class CheckoutTest(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        self.client = app.test_client()
        with self.client.session_transaction() as session:
            session.update(usuario_id=1, csrf='test-token')

    def checkout(self, conn, **overrides):
        data = dict(csrf_token='test-token', produto_id=['1', '2'], quantidade=['2', '1'],
                    cliente_nome='Cliente', cliente_documento='000.000.000-00', forma_pagamento='PIX')
        data.update(overrides)
        with patch('app.get_connection', return_value=conn):
            return self.client.post('/pdv', data=data)

    def test_multi_item_sale_commits_with_database_prices(self):
        conn = Connection()
        response = self.checkout(conn, preco='0.01')
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.location.endswith('/vendas/77'))
        self.assertEqual(conn.commits, 1)
        inserts = [(sql, args) for sql, args in conn.cur.writes if sql.startswith('INSERT INTO Itens_Venda')]
        self.assertEqual(len(inserts), 2)
        self.assertEqual(inserts[0][1][2], Decimal('10.50'))
        self.assertTrue(any('COMMIT TRANSACTION' in sql for sql, _ in conn.cur.writes))

    def test_insufficient_stock_rolls_back(self):
        conn = Connection(stock=1)
        response = self.checkout(conn)
        self.assertEqual(response.status_code, 200)
        self.assertIn('Estoque insuficiente', response.get_data(as_text=True))
        self.assertEqual(conn.rollbacks, 1)
        self.assertEqual(conn.commits, 0)

    def test_database_failure_after_header_rolls_back(self):
        conn = Connection(fail_item=True)
        response = self.checkout(conn)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(conn.rollbacks, 1)
        self.assertEqual(conn.commits, 0)

    def test_operator_cannot_mutate_catalog_or_cancel(self):
        with patch('app.get_connection', return_value=Connection()):
            self.assertEqual(self.client.get('/produtos/novo').status_code, 403)
            self.assertEqual(self.client.post('/vendas/77/cancelar', data={'csrf_token': 'test-token'}).status_code, 403)

    def test_missing_csrf_is_rejected(self):
        self.assertEqual(self.client.post('/pdv').status_code, 400)

    def test_anonymous_requires_login(self):
        with self.client.session_transaction() as session:
            session.clear()
        self.assertEqual(self.client.get('/pdv').status_code, 302)


if __name__ == '__main__':
    unittest.main()

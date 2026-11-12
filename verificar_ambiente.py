"""Diagnóstico somente de leitura: python verificar_ambiente.py."""
import os
import sys
import pyodbc
from db import get_connection, database_engine, sqlite_path

print('Python:', sys.version.split()[0])
print('Drivers ODBC:', ', '.join(pyodbc.drivers()) or 'nenhum')
driver = os.environ.get('DB_DRIVER', 'ODBC Driver 18 for SQL Server')
print('Banco configurado:', database_engine())
if database_engine() == 'sqlite':
    print('Arquivo:', sqlite_path())
if database_engine() == 'sqlserver' and driver not in pyodbc.drivers():
    print(f'PENDENTE: instalar {driver} na mesma arquitetura do Python.')
    raise SystemExit(1)
try:
    conn = get_connection()
    try:
        cur = conn.cursor()
        for table in ('Categorias','Fornecedores','Produtos','Movimentacoes','Usuarios','Vendas','Itens_Venda'):
            cur.execute('SELECT COUNT(*) FROM ' + table)
            print(f'OK: {table}: {cur.fetchone()[0]} registro(s)')
    finally:
        conn.close()
except pyodbc.Error as exc:
    print('PENDENTE: conferir serviço SQL Server, banco e permissões Windows.')
    print(str(exc))
    raise SystemExit(1)

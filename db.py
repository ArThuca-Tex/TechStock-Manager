"""SQLite local por padrão; DB_ENGINE=sqlserver mantém a integração ODBC."""
import os
import re
import sqlite3
from decimal import Decimal
from pathlib import Path
import threading
import pyodbc
from werkzeug.security import generate_password_hash

ROOT = Path(__file__).resolve().parent
_initialized = set()
_init_lock = threading.Lock()


def database_engine():
    engine = os.environ.get('DB_ENGINE', 'sqlite').lower()
    if engine not in ('sqlite', 'sqlserver'):
        raise ValueError('DB_ENGINE deve ser sqlite ou sqlserver.')
    return engine


def sqlite_path():
    return Path(os.environ.get('SQLITE_PATH', str(ROOT / 'techstock.db'))).resolve()


def initialize_sqlite():
    path = sqlite_path()
    with _init_lock:
        if path in _initialized and path.exists():
            return
        conn = sqlite3.connect(path, timeout=15)
        try:
            conn.execute('PRAGMA foreign_keys=ON')
            conn.executescript((ROOT / 'database/schema_sqlite.sql').read_text(encoding='utf-8-sig'))
            conn.execute('BEGIN IMMEDIATE')
            columns = {row[1] for row in conn.execute('PRAGMA table_info(Movimentacoes)')}
            for column, table in (('usuario_id', 'Usuarios'), ('venda_id', 'Vendas')):
                if column not in columns:
                    conn.execute(f'ALTER TABLE Movimentacoes ADD COLUMN {column} INTEGER REFERENCES {table}(id)')
            for email, name, role, password in (
                ('operador@techstore.com', 'Operador de demonstração', 'OPERADOR', 'Operador@123'),
                ('gerente@techstore.com', 'Gerente de demonstração', 'GERENTE', 'Gerente@123'),
            ):
                if not conn.execute('SELECT 1 FROM Usuarios WHERE email=?', (email,)).fetchone():
                    conn.execute('INSERT INTO Usuarios(nome_completo,email,senha_hash,perfil_acesso) VALUES(?,?,?,?)',
                                 (name, email, generate_password_hash(password), role))
            conn.commit()
            _initialized.add(path)
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


class SQLiteCursor:
    """Adapta somente os recursos SQL Server usados nas consultas do app."""
    def __init__(self, cursor):
        self.cursor = cursor

    @property
    def description(self):
        return self.cursor.description

    def execute(self, sql, *parameters):
        sql = re.sub(r'WITH\s*\(UPDLOCK,\s*(?:HOLDLOCK|ROWLOCK)\)', '', sql, flags=re.I)
        sql = sql.replace('SYSDATETIME()', "datetime('now','localtime')")
        if 'SET XACT_ABORT ON; BEGIN TRANSACTION' in sql:
            sql = 'BEGIN IMMEDIATE'
        if 'OUTPUT INSERTED.id' in sql:
            sql = sql.replace('OUTPUT INSERTED.id', '').strip() + ' RETURNING id'
        try:
            self.cursor.execute(sql, tuple(str(value) if isinstance(value, Decimal) else value for value in parameters))
        except sqlite3.IntegrityError as exc:
            raise pyodbc.IntegrityError(str(exc)) from exc
        except sqlite3.Error as exc:
            raise pyodbc.Error(str(exc)) from exc
        return self

    def fetchone(self):
        return self.cursor.fetchone()

    def fetchall(self):
        return self.cursor.fetchall()


class SQLiteConnection:
    def __init__(self):
        initialize_sqlite()
        self.connection = sqlite3.connect(sqlite_path(), timeout=15)
        self.connection.execute('PRAGMA foreign_keys=ON')

    def cursor(self):
        return SQLiteCursor(self.connection.cursor())

    @property
    def autocommit(self):
        return not self.connection.in_transaction

    @autocommit.setter
    def autocommit(self, value):
        if not value and not self.connection.in_transaction:
            self.connection.execute('BEGIN IMMEDIATE')
        elif value and self.connection.in_transaction:
            self.connection.commit()

    def commit(self):
        self.connection.commit()

    def rollback(self):
        self.connection.rollback()

    def close(self):
        self.connection.close()


def get_connection():
    if database_engine() == 'sqlite':
        return SQLiteConnection()
    server = os.environ.get('DB_SERVER', '.\\SQLEXPRESS')
    driver = os.environ.get('DB_DRIVER', 'ODBC Driver 18 for SQL Server')
    connection_string = (
        f'DRIVER={{{driver}}};SERVER={server};'
        f"DATABASE={os.environ.get('DB_NAME', 'db_techstock')};"
        'Trusted_Connection=yes;TrustServerCertificate=yes;'
    )
    return pyodbc.connect(connection_string, timeout=5)

"""Configuração explícita do SQL Server: python preparar_banco.py [--demo]."""
import argparse
from pathlib import Path
from db import get_connection, database_engine, initialize_sqlite


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--demo', action='store_true', help='Inclui usuários e vendas fictícias de apresentação')
    args = parser.parse_args()
    if database_engine() == 'sqlite':
        initialize_sqlite()
        if args.demo:
            from demo_data import seed_sqlite_demo
            seed_sqlite_demo()
        print('SQLite preparado. Inicie com: .\\.venv\\Scripts\\python.exe app.py')
        return
    scripts = ['schema_v1.sql', 'migration_v2.sql', 'seed_usuarios.sql']
    if args.demo:
        scripts.append('seed_demo.sql')
    conn = get_connection()
    try:
        for name in scripts:
            try:
                cur = conn.cursor()
                cur.execute('SET NOCOUNT ON;\n' + (Path(__file__).parent / 'database' / name).read_text(encoding='utf-8-sig'))
                while cur.nextset():
                    pass
                conn.commit()
                print(f'OK: {name}')
            except Exception:
                conn.rollback()
                raise
    finally:
        conn.close()
    print('Banco preparado. Inicie com: .\\.venv\\Scripts\\python.exe app.py')


if __name__ == '__main__':
    main()

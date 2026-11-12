"""Servidor isolado para as capturas do relatório; não altera techstock.db."""
import os
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
os.environ['DB_ENGINE'] = 'sqlite'
os.environ['SQLITE_PATH'] = str(ROOT / 'relatorio/_work/demonstracao.db')
from app import app
from demo_data import seed_sqlite_demo
seed_sqlite_demo()
app.run(host='127.0.0.1', port=5012, debug=False, use_reloader=False)

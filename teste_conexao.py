import pyodbc

try:
    conexao = pyodbc.connect(
        "DRIVER={ODBC Driver 18 for SQL Server};"
        "SERVER=.\\SQLEXPRESS;"
        "DATABASE=db_techstock;"
        "Trusted_Connection=yes;"
        "TrustServerCertificate=yes;"
    )

    print("Conexao realizada com sucesso!")

    conexao.close()

except Exception as erro:
    print("Erro ao conectar:")
    print(erro)

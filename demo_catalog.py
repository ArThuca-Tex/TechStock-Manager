"""Catálogo fictício revisado a partir do SQLite local."""


def seed_demo_catalog(connection):
    # A inicialização chama esta função dentro de uma transação BEGIN IMMEDIATE.
    has_catalog = connection.execute("""
        SELECT EXISTS (SELECT 1 FROM Produtos)
            OR EXISTS (SELECT 1 FROM Categorias)
            OR EXISTS (SELECT 1 FROM Fornecedores)
    """).fetchone()[0]
    if has_catalog:
        return

    category_id = connection.execute(
        'INSERT INTO Categorias (nome) VALUES (?)', ('Demo TechStock',)
    ).lastrowid
    supplier_id = connection.execute(
        'INSERT INTO Fornecedores (razao_social, cnpj) VALUES (?, ?)',
        ('Fornecedor fictício TechStock', '00.000.000/0000-00'),
    ).lastrowid
    connection.executemany("""
        INSERT INTO Produtos (sku, nome, fabricante, classificacao,
            modalidade_licenciamento, preco_venda, estoque_atual, estoque_minimo,
            localizacao, id_categoria, id_fornecedor)
        VALUES (?, ?, 'Demo', ?, ?, ?, 16, 5, ?, ?, ?)
    """, (
        ('DEMO-RAM-16', 'Memória RAM 16GB', 'Hardware', None,
         '249.90', 'Prateleira A1', category_id, supplier_id),
        ('DEMO-WIN-PRO', 'Windows Pro Demo', 'Software', 'Corporativa',
         '399.90', 'Cofre digital', category_id, supplier_id),
    ))

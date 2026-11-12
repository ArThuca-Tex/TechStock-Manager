PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS Categorias (
 id_categoria INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS Fornecedores (
 id_fornecedor INTEGER PRIMARY KEY AUTOINCREMENT, razao_social TEXT NOT NULL,
 cnpj TEXT UNIQUE, telefone TEXT, email TEXT
);
CREATE TABLE IF NOT EXISTS Produtos (
 id_produto INTEGER PRIMARY KEY AUTOINCREMENT, sku TEXT NOT NULL UNIQUE,
 nome TEXT NOT NULL, fabricante TEXT NOT NULL,
 classificacao TEXT NOT NULL CHECK(classificacao IN ('Hardware','Software','Periférico')),
 especificacao TEXT, modalidade_licenciamento TEXT,
 preco_venda NUMERIC NOT NULL CHECK(preco_venda > 0),
 estoque_atual INTEGER NOT NULL DEFAULT 0 CHECK(estoque_atual >= 0),
 estoque_minimo INTEGER NOT NULL DEFAULT 0 CHECK(estoque_minimo >= 0),
 localizacao TEXT NOT NULL, id_categoria INTEGER NOT NULL REFERENCES Categorias(id_categoria),
 id_fornecedor INTEGER NOT NULL REFERENCES Fornecedores(id_fornecedor),
 ativo INTEGER NOT NULL DEFAULT 1 CHECK(ativo IN (0,1))
);
CREATE TABLE IF NOT EXISTS Usuarios (
 id INTEGER PRIMARY KEY AUTOINCREMENT, nome_completo TEXT NOT NULL,
 email TEXT NOT NULL COLLATE NOCASE UNIQUE, senha_hash TEXT NOT NULL,
 perfil_acesso TEXT NOT NULL CHECK(perfil_acesso IN ('OPERADOR','GERENTE')),
 status TEXT NOT NULL DEFAULT 'ATIVO' CHECK(status IN ('ATIVO','INATIVO'))
);
CREATE TABLE IF NOT EXISTS Vendas (
 id INTEGER PRIMARY KEY AUTOINCREMENT, numero_pedido TEXT NOT NULL UNIQUE,
 data_hora TEXT NOT NULL DEFAULT (datetime('now','localtime')),
 cliente_nome TEXT NOT NULL, cliente_documento TEXT NOT NULL,
 forma_pagamento TEXT NOT NULL CHECK(forma_pagamento IN ('PIX','CARTAO_CREDITO','BOLETO_FATURADO')),
 valor_total NUMERIC NOT NULL CHECK(valor_total > 0),
 status_venda TEXT NOT NULL DEFAULT 'CONCLUIDA' CHECK(status_venda IN ('CONCLUIDA','CANCELADA')),
 usuario_id INTEGER NOT NULL REFERENCES Usuarios(id),
 cancelado_por INTEGER REFERENCES Usuarios(id), cancelado_em TEXT
);
CREATE TABLE IF NOT EXISTS Itens_Venda (
 id INTEGER PRIMARY KEY AUTOINCREMENT, venda_id INTEGER NOT NULL REFERENCES Vendas(id),
 produto_id INTEGER NOT NULL REFERENCES Produtos(id_produto),
 quantidade_vendida INTEGER NOT NULL CHECK(quantidade_vendida > 0 AND typeof(quantidade_vendida)='integer'),
 preco_unitario_praticado NUMERIC NOT NULL CHECK(preco_unitario_praticado > 0),
 subtotal_item NUMERIC NOT NULL CHECK(round(subtotal_item*100)=round(quantidade_vendida*preco_unitario_praticado*100)),
 produto_nome TEXT NOT NULL, classificacao TEXT NOT NULL, UNIQUE(venda_id,produto_id)
);
CREATE TABLE IF NOT EXISTS Movimentacoes (
 id_movimentacao INTEGER PRIMARY KEY AUTOINCREMENT, tipo TEXT NOT NULL CHECK(tipo IN ('Entrada','Saida')),
 quantidade INTEGER NOT NULL CHECK(quantidade > 0),
 data_movimentacao TEXT NOT NULL DEFAULT (datetime('now','localtime')),
 observacao TEXT, id_produto INTEGER NOT NULL REFERENCES Produtos(id_produto),
 usuario_id INTEGER REFERENCES Usuarios(id), venda_id INTEGER REFERENCES Vendas(id)
);
CREATE INDEX IF NOT EXISTS idx_itens_venda ON Itens_Venda(venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_usuario ON Vendas(usuario_id);

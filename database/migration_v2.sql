SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID('Usuarios') IS NULL
CREATE TABLE Usuarios (
 id INT IDENTITY PRIMARY KEY, nome_completo NVARCHAR(160) NOT NULL,
 email VARCHAR(254) NOT NULL UNIQUE, senha_hash VARCHAR(512) NOT NULL,
 perfil_acesso VARCHAR(10) NOT NULL CHECK (perfil_acesso IN ('OPERADOR','GERENTE')),
 status VARCHAR(7) NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO','INATIVO'))
);
IF OBJECT_ID('Vendas') IS NULL
CREATE TABLE Vendas (
 id INT IDENTITY PRIMARY KEY, numero_pedido VARCHAR(40) NOT NULL UNIQUE,
 data_hora DATETIME2 NOT NULL DEFAULT SYSDATETIME(), cliente_nome NVARCHAR(160) NOT NULL,
 cliente_documento VARCHAR(18) NOT NULL,
 forma_pagamento VARCHAR(20) NOT NULL CHECK (forma_pagamento IN ('PIX','CARTAO_CREDITO','BOLETO_FATURADO')),
 valor_total DECIMAL(18,2) NOT NULL CHECK (valor_total > 0),
 status_venda VARCHAR(10) NOT NULL DEFAULT 'CONCLUIDA' CHECK (status_venda IN ('CONCLUIDA','CANCELADA')),
 usuario_id INT NOT NULL REFERENCES Usuarios(id),
 cancelado_por INT NULL REFERENCES Usuarios(id), cancelado_em DATETIME2 NULL
);
IF OBJECT_ID('Itens_Venda') IS NULL
CREATE TABLE Itens_Venda (
 id INT IDENTITY PRIMARY KEY, venda_id INT NOT NULL REFERENCES Vendas(id),
 produto_id INT NOT NULL REFERENCES Produtos(id_produto),
 quantidade_vendida INT NOT NULL CHECK (quantidade_vendida > 0),
 preco_unitario_praticado DECIMAL(18,2) NOT NULL CHECK (preco_unitario_praticado > 0),
 subtotal_item DECIMAL(18,2) NOT NULL,
 produto_nome NVARCHAR(160) NOT NULL, classificacao NVARCHAR(30) NOT NULL,
 CHECK (subtotal_item = quantidade_vendida * preco_unitario_praticado), UNIQUE(venda_id, produto_id)
);
IF COL_LENGTH('Movimentacoes', 'usuario_id') IS NULL
 ALTER TABLE Movimentacoes ADD usuario_id INT NULL REFERENCES Usuarios(id);
IF COL_LENGTH('Movimentacoes', 'venda_id') IS NULL
 ALTER TABLE Movimentacoes ADD venda_id INT NULL REFERENCES Vendas(id);
COMMIT TRANSACTION;

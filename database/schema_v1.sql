SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID('Categorias', 'U') IS NULL
CREATE TABLE Categorias (
 id_categoria INT IDENTITY PRIMARY KEY,
 nome NVARCHAR(20) NOT NULL UNIQUE
);
IF OBJECT_ID('Fornecedores', 'U') IS NULL
CREATE TABLE Fornecedores (
 id_fornecedor INT IDENTITY PRIMARY KEY,
 razao_social NVARCHAR(160) NOT NULL,
 cnpj VARCHAR(18) NULL UNIQUE,
 telefone VARCHAR(30) NULL, email VARCHAR(254) NULL
);
IF OBJECT_ID('Produtos', 'U') IS NULL
CREATE TABLE Produtos (
 id_produto INT IDENTITY PRIMARY KEY, sku VARCHAR(20) NOT NULL UNIQUE,
 nome NVARCHAR(20) NOT NULL, fabricante NVARCHAR(20) NOT NULL,
 classificacao NVARCHAR(30) NOT NULL CHECK(classificacao IN (N'Hardware',N'Software',N'Periférico')),
 especificacao NVARCHAR(20) NULL, modalidade_licenciamento NVARCHAR(20) NULL,
 preco_venda DECIMAL(18,2) NOT NULL CHECK(preco_venda > 0),
 estoque_atual INT NOT NULL DEFAULT 0 CHECK(estoque_atual >= 0),
 estoque_minimo INT NOT NULL DEFAULT 0 CHECK(estoque_minimo >= 0),
 localizacao NVARCHAR(20) NOT NULL,
 id_categoria INT NOT NULL REFERENCES Categorias(id_categoria),
 id_fornecedor INT NOT NULL REFERENCES Fornecedores(id_fornecedor),
 ativo BIT NOT NULL DEFAULT 1,
 CHECK(classificacao <> N'Software' OR NULLIF(modalidade_licenciamento, '') IS NOT NULL)
);
IF OBJECT_ID('Movimentacoes', 'U') IS NULL
CREATE TABLE Movimentacoes (
 id_movimentacao INT IDENTITY PRIMARY KEY,
 tipo VARCHAR(7) NOT NULL CHECK(tipo IN ('Entrada','Saida')),
 quantidade INT NOT NULL CHECK(quantidade > 0),
 data_movimentacao DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
 observacao NVARCHAR(500) NULL,
 id_produto INT NOT NULL REFERENCES Produtos(id_produto)
);
COMMIT TRANSACTION;

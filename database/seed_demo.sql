-- Dados fictícios para apresentação: duas vendas com hardware e licença.
-- Não substitui cadastros existentes. Execute depois da migração e dos usuários.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @categoria INT, @fornecedor INT, @operador INT, @hardware INT, @software INT;
SELECT @operador=id FROM Usuarios WHERE email='operador@techstore.com';
IF @operador IS NULL THROW 50001, 'Execute seed_usuarios.sql antes da demonstração.', 1;
IF NOT EXISTS(SELECT 1 FROM Categorias WHERE nome=N'Demo TechStock')
 INSERT INTO Categorias(nome) VALUES(N'Demo TechStock');
SELECT @categoria=id_categoria FROM Categorias WHERE nome=N'Demo TechStock';
IF NOT EXISTS(SELECT 1 FROM Fornecedores WHERE cnpj='00.000.000/0000-00')
 INSERT INTO Fornecedores(razao_social,cnpj) VALUES(N'Fornecedor fictício TechStock','00.000.000/0000-00');
SELECT @fornecedor=id_fornecedor FROM Fornecedores WHERE cnpj='00.000.000/0000-00';
IF NOT EXISTS(SELECT 1 FROM Produtos WHERE sku='DEMO-RAM-16')
BEGIN
 INSERT INTO Produtos(sku,nome,fabricante,classificacao,especificacao,preco_venda,estoque_atual,estoque_minimo,localizacao,id_categoria,id_fornecedor)
 VALUES('DEMO-RAM-16',N'Memória RAM 16GB',N'Demo',N'Hardware',N'DDR4 3200MHz',249.90,20,5,N'Prateleira A1',@categoria,@fornecedor);
 SET @hardware=SCOPE_IDENTITY();
 INSERT INTO Movimentacoes(tipo,quantidade,observacao,id_produto,usuario_id) VALUES('Entrada',20,N'Carga demo',@hardware,@operador);
END;
IF NOT EXISTS(SELECT 1 FROM Produtos WHERE sku='DEMO-WIN-PRO')
BEGIN
 INSERT INTO Produtos(sku,nome,fabricante,classificacao,especificacao,modalidade_licenciamento,preco_venda,estoque_atual,estoque_minimo,localizacao,id_categoria,id_fornecedor)
 VALUES('DEMO-WIN-PRO',N'Windows Pro Demo',N'Demo',N'Software',N'Licença fictícia',N'Corporativa',399.90,20,5,N'Cofre digital',@categoria,@fornecedor);
 SET @software=SCOPE_IDENTITY();
 INSERT INTO Movimentacoes(tipo,quantidade,observacao,id_produto,usuario_id) VALUES('Entrada',20,N'Carga demo',@software,@operador);
END;
SELECT @hardware=id_produto FROM Produtos WHERE sku='DEMO-RAM-16';
SELECT @software=id_produto FROM Produtos WHERE sku='DEMO-WIN-PRO';
DECLARE @n INT=2, @pedido VARCHAR(40), @venda INT;
WHILE @n<=3
BEGIN
 SET @pedido=CONCAT('TS-DEMO-00',@n);
 IF NOT EXISTS(SELECT 1 FROM Vendas WITH(UPDLOCK,HOLDLOCK) WHERE numero_pedido=@pedido)
 BEGIN
  IF EXISTS(SELECT 1 FROM Produtos WITH(UPDLOCK,HOLDLOCK) WHERE id_produto IN(@hardware,@software) AND (estoque_atual<2 OR ativo=0))
   THROW 50002, 'Produtos de demonstração sem saldo ou inativos. Operação revertida.', 1;
  INSERT INTO Vendas(numero_pedido,cliente_nome,cliente_documento,forma_pagamento,valor_total,usuario_id)
  SELECT @pedido,N'Empresa fictícia de teste','00.000.000/0000-00',CASE WHEN @n=2 THEN 'PIX' ELSE 'BOLETO_FATURADO' END,SUM(preco_venda*2),@operador
  FROM Produtos WHERE id_produto IN(@hardware,@software);
  SET @venda=SCOPE_IDENTITY();
  INSERT INTO Itens_Venda(venda_id,produto_id,quantidade_vendida,preco_unitario_praticado,subtotal_item,produto_nome,classificacao)
  SELECT @venda,id_produto,2,preco_venda,preco_venda*2,nome,classificacao FROM Produtos WHERE id_produto IN(@hardware,@software);
  UPDATE Produtos SET estoque_atual=estoque_atual-2 WHERE id_produto IN(@hardware,@software);
  INSERT INTO Movimentacoes(tipo,quantidade,observacao,id_produto,usuario_id,venda_id)
  SELECT 'Saida',2,N'Venda demo',id_produto,@operador,@venda FROM Produtos WHERE id_produto IN(@hardware,@software);
 END;
 SET @n=@n+1;
END;
COMMIT TRANSACTION;

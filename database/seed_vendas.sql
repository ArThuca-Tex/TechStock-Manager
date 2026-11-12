-- Execute após migration_v2.sql e seed_usuarios.sql. Usa um produto ativo existente.
-- Registra uma venda real de demonstração, com baixa e auditoria atômicas.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF NOT EXISTS (SELECT 1 FROM Vendas WHERE numero_pedido = 'TS-DEMO-001')
BEGIN
 DECLARE @pid INT, @preco DECIMAL(18,2), @nome NVARCHAR(160), @tipo NVARCHAR(30), @uid INT, @vid INT;
 SELECT TOP (1) @pid=id_produto, @preco=preco_venda, @nome=nome, @tipo=classificacao
 FROM Produtos WITH (UPDLOCK,HOLDLOCK) WHERE ativo=1 AND estoque_atual>=1 AND preco_venda>0 ORDER BY id_produto;
 SELECT @uid=id FROM Usuarios WHERE email='operador@techstore.com';
 IF @pid IS NULL OR @uid IS NULL THROW 50001, 'Cadastre um produto com saldo e execute seed_usuarios.sql antes da demonstração.', 1;
 INSERT INTO Vendas(numero_pedido,cliente_nome,cliente_documento,forma_pagamento,valor_total,usuario_id)
 VALUES('TS-DEMO-001',N'Cliente de demonstração','000.000.000-00','PIX',@preco,@uid);
 SET @vid=SCOPE_IDENTITY();
 INSERT INTO Itens_Venda(venda_id,produto_id,quantidade_vendida,preco_unitario_praticado,subtotal_item,produto_nome,classificacao)
 VALUES(@vid,@pid,1,@preco,@preco,@nome,@tipo);
 UPDATE Produtos SET estoque_atual=estoque_atual-1 WHERE id_produto=@pid;
 INSERT INTO Movimentacoes(tipo,quantidade,observacao,id_produto,usuario_id,venda_id) VALUES('Saida',1,'Demo',@pid,@uid,@vid);
END;
COMMIT TRANSACTION;

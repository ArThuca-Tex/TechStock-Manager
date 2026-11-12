-- Apenas demonstra??o local. Troque as senhas antes de disponibilizar o sistema.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF NOT EXISTS (SELECT 1 FROM Usuarios WHERE email = 'operador@techstore.com')
 INSERT INTO Usuarios (nome_completo,email,senha_hash,perfil_acesso) VALUES (N'Operador de demonstra??o','operador@techstore.com','pbkdf2:sha256:600000$61012b55e2d59f8903eb14154170bb69$bb8d4f519efae4a2d572e082841a5cf1550f4ad1bfff2db992de8779753015c0','OPERADOR');
IF NOT EXISTS (SELECT 1 FROM Usuarios WHERE email = 'gerente@techstore.com')
 INSERT INTO Usuarios (nome_completo,email,senha_hash,perfil_acesso) VALUES (N'Gerente de demonstra??o','gerente@techstore.com','pbkdf2:sha256:600000$5ce2eb6b578b9d684d20637daaae90a1$496d7686c47ad22bb69bc1f41b8870bdf472c12d9b7c3d0ebdb03e94022990e4','GERENTE');
COMMIT TRANSACTION;

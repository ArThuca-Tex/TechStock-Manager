# TechStock Manager

Inventário, frente de caixa multi-itens e recibos para a demanda #2026-INV05, em Python e Flask. **Funciona com SQLite por padrão, sem instalar SQL Express, driver ODBC ou serviço de banco.** A integração com SQL Server continua disponível.

## Executar sem SQL Express

No terminal da pasta do projeto:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe preparar_banco.py --demo
.\.venv\Scripts\python.exe app.py
```

Se o ambiente já está instalado, basta o último comando. Abra http://127.0.0.1:5000. Para encerrar, Ctrl+C. Após mudanças no projeto, reinicie o processo; com debug desligado os templates podem ficar na memória. O CSS tem versão automática para atualizar o cache.

O arquivo `techstock.db` fica na pasta do projeto. As tabelas ausentes e os dois usuários iniciais são criados automaticamente no primeiro acesso ao banco. Tabelas e dados existentes são preservados; a auditoria legada recebe os vínculos opcionais de usuário e venda. `preparar_banco.py --demo` acrescenta produtos fictícios e duas vendas com hardware e licença, registrando entradas e saídas. Repetir não duplica os pedidos de demonstração. Não apague o arquivo para reiniciar o site: ele contém os dados.

Alternativa de inicialização: `powershell -ExecutionPolicy Bypass -File .\iniciar.ps1`. Para outra porta: acrescente `-Porta 5001` e abra http://127.0.0.1:5001.

## Usuários de demonstração

| Perfil | E-mail | Senha inicial |
| --- | --- | --- |
| Operador | operador@techstore.com | Operador@123 |
| Gerente | gerente@techstore.com | Gerente@123 |

As senhas são armazenadas como hashes seguros do Werkzeug, nunca em texto no banco. As credenciais acima são exclusivas da demonstração e devem ser trocadas antes de disponibilizar o sistema. Não há cadastro público. Usuários INATIVOS não conseguem operar; o status e o perfil são conferidos no banco a cada requisição.

## Requisitos da atividade

- **REQ-01 — Modelo relacional:** Categorias, Fornecedores, Produtos e Movimentacoes preservados; Usuarios, Vendas e Itens_Venda adicionados com PK/FK, identificador único de pedido, CHECKs e preço congelado nos itens. Nome e classificação também ficam congelados para manter o recibo histórico.
- **REQ-02 — Segurança:** login, hash, sessão persistente de até oito horas, CSRF nos formulários POST e bloqueio de rotas no servidor. Operador consulta catálogo, registra vendas e emite seus recibos. Gerente também acessa cadastros, preços, movimentações, todos os pedidos, indicadores financeiros e cancelamento.
- **REQ-03 — PDV:** busca de produtos, carrinho multi-itens, edição de quantidades, remoção e subtotais automáticos. O servidor usa Decimal e recalcula os valores a partir do banco. O navegador usa centavos inteiros na apresentação.
- **REQ-04 — Atomicidade:** venda, itens, estoque e auditoria são confirmados juntos ou revertidos juntos. No SQLite, `BEGIN IMMEDIATE` serializa os escritores antes da leitura do saldo, e cada conexão habilita FKs. No SQL Server, `BEGIN TRANSACTION` e bloqueios `UPDLOCK, HOLDLOCK` protegem os produtos na ordem dos IDs. Cancelamento também é transacional e não permite estorno repetido.
- **REQ-05 — Recibo e UX:** cliente, operador, data/hora, pedido, pagamento, itens, tipos físico/digital e total, com impressão limpa e tratamento visual dos erros. A chave do comprovante é o número único do pedido para conferência interna. Não há serviço público de verificação e o recibo não substitui nota fiscal.

O carrinho fica temporariamente no sessionStorage da aba para corrigir erros sem perder os itens; um recibo concluído o limpa. A busca do inventário filtra produtos por seu conteúdo visível.

## Arquivos de banco

| Arquivo | Finalidade |
| --- | --- |
| `database/schema_sqlite.sql` | Esquema local SQLite completo |
| `demo_data.py` | Carga transacional e idempotente de demonstração SQLite |
| `database/schema_v1.sql` | Tabelas legadas para SQL Server novo |
| `database/migration_v2.sql` | Expansão evolutiva SQL Server |
| `database/seed_usuarios.sql` | Dois usuários para SQL Server, hash PBKDF2-SHA256 |
| `database/seed_demo.sql` | Duas vendas multi-itens fictícias para SQL Server |
| `database/seed_vendas.sql` | Exemplo opcional de venda de um item existente no SQL Server |

## Configuração opcional

Variáveis são lidas do ambiente do processo. `.env.example` é referência e não é carregado automaticamente.

```powershell
$env:DB_ENGINE = 'sqlite'
$env:SECRET_KEY = 'substitua-por-uma-chave-longa-aleatoria-e-estavel'
```

Opcionalmente `SQLITE_PATH` aponta para outro arquivo de banco. Sem SECRET_KEY uma chave temporária é criada e reiniciar o processo encerra as sessões. Em HTTPS use COOKIE_SECURE=1; debug só com FLASK_DEBUG=1 em desenvolvimento. Data/hora do SQLite usa o horário local do computador; SQL Server usa o horário do servidor.

## Usar SQL Server em vez de SQLite

Este modo exige SQL Server, banco `db_techstock`, ODBC Driver 18 e permissão da conta Windows. No SSMS, crie o banco se necessário com `CREATE DATABASE db_techstock;`. Depois:

```powershell
$env:DB_ENGINE = 'sqlserver'
$env:DB_SERVER = '.\SQLEXPRESS'
$env:DB_NAME = 'db_techstock'
$env:DB_DRIVER = 'ODBC Driver 18 for SQL Server'
.\.venv\Scripts\python.exe preparar_banco.py --demo
.\.venv\Scripts\python.exe app.py
```

Nesse modo o preparador executa schema_v1, migration_v2, seed_usuarios e, com --demo, seed_demo. Cada script é confirmado separadamente. É possível executar os arquivos nessa mesma ordem pelo SSMS. Não há conversão automática de dados entre SQLite e SQL Server: são bancos independentes. Para voltar ao arquivo local, defina DB_ENGINE=sqlite e reinicie.

## Verificação

```powershell
.\.venv\Scripts\python.exe verificar_ambiente.py
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

O diagnóstico pode inicializar o esquema SQLite se necessário. Os testes de integração usam arquivos temporários e não alteram o banco do usuário.

**14 testes aprovados:** seis com conexão simulada e oito com SQLite real, incluindo login e hash, permissões, consulta das telas, venda multi-itens, recibo, FKs, quantidades positivas, estorno único e carga idempotente. Dois testes importantes comparam as quatro tabelas após falhas: falta de saldo e erro de banco induzido por trigger depois do início da gravação. O teste concorrente tenta vender a última unidade em duas conexões: só uma conclui. Templates e sintaxe JavaScript também foram conferidos.

O banco local da demonstração foi preparado com dois usuários, dois produtos e duas vendas multi-itens. O backend SQL Server foi preservado, mas não foi validado contra servidor real neste computador. A aparência no navegador e a impressão ainda precisam de conferência manual.

## Antes de entregar

- [x] Código, esquema relacional, migração SQL Server e esquema SQLite.
- [x] Dois perfis com hash, sessões e controle de acesso.
- [x] Carrinho, checkout, cancelamento e recibo.
- [x] Dados fictícios com vendas multi-itens e auditoria.
- [x] Testes reais de atomicidade, falha tardia e concorrência no SQLite.
- [x] Documentação e .gitignore para ambientes, bancos locais e segredos.
- [ ] Conferir impressão, telas pequenas e fluxo completo no navegador.
- [ ] Confirmar se há orientação adicional do professor exigindo especificamente SQL Server; as imagens fornecidas pedem banco relacional e ACID sem indicar um motor obrigatório.
- [ ] Se SQL Server for exigido, instalar/configurar o ambiente e validar os scripts nesse motor.
- [ ] Enviar código, SQLs e README ao GitHub e entregar o link no Google Classroom. O banco local é ignorado: o avaliador o recria com preparar_banco.py --demo.

Corre??o de movimenta??es: a data agora passa por um filtro compartilhado que aceita texto ISO do SQLite e datetime do SQL Server, exibindo dia/m?s/ano e hora. O mesmo formato ? usado no hist?rico de vendas e no recibo.

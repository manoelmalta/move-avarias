# Acesso controlado ao Supabase — TI Negri / Power BI

Interface de dados controlada entre o MOVE AVARIAS e o time de TI da Negri
Distribuidora. O banco operacional (`public`) nunca é exposto diretamente:
tudo passa por um schema isolado, `negri_bi`, com um usuário dedicado.

## Arquitetura

```
MOVE AVARIAS (app)
      │
      ▼
Supabase / PostgreSQL 17  (projeto move-avarias, ref pyrvwrhddbbmcjyjjuip)
      │
      ├── schema public            ← dados operacionais (app, Prisma)
      │
      └── schema negri_bi          ← única porta de entrada externa
            ├── integration_config          (mapeamento client_key → clientId; admin-only)
            ├── vw_ocorrencias               (view, somente leitura)
            ├── vw_itens_ocorrencia          (view, somente leitura)
            ├── vw_produtos                  (view, somente leitura)
            ├── vw_faturamento_mensal        (view, somente leitura)
            ├── import_pedidos               (tabela, leitura/carga)
            ├── import_itinerarios           (tabela, leitura/carga)
            ├── import_produtividade         (tabela, leitura/carga)
            └── import_produtos_setor        (tabela, leitura/carga)
      │
      ▼
TI Negri / Power BI (role negri_dashboard)
```

Role `negri_dashboard`: login dedicado, sem acesso a nada fora de
`negri_bi`. Role `negri_bi_definer`: role interna (sem login) que é dona
das views e detém os únicos `GRANT SELECT` sobre as tabelas de `public`
necessárias para construí-las — `negri_dashboard` nunca recebe grant
nenhum em `public`.

Migration versionada: [`supabase/migrations/20260810180440_negri_bi_access.sql`](../../supabase/migrations/20260810180440_negri_bi_access.sql).
Fica fora de `prisma/schema.prisma` e `prisma/migrations/` deliberadamente:
`negri_bi` não é modelo de negócio da aplicação, e o histórico nativo de
migrations do Supabase neste projeto estava vazio antes desta mudança (o
Prisma aplica direto, sem passar por lá) — manter isso em
`supabase/migrations/` evita qualquer colisão com `prisma migrate`.

## Acesso permitido

| Recurso                                  | SELECT | INSERT | UPDATE | DELETE |
| ----------------------------------------- | -----: | -----: | -----: | -----: |
| `negri_bi.vw_*` (4 views)                 |    Sim |    Não |    Não |    Não |
| `negri_bi.import_*` (4 tabelas)           |    Sim |    Sim |    Sim |    Não |
| `negri_bi.integration_config`             |    Não |    Não |    Não |    Não |
| Qualquer tabela em `public`               |    Não |    Não |    Não |    Não |
| `auth`, `storage`, demais schemas         |    Não |    Não |    Não |    Não |
| `CREATE` / `DROP` / `ALTER` / `TRUNCATE`  |    Não |    Não |    Não |    Não |

Sem `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `BYPASSRLS`. Limite de 5
conexões simultâneas. `statement_timeout = 30s`,
`idle_in_transaction_session_timeout = 5min`.

## Isolamento multi-cliente

O registro existente em `public."Client"` (`id =
cmp5rpjs20000lwy49lyqyq9e`, antes "Cliente Demonstração") foi formalizado
como o cliente oficial **Negri Distribuidora** (`name = 'Negri
Distribuidora'`, `slug = 'negri'`) — mesmo `id`, mesmo histórico de
ocorrências/itens/produtos/usuários, sem migração de dados. `negri_bi.integration_config`
guarda o mapeamento `client_key = 'negri' → client_id` e está **ativa**:

```
client_key = 'negri'
client_id  = 'cmp5rpjs20000lwy49lyqyq9e'
active     = true
```

As 4 views e as 4 tabelas de import já retornam/aceitam os dados da Negri
normalmente. Enquanto `client_id IS NULL` ou `active = false` (estado
inicial, hoje superado):

- as 4 views retornariam **zero linhas**;
- as 4 tabelas de import **bloqueariam toda leitura e escrita** — validado
  na prática nos testes de segurança, com reversão controlada antes da
  ativação definitiva.

Nas tabelas de import, o isolamento é reforçado por **Row Level Security**
(tabelas novas, não as de `public`), com uma policy por tabela restringindo
`SELECT/INSERT/UPDATE` ao `client_id` resolvido para `negri_dashboard`
através da função `negri_bi.current_client_id('negri')` — uma função
`SECURITY DEFINER` estreita (uma única consulta, sem efeitos colaterais,
`search_path` fixo, dona pela role `negri_bi_definer`, não por um
superusuário) que existe só para não expor a `negri_dashboard` a tabela
`integration_config` inteira (que no futuro terá o mapeamento de outros
clientes também). Isso garante isolamento **no banco**, não só na
interface: mesmo uma query manual tentando gravar com outro `client_id`
é rejeitada pela policy — testado com uma tentativa de INSERT usando um
`client_id` diferente do configurado, que falhou com "new row violates
row-level security policy".

Quando outro cliente for cadastrado no futuro, cada integração deve
receber sua própria linha em `integration_config` (`client_key` distinto)
e, se necessário, sua própria role — o desenho já foi pensado para isso.

## Views: por que owner-rights (não SECURITY DEFINER, não security_invoker)

As views usam o modelo padrão do Postgres (dono executa, não quem chama).
Foi uma escolha deliberada, documentada no próprio SQL da migration:
`negri_dashboard` nunca pode receber `SELECT` direto em `public` — a view
precisa ser a única porta, o que exige owner-rights. Não é `SECURITY
DEFINER` (não há função, nem elevação além do modelo padrão de
privilégios de view). O risco clássico desse modelo — dono com
`BYPASSRLS` ignorando silenciosamente RLS futura — foi neutralizado
dando as views a uma role sem login e sem `BYPASSRLS` (`negri_bi_definer`)
em vez de ao `postgres`.

## Performance

- Índices `(client_id, batch_id)` criados nas 4 tabelas de import.
- `statement_timeout = 30s` e `idle_in_transaction_session_timeout = 5min`
  na role `negri_dashboard`, para o Power BI nunca segurar conexões/locks
  por muito tempo.
- Nenhuma materialized view — volume atual (496 ocorrências, 575 itens,
  1285 produtos) não justifica.
- **Achado pré-existente, fora do escopo desta mudança**:
  `public."DamageOccurrence"` e `public."DamageOccurrenceItem"` não têm
  índice em `clientId` (só chaves únicas que não começam por essa coluna).
  Irrelevante no volume atual, mas se crescer, recomenda-se um índice
  dedicado — isso exige uma migration Prisma própria (`schema.prisma` +
  `prisma/migrations/`), fora do escopo aqui por exigência do `AGENTS.md`
  (não alterar `schema.prisma`/migrations sem autorização expressa).
- O Security/Performance Advisor do Supabase não aponta nenhum problema
  novo introduzido por esta mudança (rodado após a aplicação da
  migration).

## ⚠️ Achado de segurança pré-existente (fora do escopo, reportado por exigência do Advisor)

Row Level Security está **desabilitada em todas as 14 tabelas do schema
`public`** (`Client`, `User`, `DamageOccurrence`, etc.) — isso já existia
antes desta tarefa. Se houver GRANTs abertos para `anon`/`authenticated`
(papéis usados pela Data API do Supabase), isso pode expor leitura/escrita
irrestrita a quem tiver a chave anônima. Não foi alterado aqui (fora de
escopo, e habilitar RLS sem políticas corretas quebraria a aplicação).
Recomenda-se investigar os grants atuais de `anon`/`authenticated` em uma
tarefa dedicada.

## Conexão do Power BI

PostgreSQL nativo do Power BI, via **Session Pooler / Supavisor** do
Supabase (não o host de conexão direta). Confirme os valores atuais em
Project Settings → Database → Connection string, no dashboard do Supabase
— não presumidos aqui. Em geral:

| Campo    | Valor                                                                 |
| -------- | ---------------------------------------------------------------------- |
| Host     | pooler do projeto `pyrvwrhddbbmcjyjjuip` (ver dashboard)               |
| Port     | porta do Session Pooler (ver dashboard, tipicamente 5432 ou 6543)      |
| Database | `postgres`                                                              |
| Username | `negri_dashboard.pyrvwrhddbbmcjyjjuip` (padrão Supavisor — confirmar no dashboard) |
| Password | gerada separadamente (ver seção abaixo) — **nunca** a admin/service role |
| SSL      | obrigatório                                                             |

Nunca fornecer senha administrativa, `service_role` ou secret key ao TI da
Negri.

## Procedimento para criar/rotacionar a senha

A migration criou `negri_dashboard` com `LOGIN` mas **sem senha definida**
(`rolpassword IS NULL`) — login por senha falha até um admin rodar, direto
no SQL Editor do Supabase (nunca em migration versionada, chat ou log):

```sql
ALTER ROLE negri_dashboard PASSWORD 'uma-senha-forte-e-exclusiva-aqui';
```

Para rotacionar: rode o mesmo comando com uma nova senha. Recomenda-se
gerar via gerenciador de senhas (32+ caracteres aleatórios).

## Como testar permissões

Como admin (via SQL Editor, sessão com `CREATEROLE`):

```sql
GRANT negri_dashboard TO CURRENT_USER;  -- temporário, só para o teste
BEGIN;
SET ROLE negri_dashboard;
SELECT count(*) FROM negri_bi.vw_ocorrencias;   -- deve funcionar (0 linhas até configurar o clientId)
SELECT * FROM public."DamageOccurrence" LIMIT 1; -- deve falhar: permission denied
ROLLBACK;
REVOKE negri_dashboard FROM CURRENT_USER;
```

## Como revogar o acesso imediatamente

```sql
ALTER ROLE negri_dashboard NOLOGIN;
```

Reverte com `ALTER ROLE negri_dashboard LOGIN;` quando quiser reativar.

## Como remover completamente o acesso

```sql
DROP SCHEMA negri_bi CASCADE;
DROP OWNED BY negri_dashboard CASCADE; DROP ROLE negri_dashboard;
DROP OWNED BY negri_bi_definer CASCADE; DROP ROLE negri_bi_definer;
```

## Como alterar o clientId vinculado à Negri

Só um admin interno deve rodar isso (via SQL Editor; `negri_dashboard`
não tem grant nenhum em `integration_config`):

```sql
UPDATE negri_bi.integration_config
SET client_id = '<id do Client "Negri" quando for cadastrado>', active = true, updated_at = now()
WHERE client_key = 'negri';
```

Para suspender sem perder o vínculo: `SET active = false` (mantém o
`client_id` salvo, só desliga as views/policies).

## Próximos passos

**Pronto agora:**
- Schema, role, views, tabelas de import (fundação) e isolamento por RLS
  no banco de produção.
- Cliente `Negri Distribuidora` formalizado (`id =
  cmp5rpjs20000lwy49lyqyq9e`) e `negri_bi.integration_config` ativa e
  apontando para esse `clientId`.
- Testes de segurança e de isolamento executados com sucesso, incluindo
  com a integração já ativa (views retornando os dados reais da Negri e
  bloqueios continuando a funcionar).

**Único passo pendente para a entrega ao TI da Negri:**
1. Definir a senha de `negri_dashboard` (ver procedimento acima).
2. Obter/confirmar Host e Port do Supavisor no dashboard do Supabase
   (Project Settings → Database → Connection Pooling).
3. Testar a conexão externa (Power BI / `psql`) com exatamente as mesmas
   credenciais que serão entregues ao TI, antes de repassá-las.

**Depende da definição das quatro fontes do Dashboard de Produtividade**
(pedidos, itinerário/veículo/pedido, coleta manual de produtividade,
classificação Seco/Câmara):
- Migration futura substituindo a coluna `payload jsonb` de cada
  `import_*` por colunas tipadas, uma vez que a especificação de negócio
  existir.

**Fora de escopo, sinalizado para decisão futura:**
- RLS desabilitada nas 14 tabelas de `public` (achado pré-existente, ver
  seção de Performance acima).
- Índice em `clientId` para `DamageOccurrence`/`DamageOccurrenceItem`
  (exige migration Prisma própria, com autorização expressa).

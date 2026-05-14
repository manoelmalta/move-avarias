# Política de Backup — MOVE AVARIAS

---

## Código-Fonte

- O código deve estar versionado no GitHub (`https://github.com/manoelmalta/move-avarias.git`).
- A branch `main` é protegida e representa o estado estável do projeto.
- Nenhum trabalho relevante deve existir apenas em máquina local sem estar commitado e no remote.

## Arquivos que NÃO vão para o Git

Os seguintes arquivos são locais e nunca devem ser versionados:

| Arquivo/Diretório | Motivo |
|---|---|
| `.env` | Contém credenciais e configurações sensíveis |
| `dev.db` | Banco de dados local com dados de desenvolvimento |
| `prisma/dev.db` | Arquivo de banco gerado pelo Prisma CLI (vazio) |
| `*.db`, `*.db-journal` | Bancos SQLite e journals de transação |
| `.claude/` | Configurações locais de sessão do Claude Code |
| `src/generated/prisma/` | Código gerado automaticamente — não editar |
| `node_modules/` | Dependências — reconstruídas via `npm install` |
| `.next/` | Build local — reconstruído via `npm run build` |

O arquivo `.env.example` **deve** ser versionado — contém apenas a estrutura das variáveis, sem valores reais.

## Banco de Dados de Desenvolvimento

- O arquivo `dev.db` (SQLite) é exclusivo para desenvolvimento e demonstração local.
- Dados de clientes reais nunca devem ser armazenados no banco SQLite local.
- Backups do banco de desenvolvimento não são obrigatórios — pode ser recriado com `npm run db:reset`.

## Mudança Estrutural Futura — PostgreSQL / Supabase

A migração do banco de SQLite local para PostgreSQL (Supabase, Neon ou equivalente) é uma **mudança estrutural** e deve seguir o processo completo:

1. Autorização explícita do responsável técnico.
2. Novo ambiente de banco criado e testado em separado.
3. Migration gerada e revisada antes de aplicar.
4. Dados de produção nunca migrados sem backup verificado.
5. Rollback documentado antes de executar.

## Checkpoints Antes de Mudanças Críticas

Antes de alterações de grande impacto (migrations, refatorações de autenticação, mudança de banco), criar uma tag git:

```bash
git tag -a checkpoint/YYYY-MM-DD -m "Checkpoint antes de: <descrição>"
git push origin --tags
```

Isso permite rollback preciso sem depender de branches intermediárias.

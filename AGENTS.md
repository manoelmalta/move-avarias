<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Regras de Governança para Agentes — MOVE AVARIAS

## Fonte da Verdade

- O repositório `https://github.com/manoelmalta/move-avarias.git` (branch `main`) é a fonte da verdade do projeto após o remote ser configurado.
- Nenhum agente deve considerar código local como definitivo sem confirmar que está sincronizado com o remote.

## Restrições de Operação

- **Nenhum agente pode fazer commit ou push sem autorização explícita do responsável técnico.**
- Não alterar `.env`, `package.json`, `schema.prisma` ou arquivos em `prisma/migrations/` sem autorização expressa.
- Não instalar, remover ou atualizar pacotes sem autorização.
- Não alterar lógica de negócio, fluxo de telas ou banco de dados fora do escopo da tarefa em execução.
- Nunca editar manualmente arquivos dentro de `src/generated/prisma/` — são gerados pelo Prisma CLI.
- Nunca versionar `.env`, `dev.db`, `prisma/dev.db`, `.claude/` ou `src/generated/prisma/`.

## Protocolo Obrigatório por Tarefa

Ao final de cada tarefa, o agente deve registrar:

1. **Arquivos alterados** — lista completa com caminho relativo
2. **Arquivos criados** — lista completa
3. **Testes executados** — comandos rodados e resultado (exit code)
4. **`git status` final** — saída completa
5. **Riscos encontrados** — qualquer ponto de atenção identificado durante a execução

## Escopo Mínimo

- Faça apenas o que foi explicitamente solicitado na tarefa.
- Em caso de dúvida sobre escopo, pergunte antes de agir.
- Prefira alterações pequenas e reversíveis a refatorações amplas.

## Validação Antes de Commit

Antes de qualquer commit autorizado, executar obrigatoriamente:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Todos devem passar sem erros para o commit prosseguir.

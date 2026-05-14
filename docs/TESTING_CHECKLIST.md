# Checklist de Validação — MOVE AVARIAS

Execute este checklist antes de qualquer commit ou entrega de funcionalidade.

---

## Validação Automatizada

```bash
# 1. Lint — deve terminar sem erros (exit code 0)
npm run lint

# 2. Tipos — deve terminar sem erros (exit code 0)
npx tsc --noEmit

# 3. Build — deve completar com sucesso (exit code 0)
npm run build
```

| Comando | Resultado esperado | Status |
|---|---|---|
| `npm run lint` | Exit code 0, zero erros | ☐ |
| `npx tsc --noEmit` | Exit code 0, zero erros | ☐ |
| `npm run build` | Build completo, 17 rotas geradas | ☐ |

---

## Validação Manual — Servidor de Desenvolvimento

```bash
npm run dev
# Acessar: http://localhost:3000
```

### Dashboard

- [ ] Página carrega sem erro
- [ ] KPIs exibem valores numéricos (não zero, não undefined)
- [ ] Rankings "Por Status", "Top Tipos de Avaria" e "Top Origens" exibem dados
- [ ] Não há erros no console do navegador

### Abertura de Ocorrência

- [ ] Acessar `/occurrences/new` como usuário SEPARADOR
- [ ] Preencher origem e descrição
- [ ] Buscar produto por EAN (ex: `7891000000011`) — produto encontrado com preço
- [ ] Informar quantidade, tipo de avaria e adicionar item
- [ ] Salvar — redireciona para detalhe da ocorrência com código `AVR-YYYY-NNNNN`
- [ ] Ocorrência aparece na listagem com status "1-Ocorrência Iniciada"

### Tratativa de Ocorrência

- [ ] Acessar detalhe de ocorrência aberta como ANALISTA
- [ ] Alterar status para "2-Tratamento Iniciado" e salvar
- [ ] Definir destinação e salvar
- [ ] Histórico de auditoria registra as alterações com nome do usuário e data

### Fechamento de Ocorrência

- [ ] Como ANALISTA/GESTOR, acessar ocorrência com destinação definida
- [ ] Botão "Concluir Ocorrência" está visível
- [ ] Tentar concluir sem destinação — erro esperado
- [ ] Concluir corretamente — status muda para "5-Processo Finalizado", data de conclusão registrada
- [ ] Botão "Concluir" desaparece após conclusão
- [ ] Campos ficam somente leitura após conclusão

### Produtos e Preços

- [ ] Acessar `/products` como ADMIN — lista de produtos visível
- [ ] Criar novo produto com EAN, código interno e descrição — aparece na lista
- [ ] Editar produto existente — alteração salva corretamente
- [ ] Acessar `/prices` como ADMIN — lista de preços visível
- [ ] Cadastrar novo preço para um produto com data de início — aparece na lista
- [ ] Buscar produto na nova ocorrência — preço vigente reflete o cadastrado

### Parâmetros

- [ ] Acessar `/parameters` — todas as 4 seções carregam (Origens, Tipos, Status, Destinações)
- [ ] Nenhum erro de console

### Permissões por Perfil Simulado

- [ ] Trocar para usuário **SEPARADOR** no header — botão "Concluir" não aparece em detalhe de ocorrência
- [ ] SEPARADOR não vê menu de Produtos nem Preços com botão de ação
- [ ] Trocar para **ANALISTA** — botão "Concluir" aparece
- [ ] Trocar para **ADMIN** — acesso completo a produtos, preços e parâmetros
- [ ] Via API direta (`/api/occurrences/[id]` PATCH com `complete: true`) como SEPARADOR — retorna 403

---

## Checklist Pré-Commit (segurança)

- [ ] `git status` não lista `.env`, `dev.db`, `prisma/dev.db`, `.claude/`, `src/generated/prisma/`
- [ ] `git diff --staged` revisado linha a linha
- [ ] Nenhum `console.log` de debug adicionado indevidamente
- [ ] Nenhum dado real de cliente presente em arquivos de código
- [ ] Remote `origin` configurado corretamente: `https://github.com/manoelmalta/move-avarias.git`

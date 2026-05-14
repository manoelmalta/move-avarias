# Processo de Alteração — MOVE AVARIAS

Este documento define o processo obrigatório para qualquer alteração no projeto.

---

## Etapas

### 1. Diagnóstico

Antes de qualquer alteração:

- Ler os arquivos relevantes para entender o estado atual.
- Identificar o escopo exato da mudança.
- Confirmar que a alteração não quebra contratos existentes (tipos, APIs, schema).

### 2. Plano

Antes de executar:

- Descrever o que será alterado e por quê.
- Listar os arquivos que serão tocados.
- Confirmar com o responsável técnico se o escopo não for trivial.

### 3. Alteração

- Fazer alterações pequenas e controladas.
- Um problema por vez — não acumular mudanças não relacionadas.
- Nunca alterar arquivos fora do escopo aprovado.

### 4. Validação

Após cada alteração, executar obrigatoriamente:

```bash
npm run lint          # zero erros (warnings tolerados temporariamente)
npx tsc --noEmit      # zero erros de tipo
npm run build         # build deve completar com sucesso
```

Se qualquer comando falhar, corrigir antes de prosseguir.

### 5. Revisão

- Executar `git diff` e revisar cada linha alterada.
- Confirmar que nenhum arquivo sensível foi incluído (`.env`, `*.db`, `.claude/`).
- Confirmar que `git status` não mostra arquivos inesperados.

### 6. Commit

- Commit só ocorre após autorização explícita do responsável técnico.
- Mensagem de commit deve seguir o padrão Conventional Commits:
  - `feat:` nova funcionalidade
  - `fix:` correção de bug
  - `chore:` manutenção, configuração, governança
  - `docs:` documentação
  - `refactor:` refatoração sem mudança de comportamento
- Incluir co-author quando gerado por agente:
  ```
  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  ```

### 7. Push

- Push só ocorre após revisão do commit pelo responsável técnico.
- Nunca usar `--force` em `main` sem autorização explícita.

---

## Regras de Ouro

- Se não tem certeza, não faz.
- Alteração mínima que resolve o problema — sem gold-plating.
- O banco de dados de produção nunca é alterado em tarefa de desenvolvimento.

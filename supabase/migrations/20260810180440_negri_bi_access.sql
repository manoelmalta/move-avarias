-- ============================================================================
-- Negri BI / Power BI controlled access layer
--
-- Creates an isolated schema (negri_bi) that gives the Negri Distribuidora
-- IT team read-only, client-scoped access to a curated subset of MOVE
-- AVARIAS data (via views) plus write access to dedicated import/staging
-- tables for the future Dashboard de Produtividade. Nothing in the `public`
-- schema is modified: no tables renamed, no columns added, no RLS toggled,
-- no grants changed on existing objects. Purely additive.
--
-- This migration is intentionally NOT modeled in prisma/schema.prisma or
-- prisma/migrations/: negri_bi is not part of the application's data model,
-- and Prisma's own migration history in this project is not tracked via
-- Supabase's migration system (verified empty prior to this change), so
-- keeping this addition in its own supabase/migrations/ file avoids any
-- collision or drift with `prisma migrate`.
--
-- IMPORTANT: this migration does NOT set a password for negri_dashboard.
-- The role is created with LOGIN but rolpassword stays NULL, so password
-- authentication fails until an admin runs
--   ALTER ROLE negri_dashboard PASSWORD '<strong secret>';
-- directly in the Supabase SQL editor (see docs/integrations/negri-bi-access.md).
-- This keeps the real secret out of git history, chat logs and migration
-- logs entirely.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Dedicated schema
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS negri_bi;
COMMENT ON SCHEMA negri_bi IS
  'Isolated read/import interface for external BI integrations (Negri Distribuidora today, other clients later). Not used by the MOVE AVARIAS application itself.';

-- ----------------------------------------------------------------------------
-- 2. Isolation configuration table
--
-- Negri does not exist yet as a row in public."Client" (only the demo
-- client is registered today). This table lets an internal admin wire the
-- real clientId in later, without ever editing a view definition or
-- granting negri_dashboard write access to the mapping itself. While
-- client_id IS NULL or active = false, every view below returns zero rows
-- and every import table blocks all access — safe by default.
-- ----------------------------------------------------------------------------
CREATE TABLE negri_bi.integration_config (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_key  text NOT NULL UNIQUE,
  client_id   text REFERENCES public."Client"(id),
  active      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE negri_bi.integration_config IS
  'Maps each external BI integration (client_key) to a public."Client".id. Only internal admins may write here -- negri_dashboard has no grants on this table at all. Views and RLS policies read it to scope data.';

INSERT INTO negri_bi.integration_config (client_key, client_id, active)
VALUES ('negri', NULL, false)
ON CONFLICT (client_key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. Dedicated login role for Negri IT / Power BI
-- ----------------------------------------------------------------------------
CREATE ROLE negri_dashboard LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION
  NOBYPASSRLS
  CONNECTION LIMIT 5;

ALTER ROLE negri_dashboard SET statement_timeout = '30s';
ALTER ROLE negri_dashboard SET idle_in_transaction_session_timeout = '5min';

COMMENT ON ROLE negri_dashboard IS
  'Dedicated login for Negri Distribuidora IT / Power BI. Scoped exclusively to schema negri_bi -- never granted anything on public, auth or storage. See docs/integrations/negri-bi-access.md.';

-- The isolation boundary is "no grants on public", not RLS: RLS is
-- currently disabled on every public table (pre-existing, tracked
-- separately). negri_dashboard is never granted USAGE on public tables,
-- so it cannot read them regardless of RLS state.
GRANT USAGE ON SCHEMA negri_bi TO negri_dashboard;

-- ----------------------------------------------------------------------------
-- 4. Unprivileged "definer" role that owns the BI views
--
-- The views below use owner-rights execution (security_invoker = false,
-- Postgres's long-standing default for views), and that is a deliberate,
-- justified choice rather than a shortcut:
--
--   * negri_dashboard must never receive direct SELECT on public tables --
--     the view has to be the only door. security_invoker = true would
--     require granting negri_dashboard SELECT on public."DamageOccurrence"
--     etc. directly, which defeats the whole isolation model.
--   * This is NOT SECURITY DEFINER: there is no function and no elevated
--     execution context beyond the ordinary Postgres view-privilege model
--     (the caller only ever needs SELECT on the view; the view runs with
--     its owner's privileges to read the base tables).
--   * The usual footgun with owner-rights views is owning them with a
--     superuser/BYPASSRLS role -- if RLS is ever enabled on the public
--     tables (currently disabled fleet-wide, see security advisory), such
--     a view would silently bypass every RLS policy. To avoid that,
--     the views are owned by negri_bi_definer: a NOLOGIN role with
--     NOBYPASSRLS and only the exact SELECT grants it needs on exactly
--     the tables the views touch. If RLS is enabled later, this role gets
--     no free pass -- it will need explicit policies like any other reader.
-- ----------------------------------------------------------------------------
CREATE ROLE negri_bi_definer NOLOGIN NOSUPERUSER NOBYPASSRLS;
COMMENT ON ROLE negri_bi_definer IS
  'Non-login role that owns negri_bi.vw_* and holds the minimum SELECT grants on public tables needed to build them. Exists so the views are never owned by a BYPASSRLS role.';

DO $$
BEGIN
  EXECUTE format('GRANT negri_bi_definer TO %I', current_user);
END $$;

GRANT USAGE ON SCHEMA public TO negri_bi_definer;
GRANT SELECT ON
  public."DamageOccurrence",
  public."DamageOccurrenceItem",
  public."Product",
  public."ProductPrice",
  public."ParameterOrigin",
  public."ParameterDamageType",
  public."ParameterStatus",
  public."ParameterDestination",
  public."MonthlyBilling",
  public."Client"
TO negri_bi_definer;
GRANT USAGE ON SCHEMA negri_bi TO negri_bi_definer;
GRANT SELECT ON negri_bi.integration_config TO negri_bi_definer;

-- ----------------------------------------------------------------------------
-- 5. Read-only BI views
--
-- Deliberately excluded: publicToken (public."DamageOccurrence"), any
-- User/AuditLog/UserPermissionOverride data, and any auth/credential
-- fields. Every view is inner-joined to integration_config so that with
-- no clientId configured (today's state), all four return zero rows.
--
-- Transferring ownership to negri_bi_definer requires that role to hold
-- CREATE on the schema at the moment of transfer (Postgres checks the new
-- owner could have created the object itself). CREATE is granted only for
-- this block and revoked immediately after -- negri_bi_definer's lasting
-- footprint stays USAGE + explicit SELECT grants only.
-- ----------------------------------------------------------------------------
GRANT CREATE ON SCHEMA negri_bi TO negri_bi_definer;

CREATE VIEW negri_bi.vw_ocorrencias AS
SELECT
  o."occurrenceCode"          AS occurrence_code,
  o."clientId"                AS client_id,
  po.name                     AS origin_name,
  ps.name                     AS status_name,
  pd.name                     AS destination_name,
  o.description,
  o."destinationObservation"  AS destination_observation,
  o."storageLocation"         AS storage_location,
  o."completedAt"             AS completed_at,
  o."createdAt"               AS created_at,
  o."updatedAt"               AS updated_at
FROM public."DamageOccurrence" o
JOIN negri_bi.integration_config cfg
  ON cfg.client_key = 'negri' AND cfg.active AND cfg.client_id = o."clientId"
LEFT JOIN public."ParameterOrigin" po ON po.id = o."originId"
LEFT JOIN public."ParameterStatus" ps ON ps.id = o."statusId"
LEFT JOIN public."ParameterDestination" pd ON pd.id = o."destinationId";
ALTER VIEW negri_bi.vw_ocorrencias OWNER TO negri_bi_definer;
COMMENT ON VIEW negri_bi.vw_ocorrencias IS 'Ocorrências de avaria, escopadas ao clientId configurado em integration_config.';

CREATE VIEW negri_bi.vw_itens_ocorrencia AS
SELECT
  i.id                        AS item_id,
  oc."occurrenceCode"         AS occurrence_code,
  i."clientId"                AS client_id,
  p."internalCode"            AS product_internal_code,
  p.ean                       AS product_ean,
  p.description               AS product_description,
  dt.name                     AS damage_type_name,
  i.quantity,
  i."unitValue"                AS unit_value,
  i."totalValue"               AS total_value,
  i.batch,
  i."expirationDate"           AS expiration_date,
  i."createdAt"                AS created_at,
  i."updatedAt"                AS updated_at
FROM public."DamageOccurrenceItem" i
JOIN negri_bi.integration_config cfg
  ON cfg.client_key = 'negri' AND cfg.active AND cfg.client_id = i."clientId"
JOIN public."DamageOccurrence" oc ON oc.id = i."occurrenceId"
LEFT JOIN public."Product" p ON p.id = i."productId"
LEFT JOIN public."ParameterDamageType" dt ON dt.id = i."damageTypeId";
ALTER VIEW negri_bi.vw_itens_ocorrencia OWNER TO negri_bi_definer;
COMMENT ON VIEW negri_bi.vw_itens_ocorrencia IS 'Itens de ocorrência de avaria, escopados ao clientId configurado em integration_config.';

CREATE VIEW negri_bi.vw_produtos AS
SELECT
  p.id                        AS product_id,
  p."clientId"                AS client_id,
  p.ean,
  p.dun,
  p."internalCode"            AS internal_code,
  p.description,
  p.active,
  p."createdAt"                AS created_at,
  p."updatedAt"                AS updated_at
FROM public."Product" p
JOIN negri_bi.integration_config cfg
  ON cfg.client_key = 'negri' AND cfg.active AND cfg.client_id = p."clientId";
ALTER VIEW negri_bi.vw_produtos OWNER TO negri_bi_definer;
COMMENT ON VIEW negri_bi.vw_produtos IS 'Cadastro de produtos, escopado ao clientId configurado em integration_config.';

CREATE VIEW negri_bi.vw_faturamento_mensal AS
SELECT
  b."clientId"  AS client_id,
  b.year,
  b.month,
  b.amount,
  b."createdAt" AS created_at,
  b."updatedAt" AS updated_at
FROM public."MonthlyBilling" b
JOIN negri_bi.integration_config cfg
  ON cfg.client_key = 'negri' AND cfg.active AND cfg.client_id = b."clientId";
ALTER VIEW negri_bi.vw_faturamento_mensal OWNER TO negri_bi_definer;
COMMENT ON VIEW negri_bi.vw_faturamento_mensal IS 'Faturamento mensal, escopado ao clientId configurado em integration_config.';

REVOKE CREATE ON SCHEMA negri_bi FROM negri_bi_definer;

GRANT SELECT ON
  negri_bi.vw_ocorrencias,
  negri_bi.vw_itens_ocorrencia,
  negri_bi.vw_produtos,
  negri_bi.vw_faturamento_mensal
TO negri_dashboard;

-- ----------------------------------------------------------------------------
-- 6. Import / staging tables (foundation only)
--
-- No business columns are modeled yet: there is no spec in this repo for
-- the four Dashboard de Produtividade sources (pedidos, itinerário/
-- veículo/pedido, coleta manual de produtividade, classificação de
-- produtos Seco/Câmara). Each table carries only lineage/auditing columns
-- plus a jsonb payload for whatever fields the eventual spec defines.
-- Narrow `payload` into typed columns in a follow-up migration once that
-- spec exists -- do not treat this shape as final.
--
-- RLS is enabled on these four tables (new objects we own, unlike public.*)
-- so that client isolation on INSERT/UPDATE/SELECT/DELETE is enforced at
-- the database level, not only by application-level discipline -- this is
-- what makes the multi-client isolation test in Etapa 11 verifiable even
-- against a hand-written manual query.
-- ----------------------------------------------------------------------------
CREATE TABLE negri_bi.import_pedidos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          text NOT NULL REFERENCES public."Client"(id),
  batch_id           uuid NOT NULL,
  source             text NOT NULL,
  source_file        text,
  source_row_number  integer,
  payload            jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at        timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE negri_bi.import_itinerarios (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          text NOT NULL REFERENCES public."Client"(id),
  batch_id           uuid NOT NULL,
  source             text NOT NULL,
  source_file        text,
  source_row_number  integer,
  payload            jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at        timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE negri_bi.import_produtividade (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          text NOT NULL REFERENCES public."Client"(id),
  batch_id           uuid NOT NULL,
  source             text NOT NULL,
  source_file        text,
  source_row_number  integer,
  payload            jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at        timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE negri_bi.import_produtos_setor (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          text NOT NULL REFERENCES public."Client"(id),
  batch_id           uuid NOT NULL,
  source             text NOT NULL,
  source_file        text,
  source_row_number  integer,
  payload            jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at        timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_pedidos_client_batch        ON negri_bi.import_pedidos        (client_id, batch_id);
CREATE INDEX idx_import_itinerarios_client_batch     ON negri_bi.import_itinerarios     (client_id, batch_id);
CREATE INDEX idx_import_produtividade_client_batch   ON negri_bi.import_produtividade   (client_id, batch_id);
CREATE INDEX idx_import_produtos_setor_client_batch  ON negri_bi.import_produtos_setor  (client_id, batch_id);

ALTER TABLE negri_bi.import_pedidos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE negri_bi.import_itinerarios     ENABLE ROW LEVEL SECURITY;
ALTER TABLE negri_bi.import_produtividade   ENABLE ROW LEVEL SECURITY;
ALTER TABLE negri_bi.import_produtos_setor  ENABLE ROW LEVEL SECURITY;

-- RLS policies run in the QUERYING role's own privilege context (unlike
-- owner-rights views). negri_dashboard must never get SELECT on
-- negri_bi.integration_config directly -- that would expose the full
-- client_key -> client_id mapping table, including other clients' rows, to
-- every single integration. Instead, use a narrow SECURITY DEFINER
-- function that returns only the one client_id the caller is entitled to
-- know about. This is the standard, minimal-scope idiom for parameterizing
-- an RLS policy -- not a general permission shortcut: single statement, no
-- side effects, locked search_path, owned by the same unprivileged
-- negri_bi_definer role (not postgres/superuser), EXECUTE granted to
-- negri_dashboard only.
GRANT CREATE ON SCHEMA negri_bi TO negri_bi_definer;
SET ROLE negri_bi_definer;
CREATE FUNCTION negri_bi.current_client_id(p_client_key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = negri_bi, pg_temp
AS $$
  SELECT client_id FROM negri_bi.integration_config WHERE client_key = p_client_key AND active;
$$;
RESET ROLE;
REVOKE CREATE ON SCHEMA negri_bi FROM negri_bi_definer;
REVOKE ALL ON FUNCTION negri_bi.current_client_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION negri_bi.current_client_id(text) TO negri_dashboard;

CREATE POLICY negri_dashboard_isolation ON negri_bi.import_pedidos
  FOR ALL TO negri_dashboard
  USING (client_id = negri_bi.current_client_id('negri'))
  WITH CHECK (client_id = negri_bi.current_client_id('negri'));

CREATE POLICY negri_dashboard_isolation ON negri_bi.import_itinerarios
  FOR ALL TO negri_dashboard
  USING (client_id = negri_bi.current_client_id('negri'))
  WITH CHECK (client_id = negri_bi.current_client_id('negri'));

CREATE POLICY negri_dashboard_isolation ON negri_bi.import_produtividade
  FOR ALL TO negri_dashboard
  USING (client_id = negri_bi.current_client_id('negri'))
  WITH CHECK (client_id = negri_bi.current_client_id('negri'));

CREATE POLICY negri_dashboard_isolation ON negri_bi.import_produtos_setor
  FOR ALL TO negri_dashboard
  USING (client_id = negri_bi.current_client_id('negri'))
  WITH CHECK (client_id = negri_bi.current_client_id('negri'));

GRANT SELECT, INSERT, UPDATE ON
  negri_bi.import_pedidos,
  negri_bi.import_itinerarios,
  negri_bi.import_produtividade,
  negri_bi.import_produtos_setor
TO negri_dashboard;
-- Deliberately no DELETE, no TRUNCATE. A full-reload use case should use
-- batch_id + a status/archival column and an UPDATE, not row deletion.

-- ============================================================================
-- Rollback (manual, run only if this integration needs to be fully removed):
--
-- DROP SCHEMA negri_bi CASCADE;
-- DROP OWNED BY negri_dashboard CASCADE; DROP ROLE negri_dashboard;
-- DROP OWNED BY negri_bi_definer CASCADE; DROP ROLE negri_bi_definer;
--
-- To disable access immediately without dropping anything:
-- ALTER ROLE negri_dashboard NOLOGIN;
-- ============================================================================

-- Adiciona constraint única para evitar cadastro de dois preços para o mesmo produto na mesma data de início de vigência.
-- Se existirem registros duplicados (mesmo clientId + productId + validFrom), a migration falhará
-- e deverá ser resolvida antes do deploy em produção.
CREATE UNIQUE INDEX "ProductPrice_clientId_productId_validFrom_key" ON "ProductPrice"("clientId", "productId", "validFrom");

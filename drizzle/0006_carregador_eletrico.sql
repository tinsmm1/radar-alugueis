-- EV charging features (owner priority) for listings collected before the detector existed.
-- Text is lower-cased and stripped of accents; listings_raw keeps the scrubbed payload (amenity tags).
WITH txt AS (
  SELECT l.id,
         translate(lower(coalesce(l.title, '') || ' ' || coalesce(l.description, '') || ' ' || coalesce((
           SELECT r.payload::text FROM listings_raw r WHERE r.source_id = l.source_id AND r.external_id = l.external_id ORDER BY r.fetched_at DESC LIMIT 1
         ), '')), 'áàâãéêíóôõúüç_', 'aaaaeeiooouuc ') AS t
  FROM listings l
)
UPDATE listings l SET features = array(SELECT DISTINCT unnest(l.features || array['carregador_eletrico']))
FROM txt
WHERE txt.id = l.id AND NOT ('carregador_eletrico' = ANY(l.features))
  AND txt.t ~ '(carregadore?s? (de |para )?(carros?|veiculos?) eletricos?|carregadore?s? eletricos?|carregadore?s? veicular|wall ?box|pontos? de recarga|estac(ao|oes) de recarga|recarga (de |para )?(carros?|veiculos?) eletricos?|electric (car|vehicle) charg|ev charg|charging station|car charger)';
--> statement-breakpoint
WITH txt AS (
  SELECT l.id, translate(lower(coalesce(l.title, '') || ' ' || coalesce(l.description, '')), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc') AS t FROM listings l
)
UPDATE listings l SET features = array(SELECT DISTINCT unnest(l.features || array['preparo_carregador']))
FROM txt
WHERE txt.id = l.id AND NOT ('preparo_carregador' = ANY(l.features))
  AND txt.t ~ '(preparad[oa]s? para (carregador|carros? eletricos?|veiculos? eletricos?|recarga)|infra ?estrutura (para|de) (carregador|carros? eletricos?|veiculos? eletricos?|recarga)|previsao (para|de) carregador|tubulacao (para|de) carregador|ponto (para|de) carregador|possibilidade de (instalar|instalacao de) carregador|pronto para (carros?|veiculos?) eletricos?)';
--> statement-breakpoint
UPDATE properties p SET features = array(SELECT DISTINCT unnest(p.features || x.f))
FROM (
  SELECT property_id, array_agg(DISTINCT f) AS f FROM listings, unnest(features) f
  WHERE f IN ('carregador_eletrico', 'preparo_carregador') AND property_id IS NOT NULL GROUP BY property_id
) x
WHERE x.property_id = p.id AND NOT (p.features @> x.f);

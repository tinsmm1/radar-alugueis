/**
 * Portal assessments made before writing any collector (13/11/2026): official API, robots.txt,
 * terms of use and the response to an identified automated request. A portal moves to "ativa"
 * only with an official API or an authorized feed; scraping against the terms is never built.
 */
export type Assessment = {
  checkedAt: string;
  api: string;
  robots: string;
  terms: string;
  access: string;
  verdict: string;
  path: string;
  site: string;
};

const CHECKED = "2026-11-13";
const PARTNER = "Pedir à imobiliária anunciante o feed VRSync (o mesmo XML que ela envia ao portal) e cadastrá-lo como fonte autorizada.";

export const PORTALS: Array<{ key: string; name: string; assessment: Assessment }> = [
  {
    key: "vivareal",
    name: "Viva Real",
    assessment: {
      checkedAt: CHECKED, site: "https://www.vivareal.com.br",
      api: "Sem API pública de leitura; a API do Grupo OLX serve para anunciantes publicarem, não para consultar anúncios.",
      robots: "robots.txt respondeu 403 (bloqueio de acesso automatizado).",
      terms: "Termos do Grupo OLX proíbem coleta automatizada de conteúdo.",
      access: "HTTP 403 para requisição automatizada identificada.",
      verdict: "Pendente: sem integração autorizada.", path: PARTNER,
    },
  },
  {
    key: "zap",
    name: "ZAP Imóveis",
    assessment: {
      checkedAt: CHECKED, site: "https://www.zapimoveis.com.br",
      api: "Sem API pública de leitura (mesma plataforma do Viva Real, Grupo OLX).",
      robots: "robots.txt respondeu 403.", terms: "Termos do Grupo OLX proíbem coleta automatizada.",
      access: "HTTP 403 para requisição automatizada identificada.", verdict: "Pendente: sem integração autorizada.", path: PARTNER,
    },
  },
  {
    key: "olx",
    name: "OLX",
    assessment: {
      checkedAt: CHECKED, site: "https://www.olx.com.br",
      api: "API de integração apenas para publicação por anunciantes.", robots: "robots.txt respondeu 403.",
      terms: "Termos proíbem coleta automatizada.", access: "HTTP 403 para requisição automatizada identificada.",
      verdict: "Pendente: sem integração autorizada.", path: PARTNER,
    },
  },
  {
    key: "quintoandar",
    name: "QuintoAndar",
    assessment: {
      checkedAt: CHECKED, site: "https://www.quintoandar.com.br",
      api: "Sem API pública.", robots: "robots.txt acessível; bloqueia /busca e trechos de /imovel.",
      terms: "Termos de uso: \"É proibido […] tentar extrair dados (web scraping) e copiar nosso conteúdo.\"",
      access: "Páginas públicas acessíveis, mas a coleta é proibida pelos termos.",
      verdict: "Bloqueado pelos termos de uso.", path: "Somente com parceria formal com o QuintoAndar.",
    },
  },
  {
    key: "imovelweb",
    name: "Imovelweb",
    assessment: {
      checkedAt: CHECKED, site: "https://www.imovelweb.com.br",
      api: "Sem API pública de leitura.", robots: "robots.txt acessível, com sitemaps.",
      terms: "Página de termos respondeu 403 a acesso automatizado; não há permissão expressa de coleta.",
      access: "Termos não verificáveis automaticamente; sem permissão expressa.",
      verdict: "Pendente: sem permissão expressa.", path: PARTNER,
    },
  },
  {
    key: "chavesnamao",
    name: "Chaves na Mão",
    assessment: {
      checkedAt: CHECKED, site: "https://www.chavesnamao.com.br",
      api: "Sem API pública.", robots: "robots.txt acessível (User-agent: * com sitemaps).",
      terms: "Termos de uso proíbem \"bots, scripts automatizados, ferramentas de raspagem […] para coletar dados […] seja para uso pessoal ou comercial\".",
      access: "Páginas públicas acessíveis, mas a coleta é proibida pelos termos.",
      verdict: "Bloqueado pelos termos de uso.", path: "Somente com autorização do Chaves na Mão ou feed da imobiliária.",
    },
  },
  {
    key: "netimoveis",
    name: "Netimóveis",
    assessment: {
      checkedAt: CHECKED, site: "https://www.netimoveis.com",
      api: "Sem API pública.", robots: "robots.txt respondeu 403.", terms: "Sem permissão expressa de coleta.",
      access: "HTTP 403 para requisição automatizada identificada.",
      verdict: "Pendente: sem integração autorizada.", path: "A rede reúne imobiliárias de BH: o feed VRSync de cada imobiliária associada é o caminho.",
    },
  },
];

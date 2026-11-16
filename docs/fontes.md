# Fontes de anúncios: integradas e pendentes

Verificação feita em 13/11/2026, antes de escrever qualquer coletor: API oficial, robots.txt, termos de uso e resposta a uma requisição automatizada identificada. A regra do projeto é integrar só **API oficial, feed autorizado, arquivo enviado pelo dono ou cadastro manual**. Não há coleta de páginas onde os termos proíbem, e nada contorna CAPTCHA, login ou bloqueio.

## Integradas (funcionando)

| Fonte | Como entra | Atualização |
|---|---|---|
| **Feed VRSync autorizado** | XML no formato que as imobiliárias já enviam ao ZAP/Viva Real, com aluguéis e vendas. O dono cadastra o endereço do feed com a autorização da imobiliária, em Administração → Fontes. | Automática, 06h e 18h |
| **Planilha CSV** | Modelo próprio (Administração → Importar), com aluguel, preço de venda (`preco_venda`), finalidade (`finalidade`), condomínio, IPTU e período, área, quartos, características, endereço etc. | Quando o dono envia |
| **Cadastro manual** | Formulário para registrar um anúncio visto em qualquer site, com o link original e a finalidade (aluguel, venda ou aluguel e venda). | Quando o dono cadastra |
| **Demonstração** | Dados fictícios (cerca de metade para alugar, 40% à venda e 10% para os dois), marcados em todas as telas, para ver os dois modos funcionando. Removíveis com um clique. | Sob demanda |

## Portais via Apify (coleta automática, opcional e gratuita)

Por decisão do dono, o Radar também lê os portais por meio de robôs prontos do [Apify](https://apify.com). **Atenção:** os termos de uso dos portais não autorizam coleta automática. O robô pode parar quando o portal muda o site, e os dados são só para uso pessoal.

### Passo a passo (plano gratuito)

1. Crie uma conta grátis em apify.com. O plano Free dá **US$ 5 de crédito por mês**, sem cartão.
2. Copie o token em **Settings → API & Integrations** e cadastre a variável `APIFY_TOKEN` na Vercel (ou no `.env.local`).
3. Na Apify Store, escolha um robô do portal com preço **por resultado** ("pay per result" ou "pay per event"). O Radar recusa robôs de mensalidade.
4. Crie **duas tarefas** ("Save as task"), as duas com a busca de Belo Horizonte ordenada pelos **mais recentes**: uma de **aluguel** e outra de **venda**. **Não** crie agendamento no Apify nem ajuste limites: o Radar faz isso.
5. No Radar, abra **Administração → Fontes → Portais via Apify** e cadastre cada tarefa. O botão **Testar tarefa** já mostra o limite automático.

### Limite automático (sem configuração)

O Radar inicia **uma execução por dia** de cada tarefa e define sozinho os limites dela. Antes de cada execução, ele:

1. lê no Apify quanto já foi gasto no ciclo e quando o ciclo termina;
2. lê o preço atual do robô (por resultado e por início de execução);
3. divide o que sobra do crédito pelas execuções que ainda faltam no ciclo;
4. inicia a execução com **limite de resultados** e **custo máximo** (`maxItems` e `maxTotalChargeUsd`). Quem garante esses dois limites é o próprio Apify.

As regras da conta:

- o Radar usa no máximo **US$ 5** por mês, mesmo numa conta paga;
- guarda **10% de reserva** para leituras e testes;
- divide o crédito igualmente entre as tarefas ativas.

Robôs cobrados só pelo uso da plataforma são limitados pelo tempo da execução.

Exemplo com um robô de US$ 2,00 por 1.000 resultados e US$ 0,005 por execução, num ciclo de 31 dias:

| Tarefas ativas | Resultados por execução | Custo máximo por execução | Anúncios por mês |
|---|---|---|---|
| 1 (só aluguel) | 70 | US$ 0,14 | ~2.170 |
| **2 (aluguel e venda)** | **33 cada** | **US$ 0,07** | **~2.050 no total** |

O limite também se ajusta durante o mês. Se sobrou crédito, o limite sobe; se um teste gastou mais, o limite cai. Quando o crédito do mês acaba, as execuções param até o próximo ciclo, e nada é cobrado. Cada execução aparece em **Administração → Execuções** com o limite usado.

Os resultados de uma execução entram na coleta seguinte (06h ou 18h). Como cada execução traz só os anúncios mais novos, um anúncio que não aparece numa execução **não** é marcado como indisponível.

Cada robô devolve campos com nomes diferentes. O Radar entende o formato do ZAP/Viva Real e os formatos "planos" mais comuns (`price`, `area`, `neighborhood`, `latitude`…). Telefones e e-mails são descartados.

## Pendentes (estrutura pronta, sem integração autorizada)

| Portal | API | robots.txt | Termos / acesso | Situação | Caminho |
|---|---|---|---|---|---|
| Viva Real | Sem API de leitura (a do Grupo OLX é para anunciantes publicarem) | 403 | Termos do Grupo OLX proíbem coleta automatizada; 403 para robôs | Pendente | Feed VRSync da imobiliária anunciante |
| ZAP Imóveis | Idem (Grupo OLX) | 403 | Idem | Pendente | Feed VRSync da imobiliária |
| OLX | API só para publicar | 403 | Proíbe coleta; 403 | Pendente | Feed da imobiliária |
| QuintoAndar | Sem API pública | Acessível; bloqueia /busca | Termos: "É proibido […] tentar extrair dados (web scraping)" | Bloqueado pelos termos | Parceria formal com o QuintoAndar |
| Imovelweb | Sem API de leitura | Acessível | Termos respondem 403 a robôs; sem permissão expressa | Pendente | Feed da imobiliária |
| Chaves na Mão | Sem API pública | Acessível | Termos proíbem "bots, scripts automatizados, ferramentas de raspagem […] seja para uso pessoal ou comercial" | Bloqueado pelos termos | Autorização do portal ou feed da imobiliária |
| Netimóveis | Sem API pública | 403 | Sem permissão expressa; 403 | Pendente | Feeds VRSync das imobiliárias associadas (é uma rede de imobiliárias de BH) |

Cada portal aparece em **Administração → Fontes** com essa avaliação. A cada execução ele é registrado como *pulado*, com o motivo, sem contar como falha.

## Aluguel e venda nas fontes

O Radar tem dois modos (Alugar e Comprar) e as fontes trazem os dois tipos de negócio:

- **Feed VRSync:** o campo `TransactionType` decide. `For Rent` vira aluguel (preço de `RentalPrice`, ou `ListPrice` se ele faltar); `For Sale` vira venda (preço de `ListPrice`); `Sale/Rent` vira aluguel e venda (aluguel de `RentalPrice`, venda de `ListPrice`). Um negócio sem preço é descartado para aquele modo; um anúncio sem nenhum preço é pulado ("sem preço").
- **Planilha CSV:** a coluna `finalidade` aceita `aluguel`, `venda` (ou `compra`) e `ambos`. Sem ela, vale o preço preenchido: `aluguel`, `preco_venda` ou os dois. O cabeçalho precisa da coluna `bairro` e de `aluguel` ou `preco_venda`. Uma linha com finalidade de venda e sem `preco_venda` válido é recusada com o motivo.
- **Cadastro manual:** a finalidade é escolhida no formulário; o aluguel ou o preço de venda passa a ser obrigatório conforme ela.

Um mesmo imóvel anunciado para alugar numa fonte e à venda em outra é agrupado num só imóvel, que aparece nos dois modos.

## Como integrar uma imobiliária (o caminho que funciona)

1. Peça à imobiliária o endereço do **feed XML** que ela envia aos portais (formato VRSync / "Viva Real XML"). Sistemas como Vista, Jetimob, Kenlo, Imobzi e Union geram esse feed.
2. Em **Administração → Fontes → Adicionar feed**, informe o nome, o endereço e quem autorizou. Use **Testar feed** para ver quantos anúncios de BH ele traz.
3. A partir daí o feed entra nas coletas das 06h e 18h. Os anúncios que somem são marcados como possivelmente indisponíveis e depois indisponíveis. Aluguéis e preços de venda são historiados e duplicatas com outras fontes são agrupadas.

## Dados geográficos

| Camada | Fonte | Acesso | Situação |
|---|---|---|---|
| Suscetibilidade a inundação, deslizamento e enxurrada | SGB/CPRM e IPT: Cartas de Suscetibilidade (2014), cobre BH | WFS oficial | Integrada, automática |
| Setores de risco geológico | SGB/CPRM (cobre a região metropolitana; BH tem mapeamento próprio da PBH) | WFS oficial | Integrada, automática |
| Rios e córregos (abertos e canalizados), avenidas, ferrovias, aeroporto, áreas industriais, metrô e estações, hospitais, supermercados, farmácias, parques, escolas e equipamentos públicos, bairros | OpenStreetMap via OpenFreeMap | Tiles vetoriais públicos | Integrada, automática (mensal) |
| Regionais de BH | OpenStreetMap via Nominatim | API pública | Integrada, automática |
| Declividade | Terrain Tiles (AWS Open Data; SRTM) | Tiles públicos | Integrada, por imóvel |
| Áreas de risco geológico (Urbel), carta de inundações, pontos críticos de alagamento (Defesa Civil) | Prefeitura de Belo Horizonte | Os servidores da PBH (dados.pbh.gov.br, BHMap) recusam acesso de servidores (403) | **Importação manual de GeoJSON** em Administração → Camadas |
| Ocorrências de segurança pública por bairro | Sem base oficial aberta nessa granularidade acessível | — | **Não exibida.** O app não classifica bairros como seguros ou perigosos |

## Filtros da coleta automática (Apify)

Em **Administração → Fontes → Filtros da coleta automática** o dono escolhe tipo (apartamentos, casas ou os dois), faixa de aluguel, faixa de preço de venda, quartos mínimos e regionais. O padrão é coletar todos os apartamentos e casas de BH.

- **Tipo, preço e quartos** seguem junto com cada execução do robô (campos `unitTypes`, `minPrice`, `maxPrice`, `minBedrooms`), então o Apify só cobra pelos anúncios que passam no filtro.
- **Regional** é conferida na importação, pelo bairro do anúncio: o robô busca a cidade toda e o Radar descarta as outras regionais.
- Os mesmos filtros são conferidos de novo na importação. Valor desconhecido nunca exclui um anúncio.
- **Imóveis comerciais** (salas, conjuntos, lojas, galpões, terrenos, sítios) nunca entram: são descartados como "não residencial".

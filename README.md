<a id="top"></a>

<p align="center">
  <b>Português</b> · <a href="README.en.md">English</a> · <a href="README.es.md">Español</a>
</p>

<p align="center">
  <img src="docs/assets/readme/hero-pt.svg" alt="Radar Aluguéis BH: escolha o aluguel com dados, não no escuro. Mapa de Belo Horizonte com preços, área de suscetibilidade a inundação e um cartão de análise da localização." width="1600" />
</p>

<h1 align="center">Radar Aluguéis BH</h1>

<p align="center">
  <b>Inteligência imobiliária para alugar ou comprar em Belo Horizonte.</b><br />
  Um hub com dois produtos, <b>Alugar</b> e <b>Comprar</b>: anúncios de fontes autorizadas consolidados <b>todo dia às 06h e às 18h</b>, duplicatas agrupadas,<br />
  <b>custo mensal real</b> para alugar, <b>simulação de compra e rendimento</b> para comprar, mapa com <b>camadas de risco</b>, <b>análise da localização</b>, <b>oportunidades</b> e <b>comparativo de bairros</b>.
</p>

<p align="center">
  <a href="#tour"><b>VER O APP →</b></a>
  &nbsp;·&nbsp; <a href="#comprar">COMPRAR</a>
  &nbsp;·&nbsp; <a href="#mapa">MAPA E RISCO</a>
  &nbsp;·&nbsp; <a href="#analise">ANÁLISE</a>
  &nbsp;·&nbsp; <a href="#fontes">FONTES</a>
  &nbsp;·&nbsp; <a href="#como-funciona">COMO FUNCIONA</a>
  &nbsp;·&nbsp; <a href="#publicar">PUBLICAR</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-0b0d0e?logo=nextdotjs&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-1d4ed8?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-strict-1d4ed8?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostGIS-Neon-2563eb?logo=postgresql&logoColor=white" alt="Postgres + PostGIS" />
  <img src="https://img.shields.io/badge/mapa-MapLibre%20·%20OpenStreetMap-0b0d0e?logo=maplibre&logoColor=white" alt="MapLibre e OpenStreetMap" />
  <img src="https://img.shields.io/badge/UI-shadcn%2Fui-0b0d0e" alt="shadcn/ui" />
  <img src="https://img.shields.io/badge/testes-85%20unit%20·%2020%20integração%20·%2018%20E2E-15803d" alt="Testes" />
</p>

<p align="center">
  <b>2 modos</b> · <b>30+ filtros</b> · <b>3.000 áreas</b> de suscetibilidade oficiais · <b>9.000+ elementos</b> urbanos do OSM · <b>14</b> tipos de distância por imóvel · <b>grátis</b> para publicar
</p>

> **Sobre os dados das imagens.** Os portais (Viva Real, ZAP, OLX, QuintoAndar, Imovelweb, Chaves na Mão, Netimóveis) não permitem coleta automática, então as imagens usam os **dados de demonstração** do app. São anúncios fictícios, marcados com o selo roxo "Demonstração" em todas as telas e removíveis com um clique. As camadas geográficas são **reais**: SGB/IPT, OpenStreetMap e relevo SRTM. Veja [o que está integrado e o que está pendente](docs/fontes.md).

---

<a id="tour"></a>

## 00 / O app em um minuto

<p align="center">
  <img src="docs/assets/readme/showcase.png" alt="Radar Aluguéis BH no computador (mapa de BH com preços e camada de inundação) e no celular (análise da localização com índice de risco 43, Atenção)." width="1600" />
</p>

<p align="center">
  <img src="docs/assets/readme/tour.gif" alt="Animação: busca dividida em lista e mapa, filtro pela Regional Centro-Sul, abertura de um imóvel e rolagem até a análise da localização." width="1100" />
</p>

| Tela | O que mostra |
|---|---|
| **Alugar ⇄ Comprar** | Chave no topo que troca o app inteiro: filtros, totais, cartões, mapa, ordenações, imóvel, oportunidades, bairros e comparador mudam de acordo com o modo (azul para alugar, verde para comprar). |
| **Buscar** | Campo de busca por bairro, endereço ou região; totais (imóveis, aluguel médio, menor preço, área média, novos em 24 h, última atualização); lista e mapa sincronizados; vistas **Lista / Dividido / Mapa**. |
| **Imóvel** | **Avaliação do Radar** (nota A a E com pontos fortes e de atenção), **acompanhar preço com preço-alvo**, imóveis parecidos, atalhos para o bairro, o comparador e um alerta de parecidos; galeria, descrição original, ficha completa, **custo mensal conhecido** item a item, custo por m², todas as fontes com link, histórico de preços, possíveis duplicatas e a **análise da localização**. |
| **Oportunidades** | **Melhores avaliados** (nota B ou melhor), preço reduzido, **abaixo dos comparáveis** (mesmo bairro, tipo e faixa de quartos), recém-publicados, ranking de **custo por m²** e, no modo Comprar, **maior rendimento**. |
| **Bairros** | Ranking dos **melhores locais** (risco e serviços, sem depender do preço) e das **melhores ofertas** do modo; custo mediano, oferta, infraestrutura num raio de 1 km, transporte e parcela de imóveis em área suscetível, para cada bairro e regional. |
| **Comparar** | Até 5 imóveis lado a lado, com o melhor valor de cada linha destacado. |
| **Favoritos, Buscas salvas, Notificações** | Listas próprias com notas; **preços acompanhados** (preço de quando começou, preço atual, alvo); buscas que avisam de imóveis novos e de reduções; cada categoria de oportunidade vira alerta com um clique; avisos no app, por e-mail e Telegram. |
| **Administração** | Fontes e seu estado, execuções e falhas, importação de planilha, cadastro manual, camadas geográficas, demonstração, notificações, backup e senha. |

---

## 01 / No computador

<table>
  <tr>
    <td width="50%"><img src="docs/assets/readme/desktop-busca.png" alt="Busca com filtros na lateral, totais, cartões e mapa." /></td>
    <td width="50%"><img src="docs/assets/readme/desktop-imovel.png" alt="Página do imóvel com custo mensal conhecido e mapa." /></td>
  </tr>
  <tr>
    <td align="center"><b>Buscar</b> · filtros, totais, lista e mapa</td>
    <td align="center"><b>Imóvel</b> · custo real e todas as fontes</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/assets/readme/desktop-comparar.png" alt="Comparador com quatro imóveis e o melhor valor de cada linha em verde." /></td>
    <td width="50%"><img src="docs/assets/readme/desktop-oportunidades.png" alt="Detector de oportunidades com imóveis abaixo dos comparáveis." /></td>
  </tr>
  <tr>
    <td align="center"><b>Comparar</b> · o melhor de cada linha em verde</td>
    <td align="center"><b>Oportunidades</b> · abaixo dos comparáveis, reduções, novos</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/assets/readme/desktop-bairros.png" alt="Tabela comparativa de bairros." /></td>
    <td width="50%"><img src="docs/assets/readme/desktop-favoritos.png" alt="Favoritos em listas com notas." /></td>
  </tr>
  <tr>
    <td align="center"><b>Bairros</b> · custo, oferta, infraestrutura e risco</td>
    <td align="center"><b>Favoritos</b> · listas, notas e mudanças</td>
  </tr>
</table>

## 02 / No celular

<p align="center">
  <img src="docs/assets/readme/phones.png" alt="Telas no celular: busca, mapa com camadas, imóvel, análise da localização e filtros." width="1600" />
</p>

<table>
  <tr>
    <td width="34%" align="center"><img src="docs/assets/readme/mobile.gif" alt="Animação no celular: lista, filtros, mapa e análise de um imóvel." width="300" /></td>
    <td width="66%">
      <b>Feito para procurar na rua.</b><br /><br />
      • Barra inferior com Buscar, Oportunidades, Bairros, Comparar e Favoritos.<br />
      • Filtros numa folha que sobe da base, com o total atualizado a cada mudança.<br />
      • Botão <i>Mapa</i> flutuante; o mapa ocupa a tela, com camadas e legenda.<br />
      • <i>Perto de mim</i> busca num raio a partir de onde você está.<br />
      • Nenhuma tela rola para o lado (testado a 390 px).
    </td>
  </tr>
</table>

---

<a id="comprar"></a>

## 03 / Comprar: preço por m², simulação e rendimento

<p align="center">
  <img src="docs/assets/readme/desktop-compra-simulacao.png" alt="Imóvel no modo Comprar: preço de venda, preço por m², aluguel estimado, rendimento bruto e simulação de compra com entrada, ITBI, financiamento SAC e comparação entre comprar e alugar." width="1100" />
</p>

No modo **Comprar**, o Radar vira outro produto sobre os mesmos dados:

- **Preço e preço por m²**, condomínio e IPTU, redução de preço e histórico do preço de venda.
- **Simulação de compra** com suposições editáveis:
  - entrada, juros, prazo, ITBI de BH (3%), escritura e registro;
  - financiamento **SAC ou Price**, com primeira e última parcela, juros totais e dinheiro necessário à vista.
- **Comprar ou alugar?** A parcela somada a condomínio, IPTU e manutenção é comparada com o aluguel de um imóvel equivalente. O app mostra também o rendimento perdido do dinheiro à vista e quantos anos de aluguel o preço representa.
- **Aluguel estimado e rendimento bruto:** a mediana do aluguel por m² de imóveis comparáveis **para alugar**, do mesmo bairro, da regional ou da regional inteira. A tela informa qual desses recortes foi usado.
- **Oportunidades de compra:** preço por m² abaixo dos comparáveis à venda, **maior rendimento**, reduções e anúncios novos.
- **Bairros:** preço mediano, preço por m² e rendimento por bairro e regional.

<table>
  <tr>
    <td width="50%"><img src="docs/assets/readme/desktop-compra-busca.png" alt="Busca no modo Comprar com preço de venda, preço por m², aluguel estimado e rendimento nos cartões." /></td>
    <td width="50%"><img src="docs/assets/readme/desktop-compra-rendimento.png" alt="Oportunidades de compra: ranking de maior rendimento estimado." /></td>
  </tr>
  <tr>
    <td align="center"><b>Comprar</b> · preço, R$/m² e rendimento nos cartões</td>
    <td align="center"><b>Maior rendimento</b> · ranking com o aluguel estimado</td>
  </tr>
  <tr>
    <td width="50%" colspan="2"><img src="docs/assets/readme/desktop-compra-bairros.png" alt="Comparativo de bairros no modo Comprar: preço mediano, preço por m² e rendimento." /></td>
  </tr>
  <tr>
    <td align="center" colspan="2"><b>Bairros no modo Comprar</b> · preço mediano, R$/m², rendimento, infraestrutura e risco</td>
  </tr>
</table>

> A simulação **não é proposta de banco nem cálculo oficial de impostos**. Os valores padrão (entrada de 20%, juros de 11% a.a., 30 anos, ITBI de 3%, cartório de 1,5%) são suposições que você muda na tela. O rendimento é **bruto**: não desconta impostos, vacância nem custos.

---

<a id="mapa"></a>

## 04 / Mapa interativo e camadas de risco

<p align="center">
  <img src="docs/assets/readme/camadas.gif" alt="Animação: no mapa de BH, as camadas de inundação, deslizamento e rios são ligadas uma a uma e o mapa aproxima." width="1100" />
</p>

<p align="center">
  <img src="docs/assets/readme/desktop-mapa.png" alt="Mapa de Belo Horizonte com preços dos imóveis, suscetibilidade a inundação, rios e córregos e estações de metrô." width="1100" />
</p>

- **Marcadores com preço**, agrupados quando há muitos próximos. A borda colorida indica o índice de risco, a tracejada um local aproximado, o fundo lilás um dado de demonstração.
- **Camadas ativáveis:**
  - risco: inundação, deslizamento, enxurrada, áreas importadas da PBH/Defesa Civil;
  - água: rios e córregos, abertos ou canalizados;
  - entorno: avenidas de grande circulação, ferrovias, metrô e estações BRT, hospitais, mercados e farmácias, parques;
  - limites: regionais.
- **Selecione bairros no mapa** com um toque. **Buscar nesta área** limita a busca ao que está visível, e a **distância de um endereço** desenha o raio.
- A lista e o mapa conversam: passar o mouse num cartão destaca o marcador, e tocar no marcador abre o cartão.

<a id="analise"></a>

## 05 / Análise da localização e índice de risco

<p align="center">
  <img src="docs/assets/readme/desktop-analise.png" alt="Análise da localização: índice 43, Atenção; itens de deslizamento, enxurrada e declividade com classificação, descrição, distância, fonte, data e link." width="1100" />
</p>

Cada imóvel localizado recebe uma análise com **classificação, descrição, distância, fonte, data e link** de cada item:

| Tema | Base consultada | Exemplo |
|---|---|---|
| Inundação e alagamento | Cartas de Suscetibilidade do **SGB/CPRM e IPT** (2014) | "Área de suscetibilidade alta a 50 m" |
| Deslizamento e enxurrada | Mesmas cartas oficiais | "Dentro de bacia suscetível a enxurrada" |
| Cursos d'água | OpenStreetMap (abertos e **canalizados**) | "Córrego do Leitão (canalizado) a 10 m" |
| Declividade | Relevo SRTM (~30 m) | "Declividade elevada (≥ 30%)" |
| Entorno | Avenidas, ferrovia, Aeroporto da Pampulha, áreas industriais | "Avenida de grande circulação a 40 m" |
| Serviços | Metrô e BRT, hospitais, supermercados, farmácias, parques, escolas | "Estação Vilarinho a 50 m" |
| Risco mapeado e ocorrências | Camadas da PBH/Urbel e da Defesa Civil importadas por você | "Dentro de área de risco R4" |

O **índice de risco (0–100)** resume tudo em *Baixo*, *Moderado*, *Atenção* ou *Alto* e mostra o que pesou. A confiança cai quando o local é aproximado. O app **distingue risco oficialmente mapeado, suscetibilidade e ocorrência histórica**, avisa quando falta uma base e **nunca** diz que um lugar é livre de risco só porque a base consultada não tem registro. É um resumo e **não substitui vistoria nem avaliação técnica**.

## 06 / Alugar: custo real, custo por m² e oportunidades

- **Custo mensal conhecido** = aluguel + condomínio + IPTU mensal (anual ÷ 12) + taxas recorrentes informadas. Valor que a fonte não informou **não vira zero**: o custo aparece como *parcial*, com o que falta.
- **Custo por m²** = custo mensal conhecido ÷ área privativa. Serve para comparar bairros e tamanhos diferentes.
- **Oportunidades:**
  - **preço reduzido**, com a data e o percentual;
  - **abaixo dos comparáveis**, quando o custo por m² está pelo menos 15% abaixo da mediana de 5 ou mais imóveis do mesmo bairro (ou regional), do mesmo tipo e da mesma faixa de quartos;
  - **recém-publicados**.

### Avaliação crítica, melhores locais e acompanhamento de preço

<p align="center">
  <img src="docs/assets/readme/avaliacao.png" alt="Avaliação do Radar de um imóvel para alugar: nota A, 91 de 100, com as partes da nota, os pontos fortes e os pontos de atenção." width="900" />
</p>

<p align="center">
  <img src="docs/assets/readme/melhores-bairros.png" alt="Rankings da página de bairros: melhores locais (risco e serviços) e melhores ofertas para alugar." width="1100" />
</p>

- **Avaliação do Radar (nota A a E, 0 a 100), por modo.** Soma quatro partes explicadas: **preço frente a imóveis parecidos** (50 pontos; custo por m² no aluguel, preço por m² na compra, comparando com 5 ou mais imóveis do mesmo bairro ou regional), **clareza do custo mensal** no aluguel ou **rendimento estimado** na compra (15), **serviços e transporte** por perto (25) e **o imóvel e seus dados** (10: vaga, características, endereço confirmado, mais de uma fonte). O **risco geográfico** (deslizamento, inundação, enxurrada) aparece como nota separada em cada imóvel e não entra na nota. Cada imóvel mostra os **pontos fortes** e os **pontos de atenção** em frases. Dado que falta conta como neutro e reduz a confiança; nunca vira ponto positivo. É uma nota automática, não avaliação imobiliária.
- **Melhores locais e melhores ofertas.** A página de bairros abre com dois rankings: locais (risco médio e serviços a 1 km do centro do bairro, sem depender do preço) e ofertas (média da avaliação dos imóveis do bairro no modo, com pelo menos 3 imóveis). Cada linha abre a busca daquele bairro já ordenada pela avaliação.
- **Na busca:** ordenação **Melhor avaliação** e filtro **Avaliação do Radar (mínima)** nos dois modos.
- **Acompanhar preço.** Na página do imóvel, defina um **preço-alvo** (custo mensal no aluguel, preço na compra). Você é avisado a cada redução e quando o preço chega ao alvo, de novo só se cair mais. Favoritos e imóveis acompanhados recebem as reduções separadas por modo. A página de favoritos lista os preços acompanhados com a variação desde o início.
- **Tudo ligado:** do imóvel para os parecidos, o bairro, o comparador e um alerta de parecidos; dos bairros para a busca; de cada aba de oportunidades para a busca completa ou para um alerta.

<a id="guia"></a>

### Guia de decisão, deslocamento no horário de pico e plano de proposta

- **Perfil e trabalho (Administração).** Cadastre até 4 locais de trabalho ou estudo com **horário de ida e de volta**, dias da semana, meio de transporte e importância; o tempo máximo aceitável; o valor da sua hora e os custos de transporte; renda e reserva para comprar; e os **pesos de cada critério** na nota.
- **Deslocamento real.** Para cada imóvel, ida e volta **nos seus horários**: com a chave grátis da TomTom (`TOMTOM_API_KEY`), carro, bicicleta e a pé usam o trânsito histórico daquele horário; sem ela, e sempre para ônibus/metrô, um modelo calibrado com o TomTom Traffic Index de BH e a velocidade dos ônibus informada pela PBH. Mostra horas por mês, gasto com transporte e o **custo real de morar ali** (moradia + transporte + tempo).
- **Nota personalizada.** A nota passa a ter a parte **Tempo até o trabalho** e usa os seus pesos. Na busca: **Mais perto do trabalho** e o filtro **Tempo até o trabalho**.
- **Negociação e decisão** em cada imóvel: plano de proposta (**abrir com, meta e teto**) a partir do preço frente aos parecidos, do tempo anunciado e das reduções; **cabe no orçamento?** (dinheiro na assinatura, parcela SAC × renda, preço máximo para o seu perfil); e a lista do que conferir antes de assinar.
- **Guia de decisão** (menu *Guia*): seus limites → **regionais comparadas** → **melhores posições** entre os bairros (nenhum outro é ao mesmo tempo mais barato e mais perto do trabalho) → imóveis que valem a visita dentro dos seus limites → como fechar bem.
- Como cada número é calculado: [docs/analises.md](docs/analises.md).

<a id="fontes"></a>

## 07 / Fontes: o que está integrado

| Fonte | Situação |
|---|---|
| **Feed XML de imobiliária (VRSync)**, o mesmo que ela envia ao ZAP/Viva Real | **Integrado**, para aluguel e venda (`For Rent`, `For Sale`, `Sale/Rent`). Coleta automática às 06h e 18h, com a autorização registrada |
| **Planilha CSV** (modelo próprio, colunas `finalidade` e `preco_venda`) e **cadastro manual** | **Integrado**, para aluguel e venda |
| **Dados de demonstração** | Integrado, marcado e removível |
| Viva Real, ZAP Imóveis, OLX, Imovelweb, Netimóveis | **Pendente**: sem API de leitura e bloqueio a acesso automatizado (403) |
| QuintoAndar, Chaves na Mão | **Bloqueado pelos termos**: proíbem coleta automatizada por escrito |

Cada portal foi avaliado **antes** de qualquer coletor (API, robots.txt, termos e resposta a acesso automatizado, em 13/11/2026). A avaliação aparece em **Administração → Fontes**. O app não contorna CAPTCHA, login nem bloqueio. O caminho para trazer anúncios de um portal é o **feed da imobiliária anunciante**. Detalhes em [docs/fontes.md](docs/fontes.md).

<table>
  <tr>
    <td width="50%"><img src="docs/assets/readme/desktop-fontes.png" alt="Administração: fontes em uso, cadastro de feed autorizado e portais pendentes com a avaliação." /></td>
    <td width="50%"><img src="docs/assets/readme/desktop-camadas.png" alt="Administração: camadas geográficas com fonte, data, quantidade e importação de GeoJSON." /></td>
  </tr>
  <tr>
    <td align="center"><b>Fontes</b> · estado, contagens, erros e avaliações</td>
    <td align="center"><b>Camadas</b> · fonte, data, quantidade e importação</td>
  </tr>
</table>

---

<a id="como-funciona"></a>

## 08 / Como funciona

<p align="center">
  <img src="docs/assets/readme/how-it-works-pt.svg" alt="Diagrama: fontes autorizadas, consolidação (padronização, duplicatas, histórico, disponibilidade), análise da localização (SGB/IPT, OpenStreetMap, relevo) e entrega (busca, mapa, oportunidades, comparador, notificações)." width="1600" />
</p>

1. **06h e 18h (Brasília):** o GitHub Actions chama o app. Cada chamada trabalha cerca de 50 s e a coleta continua de onde parou. A Vercel faz uma rodada de reserva.
2. **Fontes:** cada uma é coletada separadamente, com 3 tentativas. Uma falha fica registrada, gera aviso e **não interrompe as outras**.
3. **Consolidação:**
   - os dados originais ficam guardados à parte, sem contatos pessoais, e os normalizados vão para a busca;
   - os anúncios do mesmo imóvel são agrupados, mantendo todos os links;
   - o histórico de preços é registrado;
   - um anúncio que some vira *possivelmente indisponível* e, se continuar ausente, *indisponível*. Nada é apagado de imediato.
4. **Localização:** os imóveis são geocodificados (OpenStreetMap, até 1 consulta/s, com cache) e analisados com PostGIS.
5. **Entrega:** as oportunidades são recalculadas, e as buscas salvas e os favoritos geram avisos.

**Monitoramento:** **Administração → Execuções** mostra cada rodada e cada fonte, com lidos, novos, atualizados, duplicatas, ausentes, erros e duração.

<a id="publicar"></a>

## 09 / Publique o seu (Vercel + Neon + GitHub, tudo grátis)

1. **GitHub:** crie um repositório (pode ser privado) e envie esta pasta.
2. **Vercel:** **Add New → Project**, importe o repositório e não mude nada. O build, as migrações e a região São Paulo já estão no `vercel.json`.
3. **Banco:** **Storage → Create Database → Neon (Postgres)**, conecte e faça **Redeploy**. O PostGIS é ativado pela própria migração.
4. **Senha:** logo depois do deploy, abra `https://<projeto>.vercel.app` e crie a sua.
5. **Primeira coleta:** **Administração → Executar coleta agora** carrega as camadas geográficas. Depois cadastre um feed, envie uma planilha ou carregue a demonstração.
6. **Agendamento:** no GitHub, crie a variável `RADAR_URL` com o endereço do app. Recomendado também: `CRON_SECRET` na Vercel e nos Secrets do GitHub.

| Opcional | Para quê |
|---|---|
| `RESEND_API_KEY` ou `SMTP_URL` + `EMAIL_FROM` | avisos por e-mail |
| `TELEGRAM_BOT_TOKEN` | avisos pelo Telegram |
| `CRON_SECRET` | só o seu agendador aciona a coleta |
| `APP_PASSWORD` | recuperar o acesso |
| `GEOCODER_CONTACT` | seu e-mail no User-Agent do OpenStreetMap |

Guia completo, com camadas da Prefeitura, Telegram e servidor próprio: [**docs/deploy.md**](docs/deploy.md).

## 10 / Rodar na sua máquina

```bash
docker run -d --name radar-pg -p 54500:5432 -e POSTGRES_PASSWORD=radar postgis/postgis:16-3.5
```
```bash
pnpm install
```
```bash
cp .env.example .env.local
```
```bash
pnpm db:migrate
```
```bash
pnpm dev
```

Antes de `pnpm db:migrate`, defina em `.env.local`: `DATABASE_URL=postgres://postgres:radar@127.0.0.1:54500/postgres`. O app abre em http://localhost:3700.

| Comando | Para quê |
|---|---|
| `pnpm check` | lint, lint tipado, regras locais, tipos, testes e build |
| `pnpm test` | testes unitários do domínio (custo, compra e financiamento, parsers, duplicatas, ciclo de vida, filtros, oportunidades, risco) |
| `pnpm test:integration` | testes em PostGIS real (coleta, falhas, filtros, análise, importação de camada, SSRF) |
| `pnpm test:e2e` | 18 testes no navegador contra o build de produção, incluindo o modo Comprar, a avaliação e o preço-alvo |

## 11 / Por dentro

| Camada | Tecnologia |
|---|---|
| Aplicação | Next.js 16 (App Router), React 19, TypeScript estrito |
| Interface | Tailwind 4, shadcn/ui, lucide; design próprio em azul, branco e cinza |
| Mapa | MapLibre GL com tiles vetoriais do OpenStreetMap (OpenFreeMap) |
| Dados | Postgres + PostGIS (Neon), Drizzle ORM; dinheiro em centavos |
| Geodados | SGB/CPRM (WFS), OpenStreetMap (tiles vetoriais e Nominatim), Terrain Tiles (AWS), GeoJSON da PBH |
| Automação | GitHub Actions (06h/18h) + Vercel Cron; execução em etapas retomáveis |
| Qualidade | Vitest, Playwright, ESLint com lint tipado, Vibe Coding Toolkit, revisão de segurança independente |

## 12 / Limites conhecidos

- Os portais não oferecem integração autorizada. Os anúncios reais entram por feed de imobiliária, planilha, cadastro manual ou, por opção do dono, por robôs do Apify no plano grátis (veja [docs/fontes.md](docs/fontes.md)).
- As camadas de risco da Prefeitura de BH precisam ser importadas à mão (os servidores da PBH recusam acesso automático).
- Não há dados oficiais abertos de segurança pública por bairro. O app não classifica bairros como seguros ou perigosos.
- A suscetibilidade do SGB é de 2014, em escala municipal: mostra a predisposição do terreno, não o estado de um imóvel.
- No modo Comprar, a simulação usa suposições editáveis e o rendimento é bruto e estimado por comparáveis: não é proposta de banco, avaliação nem previsão de valorização.
- A avaliação do Radar depende dos imóveis coletados: com poucos anúncios num bairro, o preço é comparado com a regional ou fica neutro, e a confiança aparece reduzida.
- Uso pessoal: uma senha, sem contas de vários usuários.

## 13 / Documentação

| Documento | Conteúdo |
|---|---|
| [docs/deploy.md](docs/deploy.md) | publicar, agendar, fontes, camadas da PBH, notificações |
| [docs/fontes.md](docs/fontes.md) | fontes integradas, pendentes e por quê |
| [docs/analises.md](docs/analises.md) | perfil, deslocamento no pico, nota, negociação, orçamento e regiões |
| [PRODUCT.md](PRODUCT.md) | escopo, decisões e critérios de aceitação |
| [docs/architecture.md](docs/architecture.md) | módulos, dados e fluxos |
| [docs/security.md](docs/security.md) | segurança, LGPD, retenção e backups |
| [docs/design.md](docs/design.md) | sistema visual, mapa e celular |
| [docs/onboarding.md](docs/onboarding.md) | rodar e manter |
| [docs/quality.md](docs/quality.md) | testes, Toolkit e revisão de segurança |
| [docs/setup.md](docs/setup.md) | evidências do Vibe Coding Toolkit |

<p align="center"><sub>Para escolher onde morar, alugando ou comprando, sabendo quanto custa, o que tem em volta e o que o terreno diz.</sub></p>

<p align="right"><a href="#top">voltar ao topo ↑</a></p>

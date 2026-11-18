# Análises do Radar: como cada número é calculado

Este documento explica, em linguagem direta, de onde vem cada análise que o Radar usa para guiar uma decisão de aluguel ou compra em Belo Horizonte. Toda análise mostra na tela o método usado e as suas limitações. Nada aqui é laudo, avaliação imobiliária ou proposta de banco.

## 1. Perfil e trabalho (Administração → Perfil e trabalho)

O ponto de partida é você. Cadastre até **4 locais** (trabalho, faculdade, escola dos filhos):

| Campo | Para que serve |
|---|---|
| Endereço (ou latitude/longitude) | Destino do trajeto. O endereço é localizado pelo Nominatim; fora de BH, informe as coordenadas. |
| Como vai | Carro, ônibus/metrô, bicicleta ou a pé. |
| Sai de casa às / sai do trabalho às | Os horários reais de ida e volta. É neles que o trânsito é calculado. |
| Dias | Quantas vezes por semana o trajeto acontece (entra nas horas e no custo por mês). |
| Importância (1–10) | Peso do local quando há mais de uma pessoa ou destino. |

Também no perfil:

- **Tempo máximo aceitável** (só ida). Acima dele, o trajeto vira ponto de atenção e a nota cai.
- **Valor da sua hora**, **custo por km do carro**, **estacionamento** e **tarifa** (BH 2026: R$ 6,25 no ônibus e R$ 6,00 no metrô). Entram no *custo real de morar*.
- **Renda, reserva e parcela máxima (% da renda)** para a análise "cabe no orçamento".
- **Pesos da nota** (preço, custos/rendimento, deslocamento, serviços, imóvel). O Radar normaliza para 100.

Depois de salvar, clique em **Recalcular agora** ou espere a próxima coleta (06h e 18h).

## 2. Deslocamento no horário de pico

Para cada imóvel localizado e cada local do perfil, o Radar calcula **ida** (no seu horário de saída de casa) e **volta** (no seu horário de saída do trabalho).

**Com a chave da TomTom** (`TOMTOM_API_KEY`, grátis até 2.500 consultas por dia): carro, bicicleta e a pé usam a API de rotas da TomTom com `departAt` no próximo dia útil do seu calendário. O tempo inclui o trânsito histórico daquele dia e horário. O Radar guarda cada trajeto e só recalcula quando muda o imóvel, o local, o modo ou o horário, então o limite diário dura muito.

**Sem a chave, e sempre para ônibus/metrô**, o Radar usa um modelo transparente, calibrado com dados públicos:

- **Carro.** O TomTom Traffic Index 2025 mostra que, em BH, 10 km levam cerca de 35 minutos no pico da manhã (17,1 km/h, nível de congestionamento de ~91–93%). Isso dá uma velocidade sem trânsito de ~33 km/h. Uma curva por hora multiplica esse tempo: ~1,9× entre 7h e 9h e entre 17h e 19h, ~1,45× no meio do dia, ~1,05× de madrugada. Fim de semana tem curva própria, mais leve. Somam-se 4 minutos para estacionar e caminhar.
- **Ônibus/metrô.** A PBH informa velocidade média dos ônibus no pico de ~14 km/h (≈17 km/h fora do pico). O modelo soma caminhada até o ponto (≈10 min nas duas pontas), espera média (7 min no pico, 10 fora) e uma baldeação em trajetos acima de 8 km.
- **Distância de rua.** Linha reta × 1,35 (suposição de traçado urbano; × 1,25 a pé).

Cada número aparece como **faixa** (ex.: 38 min, de 30 a 47) com o selo do método (*trânsito TomTom* ou *modelo BH*).

**Na tela do imóvel** (seção *Deslocamento até o trabalho*): ida e volta por local, distância, tempo sem trânsito, horas por mês, gasto com transporte, valor do tempo e o **custo real de morar ali** = moradia (custo mensal conhecido no aluguel; parcela SAC + condomínio + IPTU na compra) + transporte + horas no trânsito × valor da sua hora.

**Na busca:** ordenação *Mais perto do trabalho*, filtro *Tempo até o trabalho* e o tempo médio em cada cartão.

## 3. Nota do Radar (A a E)

Com perfil cadastrado, a nota soma cinco partes, com os seus pesos (padrão entre parênteses):

| Parte | Como é medida |
|---|---|
| Preço frente a parecidos (40) | Custo por m² (aluguel) ou preço por m² (compra) contra a mediana de 5 ou mais imóveis do mesmo bairro, tipo e faixa de quartos (ou da regional). Redução recente soma pontos. |
| Custos claros ou rendimento (12) | Aluguel: custo mensal completo conhecido. Compra: rendimento bruto estimado (≥ 6% a.a. é alto). |
| Tempo até o trabalho (20) | Até 15 min só ida vale tudo; no seu limite, metade; no dobro do limite, zero. A média pesa 70% e o pior trajeto 30%. |
| Serviços e transporte (18) | Metrô/BRT, supermercado, farmácia, parque e hospital a distâncias de caminhada (OpenStreetMap). |
| Imóvel e dados (10) | Vaga, características, endereço confirmado, mais de uma fonte. |

Proteções da nota (auditoria de nov/2026):

- **Tamanho da amostra.** Com poucos comparáveis o efeito do preço é reduzido: 5 imóveis valem 75%, 10 ou mais valem 100%; a comparação pela regional (menos específica) vale 15% menos. A tela avisa quando isso acontece.
- **Preço bom demais.** 35% ou mais abaixo da mediana dos parecidos não ganha ponto extra (a parte fica limitada a 40 de 50), vira ponto de atenção (erro no anúncio, imóvel em mau estado ou golpe) e reduz a confiança.
- **Condomínio por m².** Comparado com os parecidos: 30% acima vira ponto de atenção e, na compra, tira 2 pontos do rendimento; 20% abaixo é ponto forte.
- **Imóvel sem localização** quando você tem locais cadastrados: o deslocamento conta como neutro (metade da parte) e a confiança cai, para a nota continuar comparável com os outros imóveis.
- **O que mais pesou.** Cada nota mostra as partes que mais puxaram para cima e para baixo.

Sem locais cadastrados, a nota usa os pesos clássicos (50/15/25/10). O **risco geográfico** (inundação, deslizamento, enxurrada) aparece sempre ao lado da nota e **nunca** entra nela. Dado que falta conta como neutro e reduz a confiança.

## 4. Plano de proposta (negociação)

Em cada imóvel, a seção *Negociação e decisão* sugere **abrir com**, **meta** e **teto**:

- margem de base de 4% na compra e 2% no aluguel (suposições, não pesquisa de mercado);
- soma margem quando o preço está acima da mediana dos parecidos, quando o anúncio está há 60 ou 120 dias no ar e quando já houve redução;
- reduz a margem e recomenda **decidir rápido** quando o preço já está 10% ou mais abaixo dos parecidos;
- o **teto** é o valor justo pela mediana dos parecidos, nunca acima do pedido;
- o tempo conta a partir de quando o Radar viu o anúncio pela primeira vez (pode estar no ar há mais tempo).

Ao acompanhar o preço de um imóvel, o Radar oferece usar a **meta do plano** como preço-alvo (no aluguel, meta do aluguel + condomínio e IPTU).

## 5. Cabe no orçamento?

- **Compra:** dinheiro na assinatura (entrada + ITBI de 3% + cartório 1,5%) contra a reserva, e a primeira parcela SAC (a maior) contra a % da renda que você definiu (bancos costumam aceitar até 30%). Mostra também o **preço máximo** que o seu perfil permite hoje e se o limite é a renda ou a reserva.
- **Aluguel:** custo mensal conhecido, com e sem transporte, como % da renda.

É uma leitura de planejamento, não análise de crédito.

## 6. Comparação de regiões e "melhores posições"

No **Guia de decisão** (menu *Guia*), regionais e bairros são comparados pelos imóveis ativos do modo:

- mediana e faixa (25%–75%) do preço ou custo por m²;
- mediana do tempo até o trabalho;
- rendimento bruto mediano (compra);
- quantas ofertas têm nota B ou melhor;
- % dos imóveis em área suscetível a inundação (informativo).

A **nota da região** combina preço por m² frente às outras áreas (40), tempo até o trabalho (35) e qualidade das ofertas (25). Áreas com menos de 3 imóveis ficam sem nota. A **estrela de melhor posição** marca as áreas da fronteira de Pareto: nenhuma outra é ao mesmo tempo mais barata por m² e mais perto do trabalho. É ali que está o melhor equilíbrio entre pagar menos e perder menos tempo.

## 7. Automação

- **Recalcular sozinho:** ao salvar o perfil, deslocamentos e notas são recalculados em segundo plano logo depois da resposta; o que não couber continua na próxima coleta. O botão *Recalcular agora* continua disponível.
- **Oportunidade para o seu perfil:** a cada coleta, imóveis reais novos (últimos 7 dias) com nota B ou melhor (ou só A, se preferir), dentro do seu tempo máximo e do seu orçamento, geram um aviso no app, por e-mail e Telegram. Um aviso por imóvel e modo, no máximo 10 por coleta. Precisa de locais ou renda/reserva cadastrados.
- **Cota da TomTom bem usada:** os imóveis sem tempo calculado vêm primeiro e, entre eles, os de melhor nota; quando a cota do dia acaba, o Radar para de consultar até o dia seguinte e usa o modelo. Depois, trajetos estimados pelo modelo são refeitos com trânsito real, das melhores notas para as piores, sem segurar a coleta.
- **Orçamento de aluguel:** com a renda informada, o Guia filtra os imóveis para alugar por renda × % máxima.

## 8. O Guia de decisão, passo a passo

1. **Seu perfil e seus limites** (locais, tempo máximo, preço máximo hoje).
2. **Onde procurar:** regionais comparadas.
3. **Melhores posições** entre os bairros (fronteira preço × deslocamento).
4. **Imóveis que valem a visita:** primeiro os que cabem nos seus limites, depois as melhores notas no geral.
5. **Como fechar bem:** comparar finalistas, visitar no horário de pico, propor com o plano e conferir a documentação (checklist na página de cada imóvel).

## Fontes dos parâmetros

- TomTom Traffic Index 2025, Belo Horizonte: <https://www.tomtom.com/traffic-index/belo-horizonte-traffic>
- PBH, Programa de redução do tempo de viagem no transporte coletivo: <https://prefeitura.pbh.gov.br/mobilidade-urbana/programa-de-reducao-do-tempo-de-viagem-no-transporte-coletivo>
- Tarifa de ônibus de BH em 2026 (R$ 6,25): Diário Oficial do Município, portaria de 30/12/2025
- TomTom Routing API e plano gratuito: <https://developer.tomtom.com/pricing>

## Carregador de carro elétrico

Prioridade do dono. O Radar procura no título, na descrição e nas tags do anúncio menções a carregador instalado (`carregador_eletrico`: carregador de carro elétrico, wallbox, ponto ou estação de recarga) ou a preparo (`preparo_carregador`: infraestrutura, previsão ou tubulação para carregador). Negações como "sem carregador" não contam.

- Quando o anúncio menciona, o imóvel ganha um selo âmbar em destaque no cartão e no topo do anúncio, aparece primeiro na ordem padrão da busca e gera um aviso (no app, por e-mail e Telegram), uma vez por imóvel e modo.
- A busca tem o filtro "Com carregador de carro elétrico".
- Quando o anúncio não menciona (a maioria), o anúncio mostra o caminho provável: casa com garagem costuma permitir a instalação, com avaliação de um eletricista; em apartamento depende do condomínio e da capacidade elétrica do prédio. Nunca é apresentado como garantia.

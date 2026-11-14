# Publicar e configurar o Radar Aluguéis BH

> Guia do dono, em português. A visão geral com imagens está no [README](../README.md).

O Radar é de uso pessoal: há uma única senha, criada na primeira visita. Ele tem dois modos, escolhidos no seletor **Alugar | Comprar** do topo: o modo vale para busca, mapa, oportunidades, bairros e comparação, e fica lembrado entre as páginas. Tudo roda em planos gratuitos: **Vercel** (app), **Neon** (Postgres com PostGIS) e **GitHub Actions** (agendador).

## 1. Publicar (cerca de 10 minutos)

1. **GitHub:** crie um repositório (pode ser privado) e envie esta pasta.

   ```bash
   git init
   ```
   ```bash
   git add -A
   ```
   ```bash
   git commit -m "Radar Aluguéis BH"
   ```
   ```bash
   git branch -M main
   ```
   ```bash
   git remote add origin https://github.com/SEU-USUARIO/radar-alugueis.git
   ```
   ```bash
   git push -u origin main
   ```

2. **Vercel:** **Add New → Project**, importe o repositório e não mude nada. O `vercel.json` já define o build (aplica as migrações do banco e compila), a região São Paulo (`gru1`) e as rodadas de reserva.
3. **Banco:** no projeto da Vercel, **Storage → Create Database → Neon (Postgres)**, região **São Paulo (sa-east-1)** se oferecida, e conecte ao projeto. A Vercel cria `DATABASE_URL`/`POSTGRES_URL` sozinha. O PostGIS é ativado pela primeira migração (o Neon já o oferece).
4. **Redeploy** (Deployments → ⋯ → Redeploy) para o build criar as tabelas.
5. **Logo depois**, abra `https://<projeto>.vercel.app` e **crie a sua senha**. Quem abre primeiro cria a senha; não deixe para depois.
6. Em **Administração → Visão geral**, toque em **Executar coleta agora**. A primeira execução baixa as camadas geográficas (SGB, OpenStreetMap, regionais). Se não terminar numa chamada, toque de novo ou espere o agendamento.
7. Para ver o sistema funcionando antes de ter fontes, use **Administração → Demonstração → Carregar dados de demonstração**. Esses dados são fictícios (imóveis para alugar, à venda e para os dois), aparecem marcados em todas as telas e saem com um clique.

## 2. Agendamento diário (06h e 18h)

O arquivo `.github/workflows/coleta.yml` roda **às 06h e às 18h (horário de Brasília)** e chama o app até a coleta terminar. Cada chamada dura até cerca de 50 s, e o app continua de onde parou.

1. No GitHub: **Settings → Secrets and variables → Actions → Variables → New variable**: `RADAR_URL` = `https://<projeto>.vercel.app`.
2. **Recomendado:** crie um texto aleatório de 16+ caracteres e cadastre como `CRON_SECRET` na Vercel (**Settings → Environment Variables**) **e** no GitHub (**Secrets**). Sem ele, o endereço da coleta fica aberto, mas só consegue iniciar uma coleta a cada 2 horas e não devolve dados.
3. Para rodar na hora: **Actions → Coleta diária → Run workflow**.

Se uma chamada falhar, o job do GitHub fica vermelho e o GitHub manda e-mail para você. A Vercel tem duas rodadas de reserva por dia (`vercel.json`, 06h05 e 18h05). No plano Hobby elas podem atrasar até uma hora.

## 3. Fontes de anúncios

Veja a lista completa e o motivo de cada portal estar pendente em [`docs/fontes.md`](fontes.md). Na prática:

- **Feed de imobiliária (automático):** peça à imobiliária o endereço do feed XML que ela envia ao ZAP/Viva Real (formato VRSync). O feed traz aluguéis e vendas; o Radar separa cada anúncio no modo certo. Cadastre em **Administração → Fontes → Adicionar feed**, registrando quem autorizou. Use **Testar feed** antes.
- **Planilha:** **Administração → Importar**. Baixe o modelo, preencha e envie. Para vendas, use as colunas `finalidade` (aluguel, venda ou ambos) e `preco_venda`.
- **Manual:** **Administração → Importar → Cadastrar anúncio**, com o link do anúncio original. Escolha a finalidade (aluguel, venda ou aluguel e venda) e informe o aluguel e/ou o preço de venda.

## 4. Camadas oficiais da Prefeitura (opcional, recomendado)

Os servidores da PBH recusam acesso automático. Para incluir as áreas de risco geológico (Urbel), a carta de inundações e os pontos críticos de alagamento da Defesa Civil:

1. Baixe a camada no portal de dados abertos da PBH ou no BHMap, pelo seu navegador.
2. Exporte ou converta para **GeoJSON em WGS84 (EPSG:4326)**. No QGIS, use **Exportar → Salvar feições como… → GeoJSON, SRC EPSG:4326**.
3. Em **Administração → Camadas → Importar GeoJSON**, informe o nome, a categoria (*risco oficialmente mapeado*, *suscetibilidade* ou *ocorrência histórica*), a fonte, o link e a data.

Todos os imóveis são reanalisados na próxima coleta.

## 5. Notificações (opcional)

O Radar avisa de: imóveis novos e reduções nas suas **buscas salvas** (cada aba de Oportunidades também vira alerta com um clique); reduções, saída e volta dos seus **favoritos**; e **preço-alvo** atingido (em **Acompanhar preço**, na página do imóvel). Dados de demonstração não geram avisos.

Sem configurar nada, as notificações ficam no app (sino no topo). Para recebê-las fora do app:

- **E-mail com Resend** (grátis até 3.000/mês): `RESEND_API_KEY` na Vercel. Sem domínio próprio, o remetente `onboarding@resend.dev` só entrega para o e-mail da sua conta Resend.
- **E-mail com Gmail (SMTP)** e uma [senha de app](https://myaccount.google.com/apppasswords): `SMTP_URL` = `smtps://seu.email%40gmail.com:senhadeapp@smtp.gmail.com:465` e `EMAIL_FROM` = `Radar <seu.email@gmail.com>`.
- **Telegram:** crie um bot com o @BotFather, cadastre `TELEGRAM_BOT_TOKEN` na Vercel, mande uma mensagem ao bot e informe o seu chat id em **Administração → Notificações**.

Depois, em **Administração → Notificações**, informe o destino e use **Enviar teste**.

## 6. Variáveis de ambiente (todas opcionais, exceto o banco)

| Variável | Para quê |
|---|---|
| `DATABASE_URL` / `POSTGRES_URL` | Banco Postgres com PostGIS (a Vercel cria ao conectar o Neon) |
| `APP_PASSWORD` | Senha fixa, para recuperar o acesso |
| `AUTH_SECRET` | Chave dos cookies (32+ caracteres) |
| `CRON_SECRET` | Só o seu agendador aciona a coleta (16+); mesmo valor no GitHub |
| `RESEND_API_KEY` / `SMTP_URL` / `EMAIL_FROM` / `NOTIFY_EMAIL` | E-mail |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Telegram |
| `APP_URL` | Endereço público para os links das notificações |
| `GEOCODER_CONTACT` | Seu e-mail no User-Agent do Nominatim (a política de uso pede um contato) |
| `LOG_LEVEL` | `info` (padrão), `debug`… |

Uma variável com valor inválido é ignorada e aparece num aviso em **Administração**.

## 7. Servidor próprio (alternativa à Vercel)

Qualquer servidor com Node 22 e Postgres 15+ com PostGIS 3:

```bash
pnpm install --frozen-lockfile
```
```bash
DATABASE_URL=postgres://… pnpm db:migrate
```
```bash
pnpm build
```
```bash
DATABASE_URL=postgres://… pnpm start
```

Para o agendamento, use o cron do sistema, chamando a coleta até `"more":false` (o mesmo laço do `.github/workflows/coleta.yml`). Por exemplo, `0 6,18 * * *` com `TZ=America/Sao_Paulo`.

## Limites e transparência

- **Vercel Hobby** e **Neon Free** são para uso pessoal, não comercial.
- **Dados de anúncios:** só entram fontes autorizadas. Portais que proíbem coleta automática ficam pendentes (veja `docs/fontes.md`).
- **Análise da localização:** usa bases oficiais e o OpenStreetMap; é um resumo e **não substitui vistoria ou avaliação técnica**. A ausência de registro numa base não significa ausência de risco.
- **Modo Comprar:** a simulação de compra (entrada, juros, prazo, ITBI de 3% de BH, cartório, SAC ou Price) usa suposições que você pode editar. **Não é proposta de banco nem cálculo oficial de impostos.** O aluguel estimado de um imóvel à venda vem da mediana do aluguel por m² de pelo menos 5 imóveis comparáveis para alugar coletados pelo Radar, e a tela mostra de onde ele veio (mesmo bairro, regional ou toda a regional). O rendimento é bruto: não desconta impostos, vacância nem custos.
- **Avaliação do Radar (nota A a E):** compara o anúncio com imóveis parecidos coletados pelo Radar e resume as bases geográficas. Dado que falta conta como neutro e reduz a confiança. Não é avaliação imobiliária, laudo nem vistoria.
- **Mapa:** algumas localizações são aproximadas (endereço oculto pela fonte ou centro do bairro) e aparecem marcadas assim.

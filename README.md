# Personal Trainer - WhatsApp Bot v2.0

Sistema completo de Personal Trainer para Instagram via WhatsApp.

## Funcionalidades

### 1. Mensagens Automáticas (Scheduler)

| Horário | Tipo | Conteúdo |
|---------|------|----------|
| 09:00 | Matinal | Missão do dia + Métricas + Insight Naval |
| 14:00 | Lembrete | Cobrança check-in (se não fez) |
| 18:00 | Cobrança | Cobrança post (se não postou) |

### 2. Comandos via WhatsApp

| Comando | Ação |
|---------|------|
| `fiz` / `postei` | Registrar post do dia |
| `checkin` | Confirmar check-in matinal |
| `missao` / `done` | Completar missão |
| `status` | Ver progresso atual |
| `ajuda` | Ver comandos |

### 3. Formato da Mensagem Matinal (2e-Friendly)

```
━━━━━━━━━━━━━━━━━━━━━━
🌅 BOM DIA, JOSÉ
Segunda, 20/01/2026
━━━━━━━━━━━━━━━━━━━━━━

📍 MISSÃO DE HOJE
"5 prompts que uso TODO DIA"
Formato: Carrossel | Pilar: Educativo

PORQUE ESSE POST:
Hoje é dia de entregar VALOR. Post educativo
gera saves e shares. Você está construindo
sua biblioteca de autoridade.

━━━━━━━━━━━━━━━━━━━━━━

📊 SEUS NÚMEROS vs META

Instagram
Seguidores: 2.400 → Meta: 3.500
████████░░ 68%
📈 Ontem: +12

Newsletter
Subscribers: 74 → Meta: 500
█░░░░░░░░░ 14%
📈 Ontem: +3

━━━━━━━━━━━━━━━━━━━━━━

🔥 STREAK
Posts consecutivos: 5 dias
💪 Bom ritmo!

━━━━━━━━━━━━━━━━━━━━━━

💡 INSIGHT DO DIA
"Leverage comes from capital, code, and content."
— Naval Ravikant

_Cada post é um ativo que trabalha pra você._

━━━━━━━━━━━━━━━━━━━━━━
```

## Deploy no Easypanel

### 1. Crie um ZIP com todos os arquivos

### 2. Acesse o Easypanel
https://easypanel.n8nlendario.online/

### 3. Upload e Configure
- **Build:** Nixpacks (detecta Node.js)
- **Start Command:** `node index.js`
- **Port:** 80

### 4. Variáveis de Ambiente (Obrigatórias)

```env
PORT=80
UAZAPI_BASE_URL=https://jcarlosamorimppt.uazapi.com
UAZAPI_TOKEN=seu-token-aqui
NOTIFICATION_NUMBER=5592981951096
TZ=America/Sao_Paulo
```

### 5. Variáveis Opcionais (Métricas Automáticas)

```env
# Instagram Graph API
INSTAGRAM_ACCESS_TOKEN=seu-token
INSTAGRAM_USER_ID=seu-ig-user-id

# Beehiiv API
BEEHIIV_API_KEY=seu-api-key
BEEHIIV_PUBLICATION_ID=seu-publication-id
```

### 6. Configure Webhook no UazAPI
URL: `https://seu-dominio/webhook`

## Estrutura de Arquivos

```
deploy/
├── index.js              # Entry point (inicia tudo)
├── webhook-server.js     # Servidor webhook
├── daily-scheduler.js    # Cron jobs
├── scheduler.js          # Estado e helpers
├── whatsapp.js           # API UazAPI
├── metrics.js            # APIs Instagram + Beehiiv
├── package.json
├── README.md
└── data/
    ├── naval-quotes.json       # 30 citações Naval
    ├── calendario-editorial.yaml
    ├── state.json              # Estado diário (auto)
    └── metrics-history.json    # Histórico métricas (auto)
```

## Testar Localmente

```bash
# Instalar dependências
npm install

# Rodar completo
npm start

# Testar mensagem matinal manualmente
npm run test-morning

# Rodar apenas webhook
npm run webhook

# Rodar apenas scheduler
npm run scheduler
```

## APIs de Métricas

### Instagram Graph API
Para métricas automáticas do Instagram:

1. Criar App no [Meta for Developers](https://developers.facebook.com)
2. Adicionar produto "Instagram Graph API"
3. Conectar conta Business/Creator
4. Gerar Access Token com permissões:
   - `instagram_basic`
   - `instagram_manage_insights`
5. Copiar User ID e Token

### Beehiiv API
Para métricas automáticas da Newsletter:

1. Acessar [Beehiiv Settings > API](https://app.beehiiv.com/settings/api)
2. Gerar API Key (requer plano pago)
3. Copiar Publication ID da URL

**Sem as APIs configuradas:** O sistema usa valores em cache/mock.

---

## Changelog

### v2.0.0
- Daily Scheduler com cron jobs (09h, 14h, 18h)
- Mensagem matinal 2e-friendly (TDAH + TAG)
- Missão do dia do calendário editorial
- "Porque" contextual baseado no pilar
- Integração Instagram Graph API
- Integração Beehiiv API
- Banco de 30 citações Naval rotativas
- Comparação dia-a-dia de métricas
- Progress bars visuais
- Streak de posts

### v1.0.0
- Webhook básico com comandos
- Templates de cobrança

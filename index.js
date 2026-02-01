/**
 * Personal Trainer - Main Entry Point
 *
 * Starts both:
 *   1. Webhook Server (receives WhatsApp messages)
 *   2. Daily Scheduler (sends timed notifications)
 *
 * Environment variables:
 *   PORT                    - Webhook server port (default: 80)
 *   UAZAPI_BASE_URL         - UazAPI base URL
 *   UAZAPI_TOKEN            - UazAPI token
 *   NOTIFICATION_NUMBER     - Your WhatsApp number
 *   TZ                      - Timezone (default: America/Sao_Paulo)
 *   INSTAGRAM_ACCESS_TOKEN  - Instagram Graph API token (optional)
 *   INSTAGRAM_USER_ID       - Instagram Business Account ID (optional)
 *   BEEHIIV_API_KEY         - Beehiiv API key (optional)
 *   BEEHIIV_PUBLICATION_ID  - Beehiiv publication ID (optional)
 */

// Set timezone early
process.env.TZ = process.env.TZ || 'America/Sao_Paulo';

console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🏋️  PERSONAL TRAINER - WHATSAPP BOT                ║
║                                                       ║
║   Versão 2.5 - Webhook + Scheduler + OPES Marketing    ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
`);

// ============================================
// VERIFICAÇÃO DE VARIÁVEIS DE AMBIENTE
// ============================================
console.log('🔍 Verificando configuração...\n');

const envCheck = {
  // WhatsApp (OBRIGATÓRIO para cron funcionar)
  UAZAPI_BASE_URL: process.env.UAZAPI_BASE_URL,
  UAZAPI_TOKEN: process.env.UAZAPI_TOKEN,
  NOTIFICATION_NUMBER: process.env.NOTIFICATION_NUMBER,
  // Instagram (opcional)
  INSTAGRAM_ACCESS_TOKEN: process.env.INSTAGRAM_ACCESS_TOKEN,
  INSTAGRAM_USER_ID: process.env.INSTAGRAM_USER_ID,
  // Beehiiv (opcional)
  BEEHIIV_API_KEY: process.env.BEEHIIV_API_KEY,
  BEEHIIV_PUBLICATION_ID: process.env.BEEHIIV_PUBLICATION_ID,
  // Timezone
  TZ: process.env.TZ
};

const required = ['UAZAPI_BASE_URL', 'UAZAPI_TOKEN', 'NOTIFICATION_NUMBER'];
const missing = required.filter(key => !envCheck[key]);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📋 VARIÁVEIS DE AMBIENTE:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
Object.entries(envCheck).forEach(([key, value]) => {
  const isRequired = required.includes(key);
  const status = value ? '✅' : (isRequired ? '❌ FALTANDO!' : '⚪ (opcional)');
  const displayValue = value ? (key.includes('TOKEN') || key.includes('KEY') ? '***configurado***' : value.substring(0, 30) + (value.length > 30 ? '...' : '')) : 'não configurado';
  console.log(`   ${status} ${key}: ${displayValue}`);
});
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (missing.length > 0) {
  console.log(`
⚠️  ATENÇÃO: VARIÁVEIS OBRIGATÓRIAS FALTANDO!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Os CRON JOBS NÃO VÃO FUNCIONAR sem essas variáveis:

${missing.map(m => `   ❌ ${m}`).join('\n')}

Configure no Easypanel:
   App → Environment → Add Variable

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

// Start Webhook Server
console.log('📡 Iniciando Webhook Server...');
require('./webhook-server');

// Start Daily Scheduler
console.log('🕐 Iniciando Daily Scheduler...');
const { startScheduler } = require('./daily-scheduler');
startScheduler();

const now = new Date();
console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Sistema completo iniciado!

📍 Webhook: Aguardando mensagens...
📍 Scheduler: Cron jobs ativos
📍 Hora atual: ${now.toLocaleTimeString('pt-BR')} (${process.env.TZ})
📍 Data: ${now.toLocaleDateString('pt-BR')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 CRON JOBS INSTAGRAM (diário):
   • 09:00 - Bom dia + Missão + Métricas
   • 14:00 - Lembrete check-in (se não fez)
   • 18:00 - Cobrança post (se não postou)

📰 CRON JOBS NEWSLETTER:
   • Seg 08:00 - Lembrete "amanhã é newsletter"
   • Ter 09:00 - Missão newsletter
   • Ter 14:00 - Cobrança newsletter
   • Qui 08:00 - Lembrete "amanhã é newsletter"
   • Sex 09:00 - Missão newsletter
   • Sex 14:00 - Cobrança newsletter

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📱 Comandos WhatsApp:
   • fiz / postei  → Registrar post
   • checkin       → Confirmar check-in
   • missao / done → Completar missão
   • status        → Ver progresso
   • comecei       → Começou newsletter
   • enviei        → Newsletter publicada
   • news          → Status newsletter
   • metricas      → Ver números IG + Newsletter

📣 OPES Marketing (via /send/menu):
   • APROVADO      → Aprovar carrossel
   • AJUSTE        → Pedir ajuste
   • CANCELA       → Cancelar carrossel

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

// Enviar mensagem de confirmação de startup (se variáveis configuradas)
if (!missing.length) {
  const { sendWhatsApp } = require('./whatsapp');
  const startupMsg = `🟢 *PERSONAL TRAINER ONLINE*

━━━━━━━━━━━━━━━━━━━━━━

Sistema reiniciado às ${now.toLocaleTimeString('pt-BR')}

✅ Webhook: OK
✅ Cron Jobs: Ativos
✅ Timezone: ${process.env.TZ}

Próximas mensagens automáticas:
• 09:00 - Missão do dia
• 14:00 - Lembrete check-in
• 18:00 - Cobrança post

━━━━━━━━━━━━━━━━━━━━━━`;

  sendWhatsApp(startupMsg)
    .then(() => console.log('✅ Mensagem de startup enviada!'))
    .catch(err => console.error('❌ Erro ao enviar startup:', err.message));
}

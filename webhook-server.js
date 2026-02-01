/**
 * Webhook Server - Personal Trainer (Deploy Version)
 *
 * Environment variables:
 *   PORT                 - Server port (default: 3847)
 *   UAZAPI_BASE_URL      - UazAPI base URL
 *   UAZAPI_TOKEN         - UazAPI token
 *   NOTIFICATION_NUMBER  - Your WhatsApp number
 */

const http = require('http');
const { URL } = require('url');
const { sendWhatsApp, templates } = require('./whatsapp');
const { markCheckinDone, markMissionDone, markPosted, markNewsletterStarted, markNewsletterSent, loadState } = require('./scheduler');
const { getAllMetrics, BENCHMARKS } = require('./metrics');

const PORT = process.env.PORT || 3847;
const YOUR_NUMBER = process.env.NOTIFICATION_NUMBER || '5592981951096';

// Security: Valid prefixes and keywords
const PREFIXOS_VALIDOS = ['@coach', '@trainer', '/trainer', '!trainer', 'coach', 'trainer'];
const PALAVRAS_EXATAS = [
  'fiz', 'postei', 'publiquei',
  'checkin', 'check',
  'missao', 'missão', 'done',
  'status',
  'ajuda', 'help',
  // Newsletter commands
  'comecei', 'enviei', 'news status', 'news',
  // Metrics command
  'metricas', 'métricas', 'numeros', 'números'
];

const commands = {
  postei: ['fiz', 'postei', 'publiquei', 'posted', 'feito', 'pronto'],
  checkin: ['checkin', 'check', 'check-in', 'fiz checkin', 'fiz check'],
  missao: ['missao', 'missão', 'done', 'concluido', 'fiz missao', 'fiz missão', 'completei'],
  status: ['status', 'como estou', 'progresso'],
  ajuda: ['ajuda', 'help', 'comandos', '?'],
  // Newsletter commands
  news_comecei: ['comecei', 'comecei news', 'comecei newsletter', 'sentei', 'escrevendo'],
  news_enviei: ['enviei', 'enviei news', 'enviei newsletter', 'publiquei news', 'mandei'],
  news_status: ['news status', 'news', 'newsletter status'],
  // Metrics command
  metricas: ['metricas', 'métricas', 'numeros', 'números', 'dados', 'analytics']
};

function isValidMessage(text) {
  const normalized = text.toLowerCase().trim();

  for (const prefixo of PREFIXOS_VALIDOS) {
    if (normalized.startsWith(prefixo)) {
      return { valid: true, cleanText: normalized.replace(prefixo, '').trim() };
    }
  }

  for (const palavra of PALAVRAS_EXATAS) {
    if (normalized === palavra) {
      return { valid: true, cleanText: normalized };
    }
  }

  return { valid: false, cleanText: null };
}

function detectCommand(text) {
  const normalized = text.toLowerCase().trim();

  for (const [command, triggers] of Object.entries(commands)) {
    for (const trigger of triggers) {
      if (normalized === trigger || normalized.startsWith(trigger + ' ')) {
        return command;
      }
    }
  }

  return null;
}

async function processCommand(command) {
  let response;
  const state = loadState();

  switch (command) {
    case 'postei':
      markPosted();
      const newState = loadState();

      if (newState.streak_days >= 7 && newState.streak_days % 7 === 0) {
        response = `✅ *POSTOU! REGISTRADO!*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n🔥 *STREAK: ${newState.streak_days} DIAS!*\n\nIsso aí! Consistência é o jogo.\n\n🏆 Achievement: Semana Consistente!\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nCobrança das 18h: *CANCELADA*\n\nSegue o ritmo!\n\n━━━━━━━━━━━━━━━━━━━━━━\n📌 *GATILHOS:*\n• *fiz* → Registrar post\n• *checkin* → Check-in\n• *missao* → Missão feita\n• *status* → Ver estado`;
      } else {
        response = `✅ *REGISTRADO!*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nPost de hoje: ✓\nStreak atual: ${newState.streak_days} dia${newState.streak_days > 1 ? 's' : ''}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nCobrança das 18h: *CANCELADA*\n\nBom trabalho. Agora descansa ou faz mais.\n\n━━━━━━━━━━━━━━━━━━━━━━\n📌 *GATILHOS:*\n• *fiz* → Registrar post\n• *checkin* → Check-in\n• *missao* → Missão feita\n• *status* → Ver estado`;
      }
      break;

    case 'checkin':
      markCheckinDone();
      response = `✅ *CHECK-IN REGISTRADO!*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nDia começou com foco.\n\nCobrança das 11h: *CANCELADA*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nAgora vai executar a missão!\n\n━━━━━━━━━━━━━━━━━━━━━━\n📌 *GATILHOS:*\n• *fiz* → Registrar post\n• *checkin* → Check-in\n• *missao* → Missão feita\n• *status* → Ver estado`;
      break;

    case 'missao':
      markMissionDone();
      response = `🎉 *MISSÃO COMPLETA!*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nVocê fez o que tinha que fazer.\n\nIsso é mais do que 90% das pessoas fazem.\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nCobrança das 14h: *CANCELADA*\n\nQuer fazer mais? Ou tá bom por hoje?\n\n━━━━━━━━━━━━━━━━━━━━━━\n📌 *GATILHOS:*\n• *fiz* → Registrar post\n• *checkin* → Check-in\n• *missao* → Missão feita\n• *status* → Ver estado`;
      break;

    case 'status':
      const hoje = new Date().toLocaleDateString('pt-BR');
      response = `📊 *STATUS - ${hoje}*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nCheck-in: ${state.checkin_done_today ? '✅' : '❌'}\nMissão: ${state.mission_done_today ? '✅' : '❌'}\nPostou: ${state.posted_today ? '✅' : '❌'}\n\n🔥 Streak: ${state.streak_days || 0} dias\n📨 Mensagens hoje: ${state.messages_today || 0}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n${!state.posted_today ? '⚠️ Ainda não postou hoje!' : 'Tudo em dia!'}\n\n━━━━━━━━━━━━━━━━━━━━━━\n📌 *GATILHOS:*\n• *fiz* → Registrar post\n• *checkin* → Check-in\n• *missao* → Missão feita\n• *status* → Ver estado`;
      break;

    case 'ajuda':
      response = `🏋️ *COMANDOS DO PERSONAL*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n*INSTAGRAM:*\n• *fiz* ou *postei* → Registrar post\n• *checkin* → Registrar check-in\n• *missao* ou *done* → Completar missão\n• *status* → Ver estado do dia\n\n*NEWSLETTER:*\n• *comecei* → Começou a escrever\n• *enviei* → Newsletter publicada\n• *news* → Status da newsletter\n\n*ANALYTICS:*\n• *metricas* → Ver números IG + Newsletter\n\n*OU USE PREFIXO:*\n• @coach [comando]\n• @trainer [comando]\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n_Outras mensagens são ignoradas._`;
      break;

    // ============================================
    // NEWSLETTER COMMANDS
    // ============================================

    case 'news_comecei':
      markNewsletterStarted();
      response = `✅ *NEWSLETTER - COMEÇOU!*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nÓtimo, você sentou pra escrever.\n\nCobrança das 14h: *CANCELADA*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nAgora foca. Quando publicar, me manda *enviei*.\n\n━━━━━━━━━━━━━━━━━━━━━━\n📌 *GATILHOS NEWS:*\n• *comecei* → Confirmar que sentou\n• *enviei* → Newsletter publicada\n• *news* → Ver status`;
      break;

    case 'news_enviei':
      markNewsletterSent();
      const newsState = loadState();
      if (newsState.newsletter_streak >= 4) {
        response = `🎉 *NEWSLETTER PUBLICADA!*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n🔥 *STREAK: ${newsState.newsletter_streak} EDIÇÕES!*\n\nVocê tá consistente. Isso constrói confiança.\n\n🏆 Achievement: Mês Consistente!\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n74 pessoas receberam valor.\nCada edição = autoridade composta.\n\n━━━━━━━━━━━━━━━━━━━━━━\n📌 *GATILHOS NEWS:*\n• *comecei* → Confirmar que sentou\n• *enviei* → Newsletter publicada\n• *news* → Ver status`;
      } else {
        response = `✅ *NEWSLETTER PUBLICADA!*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nNewsletter de hoje: ✓\nStreak atual: ${newsState.newsletter_streak} edição${newsState.newsletter_streak > 1 ? 'ões' : ''}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nBom trabalho. 74 pessoas receberam valor.\n\nPróxima: ${new Date().getDay() === 2 ? 'Sexta-feira' : 'Terça-feira'}\n\n━━━━━━━━━━━━━━━━━━━━━━\n📌 *GATILHOS NEWS:*\n• *comecei* → Confirmar que sentou\n• *enviei* → Newsletter publicada\n• *news* → Ver status`;
      }
      break;

    case 'news_status':
      const nsState = loadState();
      const hojeNews = new Date().toLocaleDateString('pt-BR');
      const dayOfWeek = new Date().getDay();
      const isNewsDay = dayOfWeek === 2 || dayOfWeek === 5; // Tue or Fri

      response = `📰 *STATUS NEWSLETTER - ${hojeNews}*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nHoje é dia de news: ${isNewsDay ? '✅ SIM' : '❌ Não'}\nComeçou: ${nsState.newsletter_started_today ? '✅' : '❌'}\nEnviou: ${nsState.newsletter_sent_today ? '✅' : '❌'}\n\n🔥 Streak: ${nsState.newsletter_streak || 0} edições\n📅 Última: ${nsState.last_newsletter ? new Date(nsState.last_newsletter).toLocaleDateString('pt-BR') : 'Nunca'}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n${isNewsDay && !nsState.newsletter_sent_today ? '⚠️ Ainda não enviou hoje!' : 'Tudo em dia!'}\n\n━━━━━━━━━━━━━━━━━━━━━━\n📌 *GATILHOS NEWS:*\n• *comecei* → Confirmar que sentou\n• *enviei* → Newsletter publicada\n• *news* → Ver status`;
      break;

    // ============================================
    // METRICS COMMAND
    // ============================================

    case 'metricas':
      try {
        const metrics = await getAllMetrics();
        const ig = metrics.instagram;
        const bee = metrics.beehiiv;
        const prog = metrics.progress;
        const comp = metrics.comparison;
        const hojeMetricas = new Date().toLocaleDateString('pt-BR');

        response = `📊 *MÉTRICAS - ${hojeMetricas}*\n\n━━━━━━━━━━━━━━━━━━━━━━\n📸 *INSTAGRAM*\n━━━━━━━━━━━━━━━━━━━━━━\n\n👥 Seguidores: ${ig.followers.toLocaleString()}\n   Meta: ${BENCHMARKS.followers.current_goal.toLocaleString()}\n   ${prog.followers.bar} ${prog.followers.pct}%\n   ${comp.followers.trend} Ontem: ${comp.followers.symbol}${comp.followers.diff}\n\n📈 Engajamento: ${ig.engagement_rate}%\n📝 Posts: ${ig.posts || ig.media_count || 'N/A'}\n🖼️ Média likes: ${ig.avg_likes}\n💬 Média comments: ${ig.avg_comments}\n\n━━━━━━━━━━━━━━━━━━━━━━\n📰 *NEWSLETTER*\n━━━━━━━━━━━━━━━━━━━━━━\n\n👥 Subscribers: ${bee.subscribers}\n   Meta: ${BENCHMARKS.subscribers.current_goal}\n   ${prog.subscribers.bar} ${prog.subscribers.pct}%\n   ${comp.subscribers.trend} Ontem: ${comp.subscribers.symbol}${comp.subscribers.diff}\n\n📬 Open Rate: ${bee.open_rate}% ${parseFloat(bee.open_rate) >= 40 ? '🟢' : '🟡'}\n🖱️ Click Rate: ${bee.click_rate}% ${parseFloat(bee.click_rate) >= 5 ? '🟢' : '🟡'}\n\n━━━━━━━━━━━━━━━━━━━━━━`;
      } catch (error) {
        response = `❌ Erro ao buscar métricas: ${error.message}`;
      }
      break;

    default:
      return null;
  }

  return response;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // Health check
  if (url.pathname === '/health' || url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'personal-trainer-webhook' }));
    return;
  }

  // Debug endpoint - shows last webhook payload
  if (url.pathname === '/debug') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      lastPayload: global.lastWebhookPayload || null,
      lastTime: global.lastWebhookTime || null,
      envCheck: {
        hasUazapiUrl: !!process.env.UAZAPI_BASE_URL,
        hasUazapiToken: !!process.env.UAZAPI_TOKEN,
        hasNumber: !!process.env.NOTIFICATION_NUMBER,
        number: process.env.NOTIFICATION_NUMBER
      }
    }, null, 2));
    return;
  }

  // Webhook endpoint
  if (url.pathname === '/webhook' && req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body);

        // Save for debug endpoint
        global.lastWebhookPayload = data;
        global.lastWebhookTime = new Date().toISOString();

        console.log(`\n📩 [${new Date().toLocaleTimeString('pt-BR')}] Mensagem recebida:`);
        console.log(`   Payload: ${JSON.stringify(data).substring(0, 500)}`);

        // Extract message text (multiple UazAPI formats)
        const messageText = data.text || data.body || data.message?.text || data.message?.body || data.content?.text || '';

        // Extract sender number (multiple formats)
        const senderNumber = (
          data.sender ||
          data.from ||
          data.chatid ||
          data.chat_id ||
          data.number ||
          data.phone ||
          data.remoteJid ||
          data.key?.remoteJid ||
          ''
        ).replace(/[@s.whatsapp.net:]/g, '').replace(/\D/g, '');

        const fromMe = data.fromMe || data.from_me || data.key?.fromMe || false;

        console.log(`   De: ${senderNumber || 'unknown'}`);
        console.log(`   Texto: ${messageText}`);
        console.log(`   FromMe: ${fromMe}`);

        // Ignore own messages
        if (fromMe) {
          console.log('   ↳ Ignorando (mensagem própria)');
          res.writeHead(200);
          res.end('ok');
          return;
        }

        // Number validation - flexible matching
        const myNumberDigits = YOUR_NUMBER.replace(/\D/g, '');
        const senderDigits = senderNumber.replace(/\D/g, '');

        const numberMatches = senderDigits.length >= 8 && (
          myNumberDigits.includes(senderDigits.slice(-8)) ||
          senderDigits.includes(myNumberDigits.slice(-8))
        );

        // If can't extract number, trust keyword only
        const trustKeywordOnly = senderDigits.length < 8;

        if (!numberMatches && !trustKeywordOnly) {
          console.log(`   ↳ Ignorando (número diferente: ${senderNumber})`);
          res.writeHead(200);
          res.end('ok');
          return;
        }

        if (trustKeywordOnly) {
          console.log(`   ↳ Número não identificado, confiando na palavra-chave`);
        }

        // ============================================
        // OPES MARKETING — Carousel Approval Handler
        // ============================================
        const selectedId = (
          data.message?.buttonOrListid ||
          data.message?.content?.singleSelectReply?.selectedRowID ||
          data.selectedId || data.selected_id ||
          data.listResponse?.selectedId ||
          data.message?.selectedId || ''
        ).trim().toUpperCase();
        const opesDecision = selectedId || messageText.trim().toUpperCase();
        const OPES_DECISIONS = { 'APROVADO': true, 'AJUSTE': true, 'CANCELA': true };

        if (OPES_DECISIONS[opesDecision]) {
          console.log(`   ↳ OPES Marketing — Decisão: ${opesDecision}`);

          let opesResponse;
          switch (opesDecision) {
            case 'APROVADO':
              opesResponse = 'Funcionou, simulação de postagem concluída';
              break;
            case 'AJUSTE':
              opesResponse = 'Ajuste registrado. Descreva o que mudar na próxima mensagem.';
              break;
            case 'CANCELA':
              opesResponse = 'Carrossel cancelado.';
              break;
          }

          if (opesResponse) {
            await sendWhatsApp(opesResponse);
            console.log(`   ↳ OPES: Resposta enviada!`);
          }

          res.writeHead(200);
          res.end('ok');
          return;
        }

        // Keyword validation (Personal Trainer commands)
        const validation = isValidMessage(messageText);

        if (!validation.valid) {
          console.log('   ↳ Ignorando (sem palavra-chave válida)');
          res.writeHead(200);
          res.end('ok');
          return;
        }

        console.log(`   ↳ Palavra-chave válida! Texto limpo: "${validation.cleanText}"`);

        // Detect and process command
        const command = detectCommand(validation.cleanText);

        if (command) {
          console.log(`   ↳ Comando detectado: ${command}`);

          const response = await processCommand(command);

          if (response) {
            await sendWhatsApp(response);
            console.log('   ↳ Resposta enviada!');
          }
        } else {
          console.log('   ↳ Comando não reconhecido');

          await sendWhatsApp(`❓ *Comando não reconhecido*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nComandos válidos:\n• *fiz* ou *postei* → Registrar post\n• *checkin* → Registrar check-in\n• *missao* ou *done* → Completar missão\n• *status* → Ver estado do dia\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nExemplo: *fiz* ou *@coach status*`);
        }

        res.writeHead(200);
        res.end('ok');

      } catch (error) {
        console.error('❌ Erro ao processar webhook:', error.message);
        res.writeHead(500);
        res.end('error');
      }
    });

    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`
🏋️ Personal Trainer Webhook Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Servidor rodando na porta ${PORT}

📍 Endpoints:
   /         → Health check
   /webhook  → Receber mensagens
   /debug    → Ver último payload

📱 Comandos Instagram:
   • fiz, postei   → Registrar post
   • checkin       → Registrar check-in
   • missao, done  → Completar missão
   • status        → Ver estado

📰 Comandos Newsletter:
   • comecei       → Começou a escrever
   • enviei        → Newsletter publicada
   • news          → Status da newsletter

📊 Analytics:
   • metricas      → Ver números IG + Newsletter

📣 OPES Marketing:
   • APROVADO      → Aprovar carrossel
   • AJUSTE        → Pedir ajuste
   • CANCELA       → Cancelar carrossel

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Encerrando servidor...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando servidor...');
  server.close(() => process.exit(0));
});

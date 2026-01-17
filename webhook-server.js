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
const { markCheckinDone, markMissionDone, markPosted, loadState } = require('./scheduler');

const PORT = process.env.PORT || 3847;
const YOUR_NUMBER = process.env.NOTIFICATION_NUMBER || '5592981951096';

// Security: Valid prefixes and keywords
const PREFIXOS_VALIDOS = ['@coach', '@trainer', '/trainer', '!trainer', 'coach', 'trainer'];
const PALAVRAS_EXATAS = [
  'fiz', 'postei', 'publiquei',
  'checkin', 'check',
  'missao', 'missão', 'done',
  'status',
  'ajuda', 'help'
];

const commands = {
  postei: ['fiz', 'postei', 'publiquei', 'posted', 'feito', 'pronto'],
  checkin: ['checkin', 'check', 'check-in', 'fiz checkin', 'fiz check'],
  missao: ['missao', 'missão', 'done', 'concluido', 'fiz missao', 'fiz missão', 'completei'],
  status: ['status', 'como estou', 'progresso'],
  ajuda: ['ajuda', 'help', 'comandos', '?']
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
        response = `✅ *POSTOU! REGISTRADO!*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n🔥 *STREAK: ${newState.streak_days} DIAS!*\n\nIsso aí! Consistência é o jogo.\n\n🏆 Achievement: Semana Consistente!\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nCobrança das 18h: *CANCELADA*\n\nSegue o ritmo!`;
      } else {
        response = `✅ *REGISTRADO!*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nPost de hoje: ✓\nStreak atual: ${newState.streak_days} dia${newState.streak_days > 1 ? 's' : ''}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nCobrança das 18h: *CANCELADA*\n\nBom trabalho. Agora descansa ou faz mais.`;
      }
      break;

    case 'checkin':
      markCheckinDone();
      response = `✅ *CHECK-IN REGISTRADO!*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nDia começou com foco.\n\nCobrança das 11h: *CANCELADA*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nAgora vai executar a missão!`;
      break;

    case 'missao':
      markMissionDone();
      response = `🎉 *MISSÃO COMPLETA!*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nVocê fez o que tinha que fazer.\n\nIsso é mais do que 90% das pessoas fazem.\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nCobrança das 14h: *CANCELADA*\n\nQuer fazer mais? Ou tá bom por hoje?`;
      break;

    case 'status':
      const hoje = new Date().toLocaleDateString('pt-BR');
      response = `📊 *STATUS - ${hoje}*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nCheck-in: ${state.checkin_done_today ? '✅' : '❌'}\nMissão: ${state.mission_done_today ? '✅' : '❌'}\nPostou: ${state.posted_today ? '✅' : '❌'}\n\n🔥 Streak: ${state.streak_days || 0} dias\n📨 Mensagens hoje: ${state.messages_today || 0}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n${!state.posted_today ? '⚠️ Ainda não postou hoje!' : 'Tudo em dia!'}`;
      break;

    case 'ajuda':
      response = `🏋️ *COMANDOS DO PERSONAL*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n*PALAVRAS-CHAVE DIRETAS:*\n• *fiz* ou *postei* → Registrar post\n• *checkin* → Registrar check-in\n• *missao* ou *done* → Completar missão\n• *status* → Ver estado do dia\n\n*OU USE PREFIXO:*\n• @coach [comando]\n• @trainer [comando]\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n_Outras mensagens são ignoradas._`;
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

  // Webhook endpoint
  if (url.pathname === '/webhook' && req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body);

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

        // Keyword validation
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

📱 Comandos WhatsApp:
   • fiz, postei   → Registrar post
   • checkin       → Registrar check-in
   • missao, done  → Completar missão
   • status        → Ver estado

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

/**
 * WhatsApp Integration - Personal Trainer (Deploy Version)
 * Uses environment variables for credentials
 */

const https = require('https');

// Credenciais via variáveis de ambiente
const UAZAPI_BASE_URL = process.env.UAZAPI_BASE_URL || 'https://jcarlosamorimppt.uazapi.com';
const UAZAPI_TOKEN = process.env.UAZAPI_TOKEN;
const NOTIFICATION_NUMBER = process.env.NOTIFICATION_NUMBER || '5592981951096';

async function sendWhatsApp(text) {
  if (!UAZAPI_TOKEN) {
    throw new Error('UAZAPI_TOKEN não configurado');
  }

  const data = JSON.stringify({
    number: NOTIFICATION_NUMBER,
    text: text
  });

  const url = new URL(`${UAZAPI_BASE_URL}/send/text`);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'token': UAZAPI_TOKEN,
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ status: 'sent', raw: body });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const templates = {
  cobrar: (data) => {
    const brutais = [
      `🔥 *ACORDA, JOSÉ!*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n${data.days_without_post > 1 ? `*${data.days_without_post} DIAS* sem postar.` : `Você NÃO postou hoje.`}\n\nSabe o que acontece enquanto você procrastina?\n\n• Seus concorrentes estão postando\n• Sua audiência está esquecendo você\n• O algoritmo está te enterrando\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nVocê disse que queria 10K seguidores.\nMentiu pra si mesmo?\n\n*Ou vai parar de frescura e postar?*`,
      `⚠️ *JOSÉ, PARA DE ENROLAR*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nEu sei que seu cérebro TDAH tá dizendo:\n"Depois eu posto"\n"Não tô inspirado"\n"Amanhã eu compenso"\n\n*MENTIRA.*\n\nAmanhã você vai inventar outra desculpa.\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nA diferença entre quem chega nos 10K e quem fica estagnado?\n\n*CONSISTÊNCIA.*\n\nPara de ler e VAI POSTAR.`,
      `😤 *SÉRIO MESMO, JOSÉ?*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nVocê quer ser referência em IA no Brasil.\nQuer 10K seguidores.\nQuer autoridade.\n\nMas não consegue postar 1 conteúdo por dia?\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nEnquanto você "não tá inspirado":\n\n→ Criadores menores estão crescendo\n→ Sua audiência tá seguindo outros\n\n*A única pessoa te segurando é VOCÊ.*\n\nProva que eu tô errado.\nPosta AGORA e me manda "fiz".`
    ];
    return brutais[Math.floor(Math.random() * brutais.length)];
  },

  cobrarCheckin: () => {
    const msgs = [
      `😤 *JOSÉ, CADÊ O CHECK-IN?*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nComeçou o dia sem direção.\nParabéns. Receita perfeita pra não fazer NADA.\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nCheck-in é o MÍNIMO. 5 minutos.\nE você não consegue nem isso?\n\nAbre o Claude. Digita /check-in.\nOu continua improvisando.`,
      `🔥 *ACORDA!*\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nCheck-in não feito = dia jogado fora.\n\nVocê quer 10K seguidores.\nMas não consegue fazer um check-in de 5 minutos?\n\n*Tá de brincadeira comigo?*\n\nVAI FAZER O CHECK-IN AGORA.`
    ];
    return msgs[Math.floor(Math.random() * msgs.length)];
  }
};

module.exports = { sendWhatsApp, templates };

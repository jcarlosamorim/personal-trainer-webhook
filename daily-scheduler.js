/**
 * Daily Scheduler - Personal Trainer + Newsletter
 * Envia mensagens automáticas em horários específicos
 *
 * INSTAGRAM (todos os dias):
 *   09:00 - Mensagem matinal (missão do dia + métricas + insight)
 *   14:00 - Lembrete se não fez check-in
 *   18:00 - Cobrança se não postou
 *
 * NEWSLETTER (terça e sexta):
 *   08:00 Segunda - Lembrete "amanhã é dia de newsletter" (terça)
 *   09:00 Terça   - Missão newsletter (tema + ângulo + porquê)
 *   14:00 Terça   - Cobrança "já começou a escrever?"
 *   08:00 Quinta  - Lembrete "amanhã é dia de newsletter" (sexta)
 *   09:00 Sexta   - Missão newsletter (tema + ângulo + porquê)
 *   14:00 Sexta   - Cobrança "já começou a escrever?"
 *
 * Environment variables:
 *   TZ - Timezone (default: America/Sao_Paulo)
 */

const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { sendWhatsApp } = require('./whatsapp');
const { getAllMetrics, generateProgressBar, BENCHMARKS } = require('./metrics');
const { loadState } = require('./scheduler');

// Timezone
process.env.TZ = process.env.TZ || 'America/Sao_Paulo';

// File paths
const QUOTES_FILE = './data/naval-quotes.json';
const CALENDAR_FILE = process.env.CALENDAR_FILE || './data/calendario-editorial.yaml';

// ============================================
// Naval Quotes System
// ============================================

function loadQuotes() {
  try {
    if (fs.existsSync(QUOTES_FILE)) {
      return JSON.parse(fs.readFileSync(QUOTES_FILE, 'utf8'));
    }
  } catch (e) {}
  return { quotes: [], usedIndices: [] };
}

function saveQuotes(data) {
  const dir = path.dirname(QUOTES_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(QUOTES_FILE, JSON.stringify(data, null, 2));
}

function getRandomQuote() {
  const data = loadQuotes();
  const quotes = data.quotes || [];

  if (quotes.length === 0) {
    return {
      text: "Leverage comes from capital, code, and content.",
      theme: "alavancagem",
      connection: "Cada post é um ativo que trabalha pra você."
    };
  }

  // Reset if all used
  if (data.usedIndices.length >= quotes.length) {
    data.usedIndices = [];
  }

  // Find unused quote
  let index;
  do {
    index = Math.floor(Math.random() * quotes.length);
  } while (data.usedIndices.includes(index));

  // Mark as used
  data.usedIndices.push(index);
  data.lastUsed = new Date().toISOString();
  saveQuotes(data);

  return quotes[index];
}

// ============================================
// Calendar / Mission System
// ============================================

function loadCalendar() {
  try {
    // Try deploy folder first
    if (fs.existsSync(CALENDAR_FILE)) {
      const content = fs.readFileSync(CALENDAR_FILE, 'utf8');
      return yaml.load(content);
    }
    // Fallback to embedded calendar
    return getEmbeddedCalendar();
  } catch (e) {
    console.error('Error loading calendar:', e.message);
    return getEmbeddedCalendar();
  }
}

function getEmbeddedCalendar() {
  // Embedded calendar for when YAML not available
  return {
    semana_20_26_jan: {
      segunda_20: { titulo: "5 prompts que uso TODO DIA", pilar: "Educativo", formato: "Carrossel" },
      quarta_22: { titulo: "Por que 2026 é o ano do criador com IA", pilar: "Autoridade", formato: "Carrossel" },
      sexta_24: { titulo: "Como TDAH me ajuda a usar IA melhor", pilar: "Conexão", formato: "Carrossel" }
    },
    semana_27_jan_02_fev: {
      segunda_27: { titulo: "Framework OMFA: Como pensar com IA", pilar: "Educativo", formato: "Carrossel" },
      quarta_29: { titulo: "3 erros que criadores cometem com IA", pilar: "Autoridade", formato: "Carrossel" },
      sexta_31: { titulo: "1 ano usando IA: o que Naval me ensinou", pilar: "Conexão", formato: "Carrossel" }
    },
    semana_03_09_fev: {
      segunda_03: { titulo: "O prompt perfeito não existe, mas...", pilar: "Educativo", formato: "Carrossel" },
      quarta_05: { titulo: "Algo novo vem aí...", pilar: "Teaser", formato: "Carrossel" },
      sexta_07: { titulo: "[LANÇAMENTO] Inscrições abertas", pilar: "Venda", formato: "Carrossel" }
    }
  };
}

function getTodayMission() {
  const calendar = loadCalendar();
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, 2=Tue, etc
  const dayOfMonth = today.getDate();

  // Map day to Portuguese key pattern
  const dayMap = {
    1: 'segunda', 2: 'terca', 3: 'quarta',
    4: 'quinta', 5: 'sexta', 6: 'sabado', 0: 'domingo'
  };
  const dayPrefix = dayMap[dayOfWeek];

  // Search all weeks for today's post
  for (const weekKey of Object.keys(calendar)) {
    // Only process week keys (semana_*), skip metadata keys
    if (!weekKey.startsWith('semana_') || weekKey === 'stories_rotina' || weekKey.startsWith('metricas')) {
      continue;
    }

    const week = calendar[weekKey];
    if (!week || typeof week !== 'object') continue;

    for (const dayKey of Object.keys(week)) {
      // Match day key pattern: segunda_20, quarta_22, etc
      if (dayKey.startsWith(dayPrefix + '_')) {
        const dayNum = parseInt(dayKey.split('_')[1]);
        if (dayNum === dayOfMonth) {
          return week[dayKey];
        }
      }
    }
  }

  // No scheduled post today
  return null;
}

function getMissionContext(mission) {
  if (!mission) {
    return {
      hasMission: false,
      title: null,
      pilar: null,
      formato: null,
      porque: "Hoje não tem post no calendário. Dia de descanso ou criação livre."
    };
  }

  // Build the "porque" based on pilar
  const porqueMap = {
    'Educativo': `Hoje é dia de entregar VALOR. Post educativo gera saves e shares. Você está construindo sua biblioteca de autoridade.`,
    'Autoridade': `Hoje você se posiciona como REFERÊNCIA. Opinião forte, visão de futuro. É assim que se diferencia dos outros.`,
    'Conexão': `Hoje é dia de HUMANIZAR. Vulnerabilidade gera identificação. As pessoas seguem pessoas, não marcas.`,
    'Teaser': `Hoje você planta CURIOSIDADE. A antecipação é mais poderosa que a revelação. Deixe eles querendo mais.`,
    'Venda': `Hoje é dia de COLHER. Você plantou, agora converte. Seja direto, mostre o valor, faça o CTA claro.`
  };

  // Check for philosophy angle
  const pilarBase = mission.pilar?.split('+')[0]?.trim() || 'Educativo';
  const hasPhilosophy = mission.pilar?.includes('Filosofia') || mission.naval_angle;

  let porque = porqueMap[pilarBase] || porqueMap['Educativo'];

  if (hasPhilosophy && mission.naval_angle) {
    porque += `\n\n💡 Ângulo Naval: "${mission.naval_angle}"`;
  }

  return {
    hasMission: true,
    title: mission.titulo,
    pilar: mission.pilar,
    formato: mission.formato,
    descricao: mission.descricao,
    cta: mission.cta,
    porque
  };
}

// ============================================
// Newsletter Calendar & Mission System
// ============================================

const NEWSLETTER_CALENDAR = {
  // Semana 1 (20-26 Jan)
  '2026-01-21': {
    dia: 'Terça',
    tema: 'O que é Nexialismo',
    angulo: 'Introduzir o termo + os 3 pilares + Por que agora (Segundo Renascimento)',
    estrutura: [
      'Abrir com o Segundo Renascimento (Gutenberg → ChatGPT)',
      'Definir Nexialista (polímata moderno)',
      'Os 3 pilares (Obsessão, Egoísmo Estratégico, Autoria Cognitiva)',
      'CTA: "Qual pilar mais ressoou?"'
    ],
    porque: `Hoje você PLANTA o vocabulário.
Quem lê essa edição vai sair falando
"Nexialista", "Aprendizado por Obsessão",
"Autoria Cognitiva".

É o primeiro tijolo do Mundo Próprio.
Sem essa edição, o resto não faz sentido.`,
    conexao_ig: 'O post de ontem ("5 prompts") preparou o terreno. O post de hoje ("Ano do Nexialista") direciona pra essa newsletter.'
  },
  '2026-01-24': {
    dia: 'Sexta',
    tema: 'Por que criei a Sociedade dos Nexialistas',
    angulo: 'História pessoal + visão de futuro + convite',
    estrutura: [
      'Sua jornada (jornalismo → IA → educador)',
      'O problema que você viu (especialização forçada)',
      'A solução (Nexialismo como filosofia)',
      'O convite (fazer parte da Sociedade)',
      'CTA: "Você se considera um Nexialista?"'
    ],
    porque: `Hoje você HUMANIZA a filosofia.
Conceitos são frios. Histórias conectam.

Quem leu terça entendeu O QUE é.
Hoje entende POR QUE existe.

Isso transforma leitor em seguidor.`,
    conexao_ig: 'Os posts da semana construíram a base. Essa newsletter fecha o ciclo de introdução.'
  },
  // Semana 2 (27 Jan - 02 Fev)
  '2026-01-28': {
    dia: 'Terça',
    tema: 'Aprendizado por Obsessão (Pilar 1)',
    angulo: 'Definição profunda + exemplos + como aplicar',
    estrutura: [
      'O que é (seguir obsessão, não currículo)',
      'O que NÃO é (não é ser disperso)',
      'Seus exemplos pessoais (5 faculdades)',
      'Como identificar suas obsessões',
      'CTA: "O que você pesquisa de madrugada?"'
    ],
    porque: `Primeiro pilar em profundidade.
O Instagram introduziu. A newsletter APROFUNDA.

Quem lê essa edição sai com vocabulário
pra explicar por que largou coisas.`,
    conexao_ig: 'O post "Como TDAH me fez criar minha própria filosofia" é o gancho perfeito.'
  },
  '2026-01-31': {
    dia: 'Sexta',
    tema: 'Minhas 5 faculdades (e por que larguei todas)',
    angulo: 'História pessoal completa + lições',
    estrutura: [
      'Faculdade 1: o que era, por que largou',
      'Faculdade 2: o padrão começou a aparecer',
      'Faculdades 3-5: a obsessão sempre vencia',
      'O que aprendi (obsessão > obrigação)',
      'CTA: "Você já largou algo que deveria terminar?"'
    ],
    porque: `Essa é a newsletter mais PESSOAL até agora.
Vulnerabilidade gera conexão.

Quem lê isso entende que você viveu
o que ensina. Não é teoria.`,
    conexao_ig: 'O post de sábado "Larguei 5 faculdades..." é teaser direto pra essa newsletter.'
  },
  // Semana 3 (03-09 Fev)
  '2026-02-04': {
    dia: 'Terça',
    tema: 'Egoísmo Estratégico (Pilar 2)',
    angulo: 'Por que ser "egoísta" te torna mais útil',
    estrutura: [
      'O nome provoca (de propósito)',
      'Definição real (servir a si primeiro)',
      'Exemplos de quando disse NÃO',
      'O paradoxo (egoísmo gera valor)',
      'CTA: "Você consegue dizer não?"'
    ],
    porque: `O nome "Egoísmo Estratégico" incomoda.
BOM. Incomodar faz pensar.

Essa newsletter redefine uma palavra
que todo mundo acha que entende.`,
    conexao_ig: 'O post "Ser egoísta me tornou mais útil" prepara o terreno.'
  },
  '2026-02-07': {
    dia: 'Sexta',
    tema: 'Quando disse NÃO (e minha vida mudou)',
    angulo: 'Casos reais de recusas estratégicas',
    estrutura: [
      'O NÃO que doeu (mas era necessário)',
      'O NÃO que parecia burrice (mas era visão)',
      'O NÃO que decepcionou outros (mas te salvou)',
      'Como avaliar quando dizer NÃO',
      'CTA: "Que NÃO você precisa dizer?"'
    ],
    porque: `Histórias de NÃO são poderosas.
Todo mundo admira quem recusa.

Essa newsletter dá PERMISSÃO pro leitor
recusar o que não serve.`,
    conexao_ig: 'Semana de teaser/lançamento. Essa newsletter é último conteúdo de valor antes da abertura.'
  }
};

function getNewsletterMission(dateStr) {
  return NEWSLETTER_CALENDAR[dateStr] || null;
}

function getTodayNewsletterMission() {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  return getNewsletterMission(dateStr);
}

function getTomorrowNewsletterMission() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];
  return getNewsletterMission(dateStr);
}

async function buildNewsletterMissionMessage() {
  const mission = getTodayNewsletterMission();
  if (!mission) return null;

  const metrics = await getAllMetrics();
  const bee = metrics.beehiiv;
  const prog = metrics.progress;

  const today = new Date();
  const dateStr = today.toLocaleDateString('pt-BR');

  let msg = `━━━━━━━━━━━━━━━━━━━━━━
📰 *NEWSLETTER DE HOJE*
${mission.dia}, ${dateStr}
━━━━━━━━━━━━━━━━━━━━━━

📍 *TEMA*
"${mission.tema}"

🎯 *ÂNGULO*
${mission.angulo}

📝 *ESTRUTURA SUGERIDA*
`;

  mission.estrutura.forEach((item, i) => {
    msg += `${i + 1}. ${item}\n`;
  });

  msg += `
━━━━━━━━━━━━━━━━━━━━━━

💡 *PORQUE ESSA NEWS*

${mission.porque}

━━━━━━━━━━━━━━━━━━━━━━

📊 *SEUS NÚMEROS*

Subscribers: ${bee.subscribers} → Meta: 500
${prog.subscribers.bar} ${prog.subscribers.pct}%

Open Rate: ${bee.open_rate}% (${parseFloat(bee.open_rate) >= 40 ? 'acima da média!' : 'melhorando'})
Click Rate: ${bee.click_rate}%

Cada newsletter bem escrita = +3 a +10 subs

━━━━━━━━━━━━━━━━━━━━━━

🔗 *CONEXÃO COM INSTAGRAM*

${mission.conexao_ig}

━━━━━━━━━━━━━━━━━━━━━━

⏰ *DEADLINE*
Publicar até 19h

━━━━━━━━━━━━━━━━━━━━━━

📌 *Responde:*
• *comecei* → Confirmar que sentou
• *enviei* → Confirmar publicação
• *news status* → Ver estado

━━━━━━━━━━━━━━━━━━━━━━`;

  return msg;
}

function buildNewsletterReminderMessage() {
  const tomorrow = getTomorrowNewsletterMission();
  if (!tomorrow) return null;

  return `━━━━━━━━━━━━━━━━━━━━━━
🧠 *LEMBRETE - NEWSLETTER*
━━━━━━━━━━━━━━━━━━━━━━

Amanhã é dia de newsletter.

📍 *TEMA:* "${tomorrow.tema}"
🎯 *ÂNGULO:* ${tomorrow.angulo}

━━━━━━━━━━━━━━━━━━━━━━

Já começa a pensar no que vai escrever.
Amanhã às 09h você recebe o briefing completo.

━━━━━━━━━━━━━━━━━━━━━━`;
}

function buildNewsletterCobrancaMessage() {
  const state = loadState();
  if (state.newsletter_started_today) return null;

  const mission = getTodayNewsletterMission();
  if (!mission) return null;

  return `━━━━━━━━━━━━━━━━━━━━━━
⚠️ *NEWSLETTER - COBRANÇA*
━━━━━━━━━━━━━━━━━━━━━━

José, você não confirmou que começou.

Enquanto você adia:
• 74 pessoas esperam conteúdo seu
• A consistência quebra
• A confiança diminui

━━━━━━━━━━━━━━━━━━━━━━

📍 Lembra do tema:
"${mission.tema}"

💡 Lembra do porquê:
${mission.porque.split('\n')[0]}

━━━━━━━━━━━━━━━━━━━━━━

Senta. Escreve. Me manda *comecei*.

Você tem até 19h.

━━━━━━━━━━━━━━━━━━━━━━`;
}

// ============================================
// Message Builders
// ============================================

async function buildMorningMessage() {
  // Get all data
  const metrics = await getAllMetrics();
  const quote = getRandomQuote();
  const mission = getTodayMission();
  const missionContext = getMissionContext(mission);
  const state = loadState();

  const today = new Date();
  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const dayName = dayNames[today.getDay()];
  const dateStr = today.toLocaleDateString('pt-BR');

  // Build message
  let msg = `━━━━━━━━━━━━━━━━━━━━━━
🌅 *BOM DIA, JOSÉ*
${dayName}, ${dateStr}
━━━━━━━━━━━━━━━━━━━━━━

`;

  // Mission Section (PORQUE)
  if (missionContext.hasMission) {
    msg += `📍 *MISSÃO DE HOJE*

*"${missionContext.title}"*
Formato: ${missionContext.formato} | Pilar: ${missionContext.pilar}

*PORQUE ESSE POST:*
${missionContext.porque}

━━━━━━━━━━━━━━━━━━━━━━

`;
  } else {
    msg += `📍 *HOJE*

${missionContext.porque}

━━━━━━━━━━━━━━━━━━━━━━

`;
  }

  // Metrics Section
  const ig = metrics.instagram;
  const bee = metrics.beehiiv;
  const comp = metrics.comparison;
  const prog = metrics.progress;

  msg += `📊 *SEUS NÚMEROS vs META*

*Instagram*
Seguidores: ${ig.followers.toLocaleString()} → Meta: ${BENCHMARKS.followers.current_goal.toLocaleString()}
${prog.followers.bar} ${prog.followers.pct}%
${comp.followers.trend} Ontem: ${comp.followers.symbol}${comp.followers.diff}

Engajamento: ${ig.engagement_rate}% → Meta: ${BENCHMARKS.engagement.current_goal}%
${prog.engagement.bar} ${prog.engagement.pct}%

*Newsletter*
Subscribers: ${bee.subscribers} → Meta: ${BENCHMARKS.subscribers.current_goal}
${prog.subscribers.bar} ${prog.subscribers.pct}%
${comp.subscribers.trend} Ontem: ${comp.subscribers.symbol}${comp.subscribers.diff}

Open Rate: ${bee.open_rate}% | CTR: ${bee.click_rate}%

━━━━━━━━━━━━━━━━━━━━━━

`;

  // Streak Section
  msg += `🔥 *STREAK*

Posts consecutivos: ${state.streak_days || 0} dias
${state.streak_days >= 7 ? '🏆 Semana consistente!' : state.streak_days >= 3 ? '💪 Bom ritmo!' : '🌱 Construindo...'}

━━━━━━━━━━━━━━━━━━━━━━

`;

  // Naval Quote Section
  msg += `💡 *INSIGHT DO DIA*

"${quote.text}"
— Naval Ravikant

_${quote.connection}_

━━━━━━━━━━━━━━━━━━━━━━

📌 *GATILHOS:*
• *checkin* → Confirmar que viu
• *fiz* → Registrar post
• *status* → Ver progresso

━━━━━━━━━━━━━━━━━━━━━━`;

  return msg;
}

function buildReminderMessage(type) {
  const state = loadState();

  if (type === 'checkin' && state.checkin_done_today) {
    return null; // Already did checkin
  }

  if (type === 'post' && state.posted_today) {
    return null; // Already posted
  }

  const messages = {
    checkin: `⏰ *LEMBRETE - 14h*

━━━━━━━━━━━━━━━━━━━━━━

Você não fez check-in hoje.

Sem check-in = dia sem direção.

━━━━━━━━━━━━━━━━━━━━━━

Ainda dá tempo.
Responde *checkin* pra confirmar que tá no jogo.

━━━━━━━━━━━━━━━━━━━━━━
📌 *GATILHOS:*
• *checkin* → Confirmar
• *fiz* → Registrar post
• *status* → Ver progresso`,

    post: `⚠️ *COBRANÇA - 18h*

━━━━━━━━━━━━━━━━━━━━━━

José, você NÃO postou hoje.

Enquanto você adia:
• Concorrentes estão postando
• Algoritmo está te enterrando
• Streak vai quebrar

━━━━━━━━━━━━━━━━━━━━━━

Você quer 10K seguidores?
Então para de inventar desculpa.

*POSTA AGORA* e me manda *fiz*.

━━━━━━━━━━━━━━━━━━━━━━
📌 *GATILHOS:*
• *fiz* → Registrar post
• *status* → Ver progresso`
  };

  return messages[type];
}

// ============================================
// Cron Jobs
// ============================================

function startScheduler() {
  console.log(`
🕐 Daily Scheduler Iniciado
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 Timezone: ${process.env.TZ}
📍 Horários programados:
   • 09:00 - Mensagem matinal
   • 14:00 - Lembrete check-in
   • 18:00 - Cobrança post

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  // 09:00 - Morning message
  cron.schedule('0 9 * * *', async () => {
    console.log(`[${new Date().toLocaleTimeString()}] Enviando mensagem matinal...`);
    try {
      const msg = await buildMorningMessage();
      await sendWhatsApp(msg);
      console.log('✅ Mensagem matinal enviada!');
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem matinal:', error.message);
    }
  }, {
    timezone: process.env.TZ
  });

  // 14:00 - Checkin reminder
  cron.schedule('0 14 * * *', async () => {
    console.log(`[${new Date().toLocaleTimeString()}] Verificando check-in...`);
    try {
      const msg = buildReminderMessage('checkin');
      if (msg) {
        await sendWhatsApp(msg);
        console.log('✅ Lembrete de check-in enviado!');
      } else {
        console.log('ℹ️ Check-in já feito, pulando lembrete');
      }
    } catch (error) {
      console.error('❌ Erro ao enviar lembrete:', error.message);
    }
  }, {
    timezone: process.env.TZ
  });

  // 18:00 - Post reminder
  cron.schedule('0 18 * * *', async () => {
    console.log(`[${new Date().toLocaleTimeString()}] Verificando post do dia...`);
    try {
      const msg = buildReminderMessage('post');
      if (msg) {
        await sendWhatsApp(msg);
        console.log('✅ Cobrança de post enviada!');
      } else {
        console.log('ℹ️ Já postou hoje, pulando cobrança');
      }
    } catch (error) {
      console.error('❌ Erro ao enviar cobrança:', error.message);
    }
  }, {
    timezone: process.env.TZ
  });

  // ============================================
  // NEWSLETTER CRON JOBS
  // ============================================

  // Segunda 08:00 - Lembrete "amanhã é newsletter" (terça)
  cron.schedule('0 8 * * 1', async () => {
    console.log(`[${new Date().toLocaleTimeString()}] Verificando lembrete newsletter terça...`);
    try {
      const msg = buildNewsletterReminderMessage();
      if (msg) {
        await sendWhatsApp(msg);
        console.log('✅ Lembrete newsletter terça enviado!');
      }
    } catch (error) {
      console.error('❌ Erro ao enviar lembrete newsletter:', error.message);
    }
  }, { timezone: process.env.TZ });

  // Terça 09:00 - Missão newsletter
  cron.schedule('0 9 * * 2', async () => {
    console.log(`[${new Date().toLocaleTimeString()}] Enviando missão newsletter terça...`);
    try {
      const msg = await buildNewsletterMissionMessage();
      if (msg) {
        await sendWhatsApp(msg);
        console.log('✅ Missão newsletter terça enviada!');
      }
    } catch (error) {
      console.error('❌ Erro ao enviar missão newsletter:', error.message);
    }
  }, { timezone: process.env.TZ });

  // Terça 14:00 - Cobrança newsletter
  cron.schedule('0 14 * * 2', async () => {
    console.log(`[${new Date().toLocaleTimeString()}] Verificando newsletter terça...`);
    try {
      const msg = buildNewsletterCobrancaMessage();
      if (msg) {
        await sendWhatsApp(msg);
        console.log('✅ Cobrança newsletter terça enviada!');
      } else {
        console.log('ℹ️ Newsletter já iniciada, pulando cobrança');
      }
    } catch (error) {
      console.error('❌ Erro ao enviar cobrança newsletter:', error.message);
    }
  }, { timezone: process.env.TZ });

  // Quinta 08:00 - Lembrete "amanhã é newsletter" (sexta)
  cron.schedule('0 8 * * 4', async () => {
    console.log(`[${new Date().toLocaleTimeString()}] Verificando lembrete newsletter sexta...`);
    try {
      const msg = buildNewsletterReminderMessage();
      if (msg) {
        await sendWhatsApp(msg);
        console.log('✅ Lembrete newsletter sexta enviado!');
      }
    } catch (error) {
      console.error('❌ Erro ao enviar lembrete newsletter:', error.message);
    }
  }, { timezone: process.env.TZ });

  // Sexta 09:00 - Missão newsletter
  cron.schedule('0 9 * * 5', async () => {
    console.log(`[${new Date().toLocaleTimeString()}] Enviando missão newsletter sexta...`);
    try {
      const msg = await buildNewsletterMissionMessage();
      if (msg) {
        await sendWhatsApp(msg);
        console.log('✅ Missão newsletter sexta enviada!');
      }
    } catch (error) {
      console.error('❌ Erro ao enviar missão newsletter:', error.message);
    }
  }, { timezone: process.env.TZ });

  // Sexta 14:00 - Cobrança newsletter
  cron.schedule('0 14 * * 5', async () => {
    console.log(`[${new Date().toLocaleTimeString()}] Verificando newsletter sexta...`);
    try {
      const msg = buildNewsletterCobrancaMessage();
      if (msg) {
        await sendWhatsApp(msg);
        console.log('✅ Cobrança newsletter sexta enviada!');
      } else {
        console.log('ℹ️ Newsletter já iniciada, pulando cobrança');
      }
    } catch (error) {
      console.error('❌ Erro ao enviar cobrança newsletter:', error.message);
    }
  }, { timezone: process.env.TZ });

  console.log('✅ Todos os cron jobs configurados (Instagram + Newsletter)!\n');
}

// ============================================
// Manual Triggers (for testing)
// ============================================

async function sendMorningNow() {
  console.log('Enviando mensagem matinal manualmente...');
  const msg = await buildMorningMessage();
  await sendWhatsApp(msg);
  console.log('✅ Enviada!');
}

async function sendReminderNow(type) {
  console.log(`Enviando ${type} manualmente...`);
  const msg = buildReminderMessage(type);
  if (msg) {
    await sendWhatsApp(msg);
    console.log('✅ Enviada!');
  } else {
    console.log('ℹ️ Condição já satisfeita, nada enviado');
  }
}

module.exports = {
  startScheduler,
  buildMorningMessage,
  buildReminderMessage,
  getTodayMission,
  getRandomQuote,
  sendMorningNow,
  sendReminderNow
};

// Start if run directly
if (require.main === module) {
  startScheduler();
}

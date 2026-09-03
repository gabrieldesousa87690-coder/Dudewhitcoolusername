const Canvas = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

// 🔥 BANNER DE FUNDO (736x736 como pediu)
const BANNER_URL = 'https://i.postimg.cc/66nPm5W8/971852c030429bb8f19f2749d5cf06cf.jpg';

// 🔥 CAMINHO DO BANCO DE EXP
const EXP_PATH = path.join(__dirname, 'tmp', 'exp.json');

// 🔥 GARANTE PASTA E ARQUIVO EXISTEM
function initExpFile() {
  fs.ensureDirSync(path.dirname(EXP_PATH));
  if (!fs.existsSync(EXP_PATH)) fs.writeJSONSync(EXP_PATH, {}, { spaces: 2 });
}

// 🔥 CARREGA DADOS
function loadExp() {
  initExpFile();
  try { return fs.readJSONSync(EXP_PATH); }
  catch { return {}; }
}

// 🔥 SALVA DADOS
function saveExp(data) {
  fs.writeJSONSync(EXP_PATH, data, { spaces: 2 });
}

// 🔥 CONTABILIZA EXP EM TODA MENSAGEM
module.exports.onChat = async ({ api, event }) => {
  const { senderID, threadID, isGroup } = event;
  if (!isGroup || senderID === api.getCurrentUserID()) return;
  
  const exp = loadExp();
  const gid = threadID;
  if (!exp[gid]) exp[gid] = {};
  if (!exp[gid][senderID]) exp[gid][senderID] = 0;
  exp[gid][senderID] += 1; // 1 mensagem = 1 EXP
  saveExp(exp);
};

// 🔥 COMANDO !ranking
module.exports = {
  config: {
    name: "ranking",
    aliases: ["top", "pontos", "exp"],
    version: "1.0",
    author: "Tu",
    countDown: 8,
    role: 0,
    description: { pt: "Veja o ranking de interação do grupo" },
    category: "grupo",
    guide: { pt: "   {pn}: Mostra o Top 3 do grupo" }
  },

  onStart: async function ({ api, event }) {
    try {
      const { threadID, messageID } = event;
      const gid = threadID;
      const expData = loadExp()[gid] || {};

      if (Object.keys(expData).length === 0) {
        return api.sendMessage("📊 Ainda não há dados de ranking neste grupo!", threadID, messageID);
      }

      // 🔥 ORDENA E PEGA TOP 3
      const ranking = Object.entries(expData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      // 🔥 BUSCA NOMES E AVATARES
      const users = [];
      for (const [uid, pontos] of ranking) {
        const info = await api.getUserInfo(uid);
        users.push({
          uid,
          name: info[uid]?.name || `Usuário ${uid}`,
          exp: pontos,
          avatarUrl: `https://graph.facebook.com/${uid}/picture?width=300&height=300`
        });
      }

      const pathImg = path.join(__dirname, 'cache', `ranking_${gid}.png`);
      await generateRankingBanner(pathImg, users);

      return api.sendMessage(
        { attachment: fs.createReadStream(pathImg) },
        threadID,
        () => { if (fs.existsSync(pathImg)) fs.unlinkSync(pathImg); },
        messageID
      );

    } catch (err) {
      console.error('Erro no ranking:', err);
      return api.sendMessage(`❌ Erro: ${err.message}`, event.threadID, event.messageID);
    }
  }
};

// 🔥 DESENHA A IMAGEM — LAYOUT EXATO QUE PEDIU
async function generateRankingBanner(pathImg, top3) {
  const width = 736;
  const height = 736;
  const canvas = Canvas.createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. DESENHA BANNER DE FUNDO
  try {
    const res = await axios.get(BANNER_URL, { responseType: 'arraybuffer' });
    const banner = await Canvas.loadImage(Buffer.from(res.data));
    ctx.drawImage(banner, 0, 0, width, height);
  } catch {
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, width, height);
  }

  // 2. FUNDO SEMI-TRANSPARENTE
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, 40, 40, width - 80, height - 80, 25);
  ctx.fill();

  // 3. TÍTULO
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 52px Arial';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 10;
  ctx.fillText('🏆 RANKING DE EXP', width / 2, 100);
  ctx.shadowBlur = 0;

  // 4. LAYOUT: Top1 ____(nome) XEXP | Top2 ____(nome) XEXP
  const positions = [
    { y: 220, medal: '🥇', color: '#FFD700' },
    { y: 380, medal: '🥈', color: '#C0C0C0' },
    { y: 540, medal: '🥉', color: '#CD7F32' }
  ];

  for (let i = 0; i < top3.length; i++) {
    const { name, exp, avatarUrl } = top3[i];
    const pos = positions[i];
    if (!pos) break;

    // AVATAR
    try {
      const avatar = await Canvas.loadImage(avatarUrl);
      const avSize = 100;
      const avX = 80;
      const avY = pos.y - 50;

      ctx.save();
      ctx.beginPath();
      ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatar, avX, avY, avSize, avSize);
      ctx.restore();

      ctx.strokeStyle = pos.color;
      ctx.lineWidth = 5;
      ctx.shadowColor = pos.color;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2 + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } catch {
      // Fallback se não carregar
      ctx.beginPath();
      ctx.arc(130, pos.y, 50, 0, Math.PI * 2);
      ctx.fillStyle = '#333';
      ctx.fill();
    }

    // texto: TopX ____(Nome) • EXP
    ctx.fillStyle = pos.color;
    ctx.font = 'bold 34px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`${pos.medal} Top${i+1}`, 210, pos.y + 10);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px Arial';
    ctx.fillText(`____(${name})`, 340, pos.y + 10);

    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 28px Arial';
    ctx.fillText(`• ${exp} EXP`, 340 + ctx.measureText(`____(${name})`).width + 10, pos.y + 10);
  }

  // rodapé.
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '18px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('1 Mensagem = 1 EXP', width / 2, height - 60);

  fs.writeFileSync(pathImg, canvas.toBuffer('image/png'));
}

//
function roundRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

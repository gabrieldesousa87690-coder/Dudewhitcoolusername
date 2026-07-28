const Canvas = require('canvas');
const fs = require('fs-extra');
const path = require('path');

// 🔥 CAMINHO DO ARQUIVO DE DADOS
const DATA_PATH = path.join(__dirname, 'cache', 'afk_data.json');

// 🔥 GARANTE QUE O ARQUIVO EXISTE
function ensureFile() {
    fs.ensureDirSync(path.dirname(DATA_PATH));
    if (!fs.existsSync(DATA_PATH)) {
        fs.writeJSONSync(DATA_PATH, {});
    }
}

// 🔥 CARREGA OS DADOS
function loadData() {
    ensureFile();
    return fs.readJSONSync(DATA_PATH);
}

// 🔥 SALVA OS DADOS
function saveData(data) {
    ensureFile();
    fs.writeJSONSync(DATA_PATH, data, { spaces: 2 });
}

// 🔥 FUNÇÃO PARA NORMALIZAR TEXTO (UNICODE → NORMAL)
function normalizeText(text) {
    if (!text) return 'User';
    const map = {
        'Ꭺ': 'A', 'Ᏸ': 'B', 'Ꮯ': 'C', 'Ꭰ': 'D', 'Ꭼ': 'E',
        'Ꮹ': 'G', 'Ꮋ': 'H', 'Ꭵ': 'I', 'Ꮰ': 'J',
        'Ꮶ': 'K', 'Ꮮ': 'L', 'Ꮇ': 'M', 'Ꮑ': 'N', 'Ꮎ': 'O',
        'Ꮲ': 'P', 'Ꭴ': 'Q', 'Ꮢ': 'R', 'Ꮥ': 'S', 'Ꮖ': 'T',
        'Ꮜ': 'U', 'Ꮙ': 'V', 'Ꮃ': 'W', 'Ꮍ': 'Y', 'Ꮓ': 'Z',
        'Ꮗ': 'B', 'Ꮛ': 'E', 'Ꮦ': 'T', 'Ꭹ': 'Y', 'Ꭷ': 'O',
        'Ꭾ': 'P', 'Ꮧ': 'A', 'Ꮥ': 'S', 'Ꮄ': 'D', 'Ꭶ': 'F',
        'Ꮆ': 'G', 'Ꮒ': 'H', 'Ꮅ': 'L', 'ፚ': 'Z', 'ጀ': 'C',
        'ፈ': 'F', 'Ꮙ': 'V', 'Ᏸ': 'B', 'Ꮑ': 'N', 'Ꮇ': 'M'
    };
    return text.split('').map(char => map[char] || char).join('');
}

// 🔥 GERA O BANNER AFK
async function generateAFKBanner(name, reason, avatarUrl) {
    const width = 800;
    const height = 450;
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 🔥 FUNDO
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#0a1628');
    gradient.addColorStop(0.5, '#1a0a2e');
    gradient.addColorStop(1, '#0a1628');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 🔥 BORDA ROSA
    ctx.shadowColor = '#FF1493';
    ctx.shadowBlur = 30;
    ctx.strokeStyle = '#FF1493';
    ctx.lineWidth = 3;
    ctx.strokeRect(15, 15, width - 30, height - 30);
    ctx.shadowBlur = 0;

    // 🔥 PONTOS BRILHANTES
    for (let i = 0; i < 40; i++) {
        ctx.fillStyle = 'rgba(255, 20, 147, ' + (Math.random() * 0.1) + ')';
        ctx.beginPath();
        ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 2 + 0.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // 🔥 AVATAR
    try {
        const avatar = await Canvas.loadImage(avatarUrl);
        const avatarSize = 130;
        const avatarX = 60;
        const avatarY = (height - avatarSize) / 2;

        ctx.shadowColor = '#FF1493';
        ctx.shadowBlur = 30;

        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#FF1493';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#FF1493';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

    } catch (e) {
        const avatarSize = 130;
        const avatarX = 60;
        const avatarY = (height - avatarSize) / 2;
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#1a2a6c';
        ctx.fill();
        ctx.strokeStyle = '#FF1493';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = '50px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('👤', avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 18);
    }

    // 🔥 LINHA DIVISÓRIA
    ctx.strokeStyle = 'rgba(255, 20, 147, 0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(220, 30);
    ctx.lineTo(220, height - 30);
    ctx.stroke();
    ctx.setLineDash([]);

    // 🔥 INFORMAÇÕES
    const infoX = 260;
    let currentY = 60;

    // 🔥 STATUS AFK
    ctx.shadowColor = '#FF1493';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#FF1493';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('🌙 MODO AFK', infoX, currentY);
    ctx.shadowBlur = 0;
    currentY += 50;

    // 🔥 NOME
    ctx.shadowColor = 'rgba(255,255,255,0.3)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 34px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(name, infoX, currentY);
    ctx.shadowBlur = 0;
    currentY += 55;

    // 🔥 LINHA FINA
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(infoX, currentY - 10);
    ctx.lineTo(infoX + 350, currentY - 10);
    ctx.stroke();

    // 🔥 MOTIVO
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'italic 20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`"${reason || 'Não informado'}"`, infoX, currentY + 10);
    ctx.shadowBlur = 0;
    currentY += 55;

    // 🔥 TEMPO
    const now = new Date();
    const timeStr = now.toLocaleString();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`⏰ ${timeStr}`, infoX, currentY);
    currentY += 35;

    // 🔥 DICA
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('🔹 Para cancelar, use !afk -p', infoX, currentY);

    // 🔥 RODAPÉ
    ctx.fillStyle = 'rgba(255,20,147,0.15)';
    ctx.font = '11px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('✦ Hinata Bot ✦', width - 20, height - 12);

    // 🔥 SALVA
    const pathImg = path.join(__dirname, 'cache', `afk_${Date.now()}.png`);
    const imageBuffer = canvas.toBuffer('image/png');
    fs.writeFileSync(pathImg, imageBuffer);
    return pathImg;
}

// 🔥 COMANDO PRINCIPAL
module.exports = {
    config: {
        name: "afk",
        aliases: ["away", "ausente"],
        version: "1.0",
        author: "Hinata",
        countDown: 5,
        role: 0,
        description: {
            pt: "Ativa o modo AFK com motivo"
        },
        category: "fun",
        guide: {
            pt: "   {pn} <motivo> - Ativa o modo AFK\n" +
                 "   {pn} -p - Cancela o modo AFK\n" +
                 "   {pn} cancel - Cancela o modo AFK"
        }
    },

    onStart: async function ({ api, event, args, usersData }) {
        const { senderID, threadID, messageID } = event;
        const userId = parseInt(senderID);
        const action = args[0]?.toLowerCase();

        let data = loadData();

        // 🔥 CANCELAR AFK
        if (action === '-p' || action === 'cancel') {
            if (!data[userId]) {
                return api.sendMessage('❌ | Você não está em modo AFK!', threadID, messageID);
            }

            delete data[userId];
            saveData(data);
            return api.sendMessage('✅ | Modo AFK cancelado!', threadID, messageID);
        }

        // 🔥 PEGA O MOTIVO
        const reason = args.join(' ') || 'Não informado';

        // 🔥 BUSCA DADOS DO USUÁRIO
        const userData = await usersData.get(userId);
        if (!userData) {
            await usersData.set(userId, {
                money: 0,
                exp: 0,
                name: `User_${userId}`,
                data: {}
            });
        }

        const name = userData?.name || `User_${userId}`;
        const normalizedName = normalizeText(name);
        const avatarUrl = await usersData.getAvatarUrl(userId);

        // 🔥 SALVA O ESTADO AFK
        data[userId] = {
            reason: reason,
            name: name,
            time: new Date().toLocaleString()
        };
        saveData(data);

        // 🔥 GERA O BANNER
        try {
            const imagePath = await generateAFKBanner(normalizedName, reason, avatarUrl);

            return api.sendMessage({
                body: `🌙 **${name} está em modo AFK!**\n📝 Motivo: "${reason}"`,
                attachment: fs.createReadStream(imagePath)
            }, threadID, () => {
                if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
            }, messageID);

        } catch (error) {
            console.error('❌ Erro ao gerar banner AFK:', error);
            return api.sendMessage(
                `🌙 **${name} está em modo AFK!**\n📝 Motivo: "${reason}"\n⏰ Desde: ${new Date().toLocaleString()}`,
                threadID,
                messageID
            );
        }
    },

    // 🔥 onChat: RESPONDE QUANDO ALGUÉM MENÇÃO OU PERGUNTA
    onChat: async function ({ api, event, usersData }) {
        const { threadID, senderID, body, mentions } = event;

        if (!body) return;

        const data = loadData();

        // 🔥 VERIFICA SE O REMETENTE ESTÁ AFK
        if (data[senderID]) {
            const afkData = data[senderID];
            return api.sendMessage(
                `🌙 **${afkData.name} está em modo AFK!**\n📝 Motivo: "${afkData.reason}"\n⏰ Desde: ${afkData.time}`,
                threadID
            );
        }

        // 🔥 VERIFICA SE ALGUÉM FOI MENCIONADO
        if (mentions && Object.keys(mentions).length > 0) {
            for (const [uid, name] of Object.entries(mentions)) {
                const userId = parseInt(uid);
                if (data[userId]) {
                    const afkData = data[userId];
                    const cleanName = name.replace(/@/g, '').trim();
                    api.sendMessage(
                        `🌙 **${cleanName} está em modo AFK!**\n📝 Motivo: "${afkData.reason}"\n⏰ Desde: ${afkData.time}`,
                        threadID
                    );
                }
            }
        }
    }
};

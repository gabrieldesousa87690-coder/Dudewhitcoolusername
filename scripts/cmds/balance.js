const Canvas = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

// 🔥 BANNER
const BANNER_URL = 'https://i.postimg.cc/TY4PDVhQ/c0da903acee71e9dbf72a4189030c2aa.jpg';

// 🔥 MAPEAMENTO DE CARACTERES ESPECIAIS
const normalizeText = (text) => {
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
};

// 🔥 FORMATAR DINHEIRO
const formatMoney = (num) => {
    const n = parseInt(num) || 0;
    if (n < 1000) return n + '$';
    if (n < 1000000) return (n / 1000).toFixed(1) + 'K$';
    if (n < 1000000000) return (n / 1000000).toFixed(1) + 'M$';
    if (n < 1000000000000) return (n / 1000000000).toFixed(1) + 'B$';
    return (n / 1000000000000).toFixed(1) + 'T$';
};

// 🔥 NÍVEL
const getLevel = (money) => {
    if (money < 100) return { name: '😴 Pobre', color: '#808080' };
    if (money < 500) return { name: '📚 Novato', color: '#4CAF50' };
    if (money < 2000) return { name: '⚡ Experiente', color: '#2196F3' };
    if (money < 10000) return { name: '👑 Rei', color: '#FFD700' };
    if (money < 50000) return { name: '🔥 Lendário', color: '#FF5722' };
    if (money < 100000) return { name: '⭐ Mítico', color: '#9C27B0' };
    return { name: '🚀 Modo Deus', color: '#FF0066' };
};

// 🔥 UTIL: garante que o usuário existe no banco
async function ensureUser(usersData, userID, fallbackName = null) {
    let userData = await usersData.get(userID);
    if (!userData) {
        await usersData.create(userID, {
            name: fallbackName || `User_${userID}`,
            money: 0,
            exp: 0,
            data: {}
        });
        userData = await usersData.get(userID);
    }
    return userData;
}

// 🔥 UTIL: nome do usuário (prioriza name do banco, fallback mention)
async function getUserName(usersData, userID, fallbackName = null) {
    try {
        const userData = await usersData.get(userID);
        if (userData?.name) return userData.name;
    } catch (e) {}
    return fallbackName || `User_${userID}`;
}

module.exports = {
    config: {
        name: "balance",
        aliases: ["bal", "money", "carteira", "saldo"],
        version: "7.0",
        author: "Tsuki",
        countDown: 5,
        role: 0,
        description: {
            pt: "Veja seu saldo com banner / transfira dinheiro"
        },
        category: "economy",
        guide: {
            pt: "   {pn}: Ver seu saldo\n" +
                "   {pn} @tag: Ver saldo de alguém\n" +
                "   {pn} t <valor>: Transfere dinheiro\n" +
                "   {pn} t <valor> (respondendo alguém): Transfere\n" +
                "   Ex: {pn} t 100"
        }
    },

    onStart: async function ({ api, event, args, usersData }) {
        try {
            const { senderID, mentions, threadID, messageID, messageReply } = event;

            // ============================================
            // 🔥 SUBCOMANDO: TRANSFERIR (t / transfer / pay)
            // ============================================
            const sub = (args[0] || '').toLowerCase();
            if (['t', 'transfer', 'pay', 'pagar', 'transferir'].includes(sub)) {
                return await handleTransfer({ api, event, args, usersData, senderID, threadID, messageID, messageReply, mentions });
            }

            // ============================================
            // 🔥 COMANDO PRINCIPAL: MOSTRAR SALDO
            // ============================================
            let targetId = senderID.toString();
            let targetName = null;

            // Se respondeu alguém, pega o autor da mensagem respondida
            if (messageReply && messageReply.senderID) {
                targetId = messageReply.senderID.toString();
            }
            // Se mencionou alguém
            else if (mentions && Object.keys(mentions).length > 0) {
                const firstKey = Object.keys(mentions)[0];
                targetId = firstKey.toString();
                targetName = mentions[firstKey].replace(/@/g, '').trim();
            }

            // 🔥 Busca usuário pelo banco do bot (usersData)
            const userData = await ensureUser(usersData, targetId, targetName);

            const originalName = userData.name || targetName || `User_${targetId}`;
            const normalName = normalizeText(originalName);
            const money = userData.money || 0;
            const exp = userData.exp || 0;
            const level = getLevel(money);

            // 🔥 RANK (busca todos do banco)
            const allUsers = await usersData.getAll();
            const sorted = allUsers
                .filter(u => (u.money || 0) > 0)
                .sort((a, b) => (b.money || 0) - (a.money || 0));

            const rank = sorted.findIndex(u => u.userID == targetId) + 1;
            const totalPlayers = sorted.length;

            let rankText = '';
            let rankColor = '#4CAF50';
            if (rank === 0) {
                rankText = '📈 Sem rank';
                rankColor = '#808080';
            } else if (rank <= 10) {
                rankText = '🏆 Top ' + rank;
                rankColor = '#FFD700';
            } else if (rank <= 50) {
                rankText = '⭐ Top ' + rank;
                rankColor = '#2196F3';
            } else if (rank <= 100) {
                rankText = '📊 Top ' + rank;
                rankColor = '#4CAF50';
            } else {
                rankText = '📈 #' + rank;
                rankColor = '#808080';
            }

            const avatarUrl = `https://graph.facebook.com/${targetId}/picture?width=500&height=500&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
            const cacheDir = path.join(__dirname, 'cache');
            if (!fs.existsSync(cacheDir)) fs.ensureDirSync(cacheDir);
            const pathImg = path.join(cacheDir, 'balance_' + targetId + '_' + Date.now() + '.png');

            await generateBannerWithBackground(
                pathImg, normalName, money, exp, level,
                rankText, rankColor, avatarUrl, totalPlayers
            );

            // 🔥 Limpa o arquivo APÓS o envio concluir
            const stream = fs.createReadStream(pathImg);
            stream.on('close', () => {
                try { if (fs.existsSync(pathImg)) fs.unlinkSync(pathImg); } catch (e) {}
            });

            return api.sendMessage(
                {
                    body: '💰 ' + originalName,
                    attachment: stream
                },
                threadID,
                messageID
            );

        } catch (error) {
            console.error('Erro no balance:', error);
            return api.sendMessage(
                '❌ | ERRO: ' + error.message,
                event.threadID,
                event.messageID
            );
        }
    }
};

// ============================================================
// 🔥 FUNÇÃO: TRANSFERIR DINHEIRO
// ============================================================
async function handleTransfer({ api, event, args, usersData, senderID, threadID, messageID, messageReply, mentions }) {
    try {
        // 🔥 Pega o valor (aceita "100", "1k", "1.5k", "1m")
        let rawValue = (args[1] || '').toString().toLowerCase().replace(/\s/g, '');
        if (!rawValue) {
            return api.sendMessage(
                '❌ | Uso correto:\n' +
                '   !bal t <valor>\n' +
                '   !bal t 100 (respondendo alguém)\n' +
                '   !bal t 100 @usuario\n\n' +
                '💡 Aceita: 100, 1k, 1.5k, 1m, 1b',
                threadID, messageID
            );
        }

        // Converte sufixos
        let multiplier = 1;
        if (rawValue.endsWith('k')) { multiplier = 1000; rawValue = rawValue.slice(0, -1); }
        else if (rawValue.endsWith('m')) { multiplier = 1000000; rawValue = rawValue.slice(0, -1); }
        else if (rawValue.endsWith('b')) { multiplier = 1000000000; rawValue = rawValue.slice(0, -1); }

        const amount = Math.floor(parseFloat(rawValue.replace(',', '.')) * multiplier);

        if (!amount || isNaN(amount) || amount <= 0) {
            return api.sendMessage('❌ | Valor inválido! Use um número positivo.', threadID, messageID);
        }

        // 🔥 Identifica destinatário (reply > mention)
        let targetId = null;
        let targetName = null;

        if (messageReply && messageReply.senderID) {
            targetId = messageReply.senderID.toString();
            targetName = await getUserName(usersData, targetId);
        } else if (mentions && Object.keys(mentions).length > 0) {
            const firstKey = Object.keys(mentions)[0];
            targetId = firstKey.toString();
            targetName = mentions[firstKey].replace(/@/g, '').trim();
        }

        if (!targetId) {
            return api.sendMessage(
                '❌ | Você precisa:\n' +
                '   • Responder a mensagem de alguém, OU\n' +
                '   • Mencionar @alguém\n\n' +
                '💡 Ex: !bal t 100 (respondendo alguém)',
                threadID, messageID
            );
        }

        if (targetId === senderID.toString()) {
            return api.sendMessage('❌ | Você não pode transferir para si mesmo!', threadID, messageID);
        }

        // 🔥 Garante que ambos existem
        const senderData = await ensureUser(usersData, senderID);
        const targetData = await ensureUser(usersData, targetId, targetName);

        const senderMoney = senderData.money || 0;
        const targetMoney = targetData.money || 0;

        if (senderMoney < amount) {
            return api.sendMessage(
                `❌ | Saldo insuficiente!\n` +
                `💰 Você tem: ${formatMoney(senderMoney)}\n` +
                `📤 Precisa: ${formatMoney(amount)}\n` +
                `📉 Falta: ${formatMoney(amount - senderMoney)}`,
                threadID, messageID
            );
        }

        // 🔥 Executa a transferência
        const newSenderMoney = senderMoney - amount;
        const newTargetMoney = targetMoney + amount;

        await usersData.set(senderID, { money: newSenderMoney });
        await usersData.set(targetId, { money: newTargetMoney });

        const senderName = senderData.name || `User_${senderID}`;
        const finalTargetName = targetData.name || targetName || `User_${targetId}`;

        return api.sendMessage(
            `✅ | Transferência concluída!\n\n` +
            `📤 De: ${senderName}\n` +
            `📥 Para: ${finalTargetName}\n` +
            `💵 Valor: ${formatMoney(amount)}\n\n` +
            `💰 Seu novo saldo: ${formatMoney(newSenderMoney)}`,
            threadID,
            messageID
        );

    } catch (error) {
        console.error('Erro no transfer:', error);
        return api.sendMessage('❌ | ERRO: ' + error.message, threadID, messageID);
    }
}

// ============================================================
// 🔥 GERA O BANNER
// ============================================================
async function generateBannerWithBackground(pathImg, normalName, money, exp, level, rankText, rankColor, avatarUrl, totalPlayers) {
    const width = 1000;
    const height = 400;
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 🔥 1. BANNER DE FUNDO
    try {
        const response = await axios.get(BANNER_URL, { responseType: 'arraybuffer', timeout: 15000 });
        const bannerBuffer = Buffer.from(response.data);
        const banner = await Canvas.loadImage(bannerBuffer);
        ctx.drawImage(banner, 0, 0, width, height);
    } catch (e) {
        console.log('❌ Erro ao baixar banner, usando fundo padrão');
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#0a1628');
        gradient.addColorStop(0.5, '#1a0a2e');
        gradient.addColorStop(1, '#0a1628');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    // 🔥 2. OVERLAY SEMI-TRANSPARENTE
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    roundRect(ctx, 30, 30, width - 60, height - 60, 15);
    ctx.fill();

    // 🔥 3. AVATAR
    const avatarSize = 130;
    const avatarX = 60;
    const avatarY = (height - avatarSize) / 2;

    try {
        const avatar = await Canvas.loadImage(avatarUrl);
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();

        ctx.strokeStyle = '#FF1493';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#FF1493';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    } catch (e) {
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fill();
        ctx.strokeStyle = '#FF1493';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = '60px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('👤', avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 20);
    }

    // 🔥 4. INFORMAÇÕES
    const infoX = 260;
    let currentY = 50;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 15;

    // NÍVEL
    ctx.fillStyle = level.color;
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(level.name, infoX, currentY);
    currentY += 45;

    // NOME
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 38px Arial';
    ctx.fillText(normalName, infoX, currentY);
    currentY += 55;

    // LINHA
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(infoX, currentY - 10);
    ctx.lineTo(infoX + 350, currentY - 10);
    ctx.stroke();

    // RANK
    ctx.fillStyle = rankColor;
    ctx.font = 'bold 22px Arial';
    ctx.fillText(rankText, infoX, currentY + 20);
    currentY += 55;

    // DINHEIRO
    const formattedMoney = formatMoney(money);
    const moneyColor = money >= 10000 ? '#FFD700' : '#00ff88';
    ctx.fillStyle = moneyColor;
    ctx.font = 'bold 48px Arial';
    ctx.fillText(formattedMoney, infoX, currentY);
    currentY += 60;

    // XP
    ctx.fillStyle = '#00d4ff';
    ctx.font = '18px Arial';
    ctx.fillText('⭐ ' + exp + ' XP', infoX, currentY);
    currentY += 35;

    // JOGADORES
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '15px Arial';
    ctx.fillText('👥 ' + totalPlayers + ' jogadores', infoX, currentY);

    ctx.shadowBlur = 0;

    // BARRA DE PROGRESSO
    const barX = infoX;
    const barY = currentY + 20;
    const barWidth = 280;
    const barHeight = 8;

    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    roundRect(ctx, barX, barY, barWidth, barHeight, 4);
    ctx.fill();

    const progress = Math.min((money / 100000) * 100, 100);
    ctx.fillStyle = level.color;
    roundRect(ctx, barX, barY, (progress / 100) * barWidth, barHeight, 4);
    ctx.fill();

    // RODAPÉ
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 5;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '11px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('✦ Tsuki Bot ✦', width - 20, height - 12);
    ctx.shadowBlur = 0;

    fs.writeFileSync(pathImg, canvas.toBuffer('image/png'));
}

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

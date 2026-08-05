const Canvas = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

// 🔥 BANNER (SUBSTITUA PELO SEU)
const BANNER_URL = 'https://i.postimg.cc/TY4PDVhQ/c0da903acee71e9dbf72a4189030c2aa.jpg';

// 🔥 CAMINHO DO JSON (MESMO QUE O BOT USA)
const USERS_PATH = path.join(__dirname, '..', '..', 'database', 'data', 'usersData.json');

// 🔥 MAPEAMENTO DE CARACTERES
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
    if (!num) return '0$';
    const n = parseInt(num);
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

// 🔥 ==================== FUNÇÕES DIRETAS NO JSON ====================
function loadUsers() {
    try {
        if (fs.existsSync(USERS_PATH)) {
            return fs.readJSONSync(USERS_PATH);
        }
    } catch (e) {
        console.error('Erro ao carregar usersData.json:', e.message);
    }
    return [];
}

function saveUsers(users) {
    try {
        fs.writeJSONSync(USERS_PATH, users, { spaces: 2 });
        return true;
    } catch (e) {
        console.error('Erro ao salvar usersData.json:', e.message);
        return false;
    }
}

function getUser(userID) {
    const users = loadUsers();
    return users.find(u => u.userID == userID);
}

function setUser(userID, data) {
    let users = loadUsers();
    const index = users.findIndex(u => u.userID == userID);
    if (index === -1) {
        users.push({ userID, ...data });
    } else {
        users[index] = { ...users[index], ...data };
    }
    saveUsers(users);
    return users.find(u => u.userID == userID);
}

module.exports = {
    config: {
        name: "balance",
        aliases: ["bal", "money", "carteira", "saldo"],
        version: "6.0",
        author: "Tsuki",
        countDown: 5,
        role: 0,
        description: {
            pt: "Veja seu saldo com banner"
        },
        category: "economy",
        guide: {
            pt: "   {pn}: Ver seu saldo\n   {pn} @tag: Ver saldo de alguém"
        }
    },

    onStart: async function ({ api, event, args }) {
        try {
            const { senderID, mentions, threadID, messageID } = event;
            let targetId = parseInt(senderID);
            let targetName = "";

            if (Object.keys(mentions).length > 0) {
                targetId = parseInt(Object.keys(mentions)[0]);
                targetName = mentions[targetId].replace(/@/g, '').trim();
            }

            // 🔥 BUSCA OU CRIA O USUÁRIO DIRETO NO JSON
            let userData = getUser(targetId);
            if (!userData) {
                userData = setUser(targetId, {
                    money: 0,
                    exp: 0,
                    name: targetName || `User_${targetId}`,
                    data: {}
                });
            }

            const originalName = targetName || userData.name || `User_${targetId}`;
            const normalName = normalizeText(originalName);
            const money = userData.money || 0;
            const exp = userData.exp || 0;
            const level = getLevel(money);

            // 🔥 RANK (ORDENA POR DINHEIRO)
            const allUsers = loadUsers();
            const sorted = allUsers
                .filter(u => (u.money || 0) > 0)
                .sort((a, b) => (b.money || 0) - (a.money || 0));

            const rank = sorted.findIndex(u => u.userID == targetId) + 1;
            const totalPlayers = sorted.length;

            let rankText = '';
            let rankColor = '#4CAF50';
            if (rank <= 10) {
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

            const avatarUrl = `https://graph.facebook.com/${targetId}/picture?width=500&height=500`;
            const pathImg = path.join(__dirname, 'cache', 'balance_' + targetId + '.png');

            await generateBannerWithBackground(
                pathImg,
                normalName,
                money,
                exp,
                level,
                rankText,
                rankColor,
                avatarUrl,
                totalPlayers
            );

            return api.sendMessage(
                {
                    body: '💰 ' + originalName,
                    attachment: fs.createReadStream(pathImg)
                },
                threadID,
                () => { if (fs.existsSync(pathImg)) fs.unlinkSync(pathImg); },
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

// 🔥 FUNÇÃO QUE GERA O BALANCE COM BANNER DE FUNDO
async function generateBannerWithBackground(pathImg, normalName, money, exp, level, rankText, rankColor, avatarUrl, totalPlayers) {
    const width = 1000;
    const height = 400;
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 🔥 1. BAIXA O BANNER
    try {
        const response = await axios.get(BANNER_URL, { responseType: 'arraybuffer' });
        const bannerBuffer = Buffer.from(response.data, 'utf-8');
        const bannerPath = path.join(__dirname, 'cache', 'banner_temp.png');
        fs.writeFileSync(bannerPath, bannerBuffer);
        
        const banner = await Canvas.loadImage(bannerPath);
        ctx.drawImage(banner, 0, 0, width, height);
        fs.unlinkSync(bannerPath);
    } catch (e) {
        console.log('❌ Erro ao baixar banner, usando fundo padrão');
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#0a1628');
        gradient.addColorStop(0.5, '#1a0a2e');
        gradient.addColorStop(1, '#0a1628');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    // 🔥 2. SEMI-TRANSPARENTE
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    roundRect(ctx, 30, 30, width - 60, height - 60, 15);
    ctx.fill();

    // 🔥 3. AVATAR
    try {
        const avatar = await Canvas.loadImage(avatarUrl);
        const avatarSize = 130;
        const avatarX = 60;
        const avatarY = (height - avatarSize) / 2;

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
        const avatarSize = 130;
        const avatarX = 60;
        const avatarY = (height - avatarSize) / 2;
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
    ctx.textAlign = 'left';
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
    ctx.textAlign = 'left';
    ctx.fillText(rankText, infoX, currentY + 20);
    currentY += 55;

    // DINHEIRO
    const formattedMoney = formatMoney(money);
    const moneyColor = money >= 10000 ? '#FFD700' : '#00ff88';
    ctx.fillStyle = moneyColor;
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(formattedMoney, infoX, currentY);
    currentY += 60;

    // XP
    ctx.fillStyle = '#00d4ff';
    ctx.font = '18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('⭐ ' + exp + ' XP', infoX, currentY);
    currentY += 35;

    // JOGADORES
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '15px Arial';
    ctx.textAlign = 'left';
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

    // SALVA
    const imageBuffer = canvas.toBuffer('image/png');
    fs.writeFileSync(pathImg, imageBuffer);
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

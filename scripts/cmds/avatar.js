const Canvas = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

// 🔥 SUA IMAGEM DE BANNER
const BANNER_URL = 'https://i.postimg.cc/tCd3tB6t/4b040bc49a7c82fbba45cf5792898bbd.jpg';

// 🔥 FUNÇÃO PARA NORMALIZAR NOME UNICODE
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

// 🔥 CORES DE FUNDO
const BACKGROUNDS = {
    'rosa': '#FF1493',
    'azul': '#2196F3',
    'verde': '#4CAF50',
    'roxo': '#9C27B0',
    'laranja': '#FF5722',
    'dourado': '#FFD700',
    'preto': '#1a1a2e',
    'branco': '#f5f5f5',
    'gradient': ['#667eea', '#764ba2'],
    'default': ['#0a1628', '#1a0a2e']
};

module.exports = {
    config: {
        name: "avatar",
        aliases: ["av", "perfilimg"],
        version: "3.1",
        author: "Hinata",
        countDown: 5,
        role: 0,
        description: {
            pt: "Gera um avatar com banner personalizado"
        },
        category: "fun",
        guide: {
            pt: "   {pn}: Gera avatar com seu perfil\n" +
                 "   {pn} @tag: Gera avatar da pessoa marcada\n" +
                 "   {pn} setbio [frase]: Define sua bio\n" +
                 "   {pn} fundo [cor]: Muda a cor de fundo (fallback)\n" +
                 "   {pn} cores: Mostra as cores disponíveis"
        }
    },

    onStart: async function ({ api, event, args, usersData }) {
        try {
            const { senderID, mentions, threadID, messageID } = event;
            let targetId = parseInt(senderID);
            let targetName = "";
            let action = args[0]?.toLowerCase();

            // 🔥 COMANDO: SETBIO
            if (action === 'setbio') {
                const bio = args.slice(1).join(' ');
                if (!bio) {
                    return api.sendMessage('❌ | Digite uma frase para sua bio!\nEx: !avatar setbio "A vida é bela"', threadID, messageID);
                }
                await usersData.set(senderID, { "data.avatar_bio": bio });
                return api.sendMessage(`✅ | Bio definida com sucesso!\n📝 "${bio}"`, threadID, messageID);
            }

            // 🔥 COMANDO: CORES
            if (action === 'cores') {
                const cores = Object.keys(BACKGROUNDS).join(', ');
                return api.sendMessage(
                    `🎨 **CORES DISPONÍVEIS:**\n\n${cores}\n\n` +
                    `💡 Use: !avatar fundo [cor]`,
                    threadID,
                    messageID
                );
            }

            // 🔥 COMANDO: MUDAR FUNDO (fallback)
            if (action === 'fundo' && args[1]) {
                const color = args[1].toLowerCase();
                if (!BACKGROUNDS[color]) {
                    return api.sendMessage(`❌ Cor não encontrada!\nUse !avatar cores para ver as disponíveis.`, threadID, messageID);
                }
                await usersData.set(senderID, { "data.avatar_bg": color });
                return api.sendMessage(`✅ Fundo fallback alterado para: **${color}**`, threadID, messageID);
            }

            // 🔥 PEGA ALVO
            if (Object.keys(mentions).length > 0) {
                targetId = parseInt(Object.keys(mentions)[0]);
                targetName = mentions[targetId].replace(/@/g, '').trim();
            }

            // 🔥 BUSCA DADOS
            let userData = await usersData.get(targetId);
            if (!userData) {
                await usersData.set(targetId, {
                    money: 0,
                    exp: 0,
                    name: targetName || `User_${targetId}`,
                    data: {}
                });
                userData = await usersData.get(targetId);
            }

            const name = targetName || userData.name || `User_${targetId}`;
            const displayName = normalizeText(name); // 🔥 NOME NORMALIZADO
            const money = userData.money || 0;
            const exp = userData.exp || 0;
            const level = Math.floor(exp / 100) + 1;
            const avatarUrl = await usersData.getAvatarUrl(targetId);

            // 🔥 PREFERÊNCIAS
            const bio = userData.data?.avatar_bio || '💫 Seja luz neste mundo';
            const bgPreference = userData.data?.avatar_bg || 'default';

            const pathImg = path.join(__dirname, 'cache', 'avatar_' + targetId + '.png');

            await generateAvatarWithBanner(
                pathImg,
                displayName, // 🔥 USA O NOME NORMALIZADO
                money,
                exp,
                level,
                avatarUrl,
                bgPreference,
                bio,
                name // 🔥 NOME ORIGINAL PARA O CORPO DA MENSAGEM
            );

            return api.sendMessage(
                {
                    body: `🖼️ **${name}**\n📝 "${bio}"`, // 🔥 NOME ORIGINAL NO TEXTO
                    attachment: fs.createReadStream(pathImg)
                },
                threadID,
                () => { if (fs.existsSync(pathImg)) fs.unlinkSync(pathImg); },
                messageID
            );

        } catch (error) {
            console.error('Erro no avatar:', error);
            return api.sendMessage(`❌ | ERRO: ${error.message}`, event.threadID, event.messageID);
        }
    }
};

// 🔥 FUNÇÃO QUE GERA O AVATAR COM BANNER
async function generateAvatarWithBanner(pathImg, displayName, money, exp, level, avatarUrl, bgKey, bio, originalName) {
    const width = 800;
    const height = 450;
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 🔥 1. BAIXA E DESENHA O BANNER
    try {
        const response = await axios.get(BANNER_URL, { responseType: 'arraybuffer' });
        const bannerBuffer = Buffer.from(response.data, 'utf-8');
        const bannerPath = path.join(__dirname, 'cache', 'banner_temp_' + Date.now() + '.png');
        fs.writeFileSync(bannerPath, bannerBuffer);
        
        const banner = await Canvas.loadImage(bannerPath);
        ctx.drawImage(banner, 0, 0, width, height);
        fs.unlinkSync(bannerPath);
    } catch (e) {
        console.log('❌ Erro ao baixar banner, usando fundo padrão');
        const bgColor = BACKGROUNDS[bgKey] || BACKGROUNDS.default;
        if (Array.isArray(bgColor)) {
            const gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, bgColor[0]);
            gradient.addColorStop(1, bgColor[1]);
            ctx.fillStyle = gradient;
        } else {
            ctx.fillStyle = bgColor;
        }
        ctx.fillRect(0, 0, width, height);
    }

    // 🔥 2. CAMADA SEMI-TRANSPARENTE
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    roundRect(ctx, 20, 20, width - 40, height - 40, 15);
    ctx.fill();

    // 🔥 3. BORDA ROSA
    ctx.shadowColor = '#FF1493';
    ctx.shadowBlur = 20;
    ctx.strokeStyle = '#FF1493';
    ctx.lineWidth = 2;
    roundRect(ctx, 20, 20, width - 40, height - 40, 15);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 🔥 4. AVATAR (esquerdo)
    try {
        const avatar = await Canvas.loadImage(avatarUrl);
        const avatarSize = 140;
        const avatarX = 50;
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
        ctx.lineWidth = 3;
        ctx.shadowColor = '#FF1493';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

    } catch (e) {
        const avatarSize = 140;
        const avatarX = 50;
        const avatarY = (height - avatarSize) / 2;
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fill();
        ctx.strokeStyle = '#FF1493';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = '50px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('👤', avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 18);
    }

    // 🔥 5. INFORMAÇÕES (direita)
    const infoX = 230;
    let currentY = 55;

    // Sombra nos textos
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 15;

    // NOME - Branco (agora com o nome normalizado)
    ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 34px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(displayName, infoX, currentY);
    ctx.shadowBlur = 0;
    currentY += 45;

    // BIO
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'italic 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`"${bio}"`, infoX, currentY);
    currentY += 40;

    // LINHA
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(infoX, currentY - 5);
    ctx.lineTo(infoX + 300, currentY - 5);
    ctx.stroke();

    // NÍVEL - Rosa
    ctx.shadowColor = 'rgba(255, 20, 147, 0.5)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#FF1493';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`🏆 Nível ${level}`, infoX, currentY + 25);
    ctx.shadowBlur = 0;
    currentY += 45;

    // MOEDAS - Dourado
    ctx.shadowColor = 'rgba(255, 215, 0, 0.4)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`💰 ${money.toLocaleString()}$`, infoX, currentY);
    ctx.shadowBlur = 0;
    currentY += 40;

    // EXPERIÊNCIA - Verde Água
    ctx.shadowColor = 'rgba(0, 255, 204, 0.4)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#00ffcc';
    ctx.font = '18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`⭐ ${exp} XP`, infoX, currentY);
    ctx.shadowBlur = 0;
    currentY += 35;

    // BARRA DE PROGRESSO
    ctx.shadowBlur = 0;
    const barX = infoX;
    const barY = currentY + 5;
    const barWidth = 280;
    const barHeight = 10;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    roundRect(ctx, barX, barY, barWidth, barHeight, 5);
    ctx.fill();

    const progress = Math.min((exp % 100) / 100 * barWidth, barWidth);
    ctx.fillStyle = '#FF1493';
    ctx.shadowColor = 'rgba(255, 20, 147, 0.5)';
    ctx.shadowBlur = 15;
    roundRect(ctx, barX, barY, progress, barHeight, 5);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${exp % 100} / 100 XP`, barX + barWidth / 2, barY + 22);

    // RODAPÉ
    ctx.fillStyle = 'rgba(255, 20, 147, 0.2)';
    ctx.font = '11px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('✦ Hinata Bot ✦', width - 25, height - 15);

    // SALVA
    const imageBuffer = canvas.toBuffer('image/png');
    fs.writeFileSync(pathImg, imageBuffer);
}

// 🔥 ROUND RECT
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

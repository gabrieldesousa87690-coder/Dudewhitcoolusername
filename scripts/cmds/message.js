const Canvas = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

// 🔥 CAMINHO DO ARQUIVO DE MENSAGENS
const MESSAGES_PATH = path.join(__dirname, 'cache', 'messages_data.json');

// 🔥 GARANTE QUE O ARQUIVO EXISTE
function ensureFile() {
    fs.ensureDirSync(path.dirname(MESSAGES_PATH));
    if (!fs.existsSync(MESSAGES_PATH)) {
        fs.writeJSONSync(MESSAGES_PATH, {});
    }
}

// 🔥 CARREGA OS DADOS
function loadMessages() {
    ensureFile();
    return fs.readJSONSync(MESSAGES_PATH);
}

// 🔥 SALVA OS DADOS
function saveMessages(data) {
    ensureFile();
    fs.writeJSONSync(MESSAGES_PATH, data, { spaces: 2 });
}

// 🔥 FUNÇÃO PARA NORMALIZAR TEXTO UNICODE
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

// 🔥 FUNÇÃO PARA FORMATAR A HORA
function getTime() {
    const now = new Date();
    return now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// 🔥 GERA A TELA INICIAL DE MENSAGENS (LAYOUT CELULAR)
async function generateMessagesCanvas(userId, userName, conversations, usersData) {
    const width = 450;
    const height = 780;
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 🔥 FUNDO BRANCO (TELA DO CELULAR)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // 🔥 BORDA DO CELULAR
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, width, height);

    // 🔥 NOTCH (BORDA SUPERIOR)
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(width / 2 - 60, 0, 120, 25);
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(width / 2, 0, 15, 0, Math.PI);
    ctx.fill();

    // 🔥 SUPERIOR (HORAS, BATERIA, WI-FI)
    const time = getTime();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(time, width / 2, 18);

    // 🔥 BATERIA
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(width - 45, 5, 25, 12);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.strokeRect(width - 45, 5, 25, 12);
    ctx.fillRect(width - 20, 8, 3, 6);
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(width - 43, 7, 18, 8);

    // 🔥 WI-FI
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(width - 68, 11, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(width - 68, 11, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(width - 68, 11, 10, 0, Math.PI * 2);
    ctx.stroke();

    // 🔥 TÍTULO DA APP
    ctx.fillStyle = '#FF1493';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('💬 Mensagens', 20, 45);

    // 🔥 ICONE DE NOVA MENSAGEM
    ctx.fillStyle = '#FF1493';
    ctx.font = '22px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('✏️', width - 20, 45);

    // 🔥 LINHA SEPARADORA
    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(15, 55);
    ctx.lineTo(width - 15, 55);
    ctx.stroke();

    // 🔥 LISTA DE CONVERSAS
    const maxItems = 10;
    const items = conversations.slice(0, maxItems);
    const avatarSize = 50;
    const startY = 75;
    const itemHeight = 65;

    items.forEach((conv, index) => {
        const y = startY + index * itemHeight;
        const name = conv.name || 'Usuário desconhecido';
        const lastMsg = conv.lastMessage || 'Nenhuma mensagem';
        const timeMsg = conv.lastTime || '';

        // 🔥 FUNDO DO CARD (CLARO)
        ctx.fillStyle = index % 2 === 0 ? '#F5F5F5' : '#FFFFFF';
        ctx.fillRect(10, y, width - 20, itemHeight - 2);

        // 🔥 AVATAR
        try {
            const avatarUrl = `https://graph.facebook.com/${conv.userID}/picture?width=100&height=100`;
            const avatar = await Canvas.loadImage(avatarUrl);
            ctx.save();
            ctx.beginPath();
            ctx.arc(45, y + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, 20, y + (itemHeight - avatarSize) / 2, avatarSize, avatarSize);
            ctx.restore();
        } catch (e) {
            ctx.beginPath();
            ctx.arc(45, y + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = '#E0E0E0';
            ctx.fill();
            ctx.fillStyle = '#888888';
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('👤', 45, y + avatarSize / 2 + 8);
        }

        // 🔥 NOME
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        const displayName = normalizeText(name);
        ctx.fillText(displayName.length > 18 ? displayName.substring(0, 18) + '...' : displayName, 80, y + 28);

        // 🔥 ÚLTIMA MENSAGEM
        ctx.fillStyle = '#666666';
        ctx.font = '13px Arial';
        ctx.fillText(lastMsg.length > 25 ? lastMsg.substring(0, 25) + '...' : lastMsg, 80, y + 48);

        // 🔥 HORA
        ctx.fillStyle = '#999999';
        ctx.font = '11px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(timeMsg, width - 20, y + 20);

        // 🔥 LINHA DIVISÓRIA
        if (index < items.length - 1) {
            ctx.strokeStyle = '#EEEEEE';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(20, y + itemHeight - 1);
            ctx.lineTo(width - 20, y + itemHeight - 1);
            ctx.stroke();
        }
    });

    // 🔥 SE TIVER MAIS CONVERSAS
    if (conversations.length > maxItems) {
        ctx.fillStyle = '#999999';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`+ ${conversations.length - maxItems} conversas...`, width / 2, height - 20);
    }

    // 🔥 RODAPÉ (BARRA DE NAVEGAÇÃO)
    ctx.fillStyle = '#F5F5F5';
    ctx.fillRect(0, height - 50, width, 50);
    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 50);
    ctx.lineTo(width, height - 50);
    ctx.stroke();

    // 🔥 ÍCONES DA BARRA
    ctx.fillStyle = '#888888';
    ctx.font = '22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🏠', width / 6, height - 18);
    ctx.fillText('💬', width / 2, height - 18);
    ctx.fillText('👤', width * 5 / 6, height - 18);

    // 🔥 SALVA
    const pathImg = path.join(__dirname, 'cache', `messages_${userId}_${Date.now()}.png`);
    const imageBuffer = canvas.toBuffer('image/png');
    fs.writeFileSync(pathImg, imageBuffer);
    return pathImg;
}

// 🔥 GERA TELA DE CONVERSA COM UM USUÁRIO ESPECÍFICO
async function generateChatCanvas(userId, userName, targetId, targetName, messages, usersData) {
    const width = 450;
    const height = 780;
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 🔥 FUNDO BRANCO
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // 🔥 BORDA DO CELULAR
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, width, height);

    // 🔥 NOTCH
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(width / 2 - 60, 0, 120, 25);
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(width / 2, 0, 15, 0, Math.PI);
    ctx.fill();

    // 🔥 SUPERIOR
    const time = getTime();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(time, width / 2, 18);

    // 🔥 CABEÇALHO DA CONVERSA
    ctx.fillStyle = '#FF1493';
    ctx.fillRect(0, 30, width, 45);

    // 🔥 VOLTAR
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('←', 15, 60);

    // 🔥 NOME DO CONTATO
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    const displayName = normalizeText(targetName);
    ctx.fillText(displayName.length > 20 ? displayName.substring(0, 20) + '...' : displayName, width / 2, 60);

    // 🔥 ÁREA DAS MENSAGENS
    const msgStartY = 85;
    const msgEndY = height - 65;
    const maxMessages = 15;
    const recentMessages = messages.slice(-maxMessages);

    let y = msgStartY + 10;
    for (const msg of recentMessages) {
        const isMe = msg.senderID == userId;
        const x = isMe ? width - 160 : 10;
        const maxWidth = 250;
        const lines = wrapText(ctx, msg.content, maxWidth);
        const lineHeight = 20;
        const totalHeight = lines.length * lineHeight + 16;

        // 🔥 BALÃO
        ctx.fillStyle = isMe ? '#FF1493' : '#F0F0F0';
        const bubbleX = isMe ? x - 10 : x;
        const bubbleY = y - 4;
        const bubbleWidth = Math.min(maxWidth + 20, 280);
        const bubbleHeight = totalHeight;

        ctx.beginPath();
        ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 12);
        ctx.fill();

        // 🔥 TEXTO
        ctx.fillStyle = isMe ? '#FFFFFF' : '#000000';
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        lines.forEach((line, i) => {
            ctx.fillText(line, x + 6, y + 14 + i * lineHeight);
        });

        // 🔥 HORA
        ctx.fillStyle = '#999999';
        ctx.font = '10px Arial';
        ctx.textAlign = isMe ? 'left' : 'right';
        const timeX = isMe ? x - 40 : x + bubbleWidth + 10;
        ctx.fillText(msg.time || '', timeX, y + totalHeight - 4);

        y += totalHeight + 12;
        if (y > msgEndY) break;
    }

    // 🔥 CAMPO DE DIGITAÇÃO
    const inputY = height - 55;
    ctx.fillStyle = '#F5F5F5';
    ctx.fillRect(10, inputY, width - 70, 40);
    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, inputY, width - 70, 40);

    ctx.fillStyle = '#999999';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Digite uma mensagem...', 20, inputY + 26);

    // 🔥 BOTÃO ENVIAR
    ctx.fillStyle = '#FF1493';
    ctx.beginPath();
    ctx.roundRect(width - 55, inputY + 2, 42, 36, 20);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('➤', width - 34, inputY + 26);

    // 🔥 RODAPÉ
    ctx.fillStyle = '#F5F5F5';
    ctx.fillRect(0, height - 50, width, 50);
    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 50);
    ctx.lineTo(width, height - 50);
    ctx.stroke();

    ctx.fillStyle = '#888888';
    ctx.font = '22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🏠', width / 6, height - 18);
    ctx.fillText('💬', width / 2, height - 18);
    ctx.fillText('👤', width * 5 / 6, height - 18);

    const pathImg = path.join(__dirname, 'cache', `chat_${userId}_${targetId}_${Date.now()}.png`);
    const imageBuffer = canvas.toBuffer('image/png');
    fs.writeFileSync(pathImg, imageBuffer);
    return pathImg;
}

// 🔥 FUNÇÃO DE WRAP TEXT
function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + ' ' + word).width;
        if (width < maxWidth) {
            currentLine += ' ' + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

// 🔥 COMANDO PRINCIPAL
module.exports = {
    config: {
        name: "messages",
        aliases: ["msg", "conversas", "mensagens"],
        version: "1.0",
        author: "Tsuki",
        countDown: 5,
        role: 0,
        description: {
            pt: "Sistema de mensagens interno"
        },
        category: "social",
        guide: {
            pt: "   {pn} - Mostra a tela inicial\n" +
                 "   {pn} <Uid> - Mostra conversa com o usuário\n" +
                 "   {pn} sent <Uid> <mensagem> - Envia mensagem"
        }
    },

    onStart: async function ({ api, event, args, usersData }) {
        const { senderID, threadID, messageID } = event;
        const userId = parseInt(senderID);
        const action = args[0]?.toLowerCase();

        // 🔥 GARANTE QUE O USUÁRIO EXISTE
        let userData = await usersData.get(userId);
        if (!userData) {
            await usersData.set(userId, {
                money: 0,
                exp: 0,
                name: `User_${userId}`,
                data: {}
            });
            userData = await usersData.get(userId);
        }

        const userName = userData.name || `User_${userId}`;
        const messagesData = loadMessages();

        // 🔥 INICIALIZA AS CONVERSAS DO USUÁRIO
        if (!messagesData[userId]) {
            messagesData[userId] = {};
        }

        // 🔥 COMANDO: ENVIAR MENSAGEM
        if (action === 'sent' || action === 'enviar' || action === 'send') {
            const targetId = parseInt(args[1]);
            const content = args.slice(2).join(' ');

            if (!targetId || isNaN(targetId)) {
                return api.sendMessage('❌ | Use: !messages sent <Uid> <mensagem>', threadID, messageID);
            }

            if (!content || content.length < 1) {
                return api.sendMessage('❌ | Digite uma mensagem!', threadID, messageID);
            }

            if (targetId === userId) {
                return api.sendMessage('❌ | Não pode enviar mensagem para si mesmo!', threadID, messageID);
            }

            // 🔥 GARANTE QUE O DESTINATÁRIO EXISTE
            let targetUserData = await usersData.get(targetId);
            if (!targetUserData) {
                await usersData.set(targetId, {
                    money: 0,
                    exp: 0,
                    name: `User_${targetId}`,
                    data: {}
                });
                targetUserData = await usersData.get(targetId);
            }

            const targetName = targetUserData.name || `User_${targetId}`;

            // 🔥 INICIALIZA A CONVERSA
            if (!messagesData[targetId]) {
                messagesData[targetId] = {};
            }
            if (!messagesData[targetId][userId]) {
                messagesData[targetId][userId] = [];
            }
            if (!messagesData[userId][targetId]) {
                messagesData[userId][targetId] = [];
            }

            const now = new Date();
            const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const dateStr = now.toLocaleDateString('pt-BR');

            const messageObj = {
                senderID: userId,
                senderName: userName,
                content: content,
                time: timeStr,
                date: dateStr,
                timestamp: now.getTime()
            };

            // 🔥 SALVA PARA AMBOS OS USUÁRIOS
            messagesData[userId][targetId].push(messageObj);
            messagesData[targetId][userId].push({
                ...messageObj,
                senderID: userId,
                senderName: userName
            });

            saveMessages(messagesData);

            return api.sendMessage(
                `✅ **Mensagem enviada!**\n\n` +
                `📤 Para: ${targetName}\n` +
                `💬 ${content}\n` +
                `🕒 ${timeStr} - ${dateStr}`,
                threadID,
                messageID
            );
        }

        // 🔥 COMANDO: VER CONVERSA COM UM USUÁRIO
        if (args[0] && !isNaN(args[0])) {
            const targetId = parseInt(args[0]);
            const targetData = await usersData.get(targetId);
            if (!targetData) {
                return api.sendMessage('❌ | Usuário não encontrado!', threadID, messageID);
            }

            const targetName = targetData.name || `User_${targetId}`;
            const conversation = messagesData[userId]?.[targetId] || [];

            if (conversation.length === 0) {
                return api.sendMessage(
                    `📭 | Nenhuma conversa com ${targetName} ainda.\n💡 Envie uma mensagem com: !messages sent ${targetId} <mensagem>`,
                    threadID,
                    messageID
                );
            }

            try {
                const imagePath = await generateChatCanvas(
                    userId,
                    userName,
                    targetId,
                    targetName,
                    conversation,
                    usersData
                );

                return api.sendMessage({
                    body: `💬 **Conversa com ${targetName}**`,
                    attachment: fs.createReadStream(imagePath)
                }, threadID, () => {
                    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
                }, messageID);

            } catch (error) {
                console.error('Erro ao gerar chat:', error);
                let msg = `💬 **Conversa com ${targetName}**\n\n`;
                const recent = conversation.slice(-10);
                recent.forEach(m => {
                    const isMe = m.senderID == userId;
                    msg += `${isMe ? '👤' : '👤'} ${isMe ? 'Eu' : m.senderName || 'Desconhecido'}: ${m.content}\n`;
                    msg += `   🕒 ${m.time} - ${m.date}\n\n`;
                });
                return api.sendMessage(msg, threadID, messageID);
            }
        }

        // 🔥 COMANDO: TELA INICIAL (DEFAULT)
        const allConversations = messagesData[userId] || {};
        const conversationList = [];

        for (const [targetId, msgs] of Object.entries(allConversations)) {
            if (msgs.length > 0) {
                const lastMsg = msgs[msgs.length - 1];
                const targetData = await usersData.get(parseInt(targetId));
                conversationList.push({
                    userID: parseInt(targetId),
                    name: targetData?.name || `User_${targetId}`,
                    lastMessage: lastMsg.content,
                    lastTime: lastMsg.time || '',
                    lastDate: lastMsg.date || ''
                });
            }
        }

        // 🔥 ORDENA POR ÚLTIMA MENSAGEM
        conversationList.sort((a, b) => b.lastTime.localeCompare(a.lastTime));

        try {
            const imagePath = await generateMessagesCanvas(
                userId,
                userName,
                conversationList,
                usersData
            );

            return api.sendMessage({
                body: '📱 **Suas conversas**',
                attachment: fs.createReadStream(imagePath)
            }, threadID, () => {
                if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
            }, messageID);

        } catch (error) {
            console.error('Erro ao gerar mensagens:', error);
            let msg = `📱 **Suas conversas**\n\n`;
            if (conversationList.length === 0) {
                msg += '📭 | Nenhuma conversa ainda.\n💡 Envie uma mensagem com: !messages sent <Uid> <mensagem>';
            } else {
                conversationList.forEach((conv, i) => {
                    msg += `${i + 1}. ${normalizeText(conv.name)}\n`;
                    msg += `   💬 ${conv.lastMessage}\n`;
                    msg += `   🕒 ${conv.lastTime} - ${conv.lastDate || ''}\n\n`;
                });
            }
            return api.sendMessage(msg, threadID, messageID);
        }
    }
};

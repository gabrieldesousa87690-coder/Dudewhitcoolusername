const Canvas = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

const MESSAGES_PATH = path.join(__dirname, 'cache', 'messages_data.json');
const WALLPAPERS_PATH = path.join(__dirname, 'cache', 'wallpapers');
const CACHE_PATH = path.join(__dirname, 'cache');

fs.ensureDirSync(CACHE_PATH);
fs.ensureDirSync(WALLPAPERS_PATH);

function loadMessages() {
    try {
        if (fs.existsSync(MESSAGES_PATH)) {
            return fs.readJSONSync(MESSAGES_PATH);
        }
    } catch (e) {}
    return {};
}

function saveMessages(data) {
    fs.writeJSONSync(MESSAGES_PATH, data, { spaces: 2 });
}

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

function getTime() {
    const now = new Date();
    return now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

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

async function generateMessagesCanvas(userId, userName, conversations) {
    const width = 450;
    const height = 780;
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, width, height);

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(width / 2 - 60, 0, 120, 25);
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(width / 2, 0, 15, 0, Math.PI);
    ctx.fill();

    const time = getTime();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(time, width / 2, 18);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(width - 45, 5, 25, 12);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.strokeRect(width - 45, 5, 25, 12);
    ctx.fillRect(width - 20, 8, 3, 6);
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(width - 43, 7, 18, 8);

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

    ctx.fillStyle = '#FF1493';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('💬 Mensagens', 20, 45);
    ctx.fillStyle = '#FF1493';
    ctx.font = '22px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('✏️', width - 20, 45);

    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(15, 55);
    ctx.lineTo(width - 15, 55);
    ctx.stroke();

    const maxItems = 8;
    const items = conversations.slice(0, maxItems);
    const avatarSize = 50;
    const startY = 75;
    const itemHeight = 65;

    for (let index = 0; index < items.length; index++) {
        const conv = items[index];
        const y = startY + index * itemHeight;
        const num = index + 1;
        const name = conv.name || 'Usuário desconhecido';
        const lastMsg = conv.lastMessage || 'Nenhuma mensagem';
        const timeMsg = conv.lastTime || '';

        ctx.fillStyle = index % 2 === 0 ? '#F5F5F5' : '#FFFFFF';
        ctx.fillRect(10, y, width - 20, itemHeight - 2);

        ctx.fillStyle = '#FF1493';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(num, 25, y + avatarSize / 2 + 5);

        try {
            const avatarUrl = `https://graph.facebook.com/${conv.userID}/picture?width=100&height=100`;
            const response = await axios.get(avatarUrl, { responseType: 'arraybuffer' });
            const avatarBuffer = Buffer.from(response.data, 'utf-8');
            const avatar = await Canvas.loadImage(avatarBuffer);
            ctx.save();
            ctx.beginPath();
            ctx.arc(55, y + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, 30, y + (itemHeight - avatarSize) / 2, avatarSize, avatarSize);
            ctx.restore();
        } catch (e) {
            ctx.beginPath();
            ctx.arc(55, y + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = '#E0E0E0';
            ctx.fill();
            ctx.fillStyle = '#888888';
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('👤', 55, y + avatarSize / 2 + 8);
        }

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        const displayName = normalizeText(name);
        ctx.fillText(displayName.length > 18 ? displayName.substring(0, 18) + '...' : displayName, 90, y + 28);

        ctx.fillStyle = '#666666';
        ctx.font = '13px Arial';
        ctx.fillText(lastMsg.length > 25 ? lastMsg.substring(0, 25) + '...' : lastMsg, 90, y + 48);

        ctx.fillStyle = '#999999';
        ctx.font = '11px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(timeMsg, width - 20, y + 20);

        if (index < items.length - 1) {
            ctx.strokeStyle = '#EEEEEE';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(20, y + itemHeight - 1);
            ctx.lineTo(width - 20, y + itemHeight - 1);
            ctx.stroke();
        }
    }

    if (conversations.length > maxItems) {
        ctx.fillStyle = '#999999';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`+ ${conversations.length - maxItems} conversas...`, width / 2, height - 20);
    }

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

    const pathImg = path.join(CACHE_PATH, `messages_${userId}_${Date.now()}.png`);
    const imageBuffer = canvas.toBuffer('image/png');
    fs.writeFileSync(pathImg, imageBuffer);
    return pathImg;
}

async function generateChatCanvas(userId, userName, targetId, targetName, messages, wallpaperPath) {
    const width = 450;
    const height = 780;
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    if (wallpaperPath && fs.existsSync(wallpaperPath)) {
        try {
            const wallpaper = await Canvas.loadImage(wallpaperPath);
            ctx.drawImage(wallpaper, 0, 0, width, height);
        } catch (e) {
            ctx.fillStyle = '#F5F5F5';
            ctx.fillRect(0, 0, width, height);
        }
    } else {
        ctx.fillStyle = '#F5F5F5';
        ctx.fillRect(0, 0, width, height);
    }

    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, width, height);

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(width / 2 - 60, 0, 120, 25);
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(width / 2, 0, 15, 0, Math.PI);
    ctx.fill();

    const time = getTime();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(time, width / 2, 18);

    ctx.fillStyle = 'rgba(255, 20, 147, 0.95)';
    ctx.fillRect(0, 30, width, 45);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('←', 15, 60);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    const displayName = normalizeText(targetName);
    ctx.fillText(displayName.length > 20 ? displayName.substring(0, 20) + '...' : displayName, width / 2, 60);

    const msgStartY = 85;
    const msgEndY = height - 65;
    const recentMessages = messages.slice(-20);
    let y = msgStartY + 10;

    for (const msg of recentMessages) {
        const isMe = msg.senderID == userId;
        const maxWidth = 260;
        ctx.font = '14px Arial';
        const lines = wrapText(ctx, msg.content, maxWidth);
        const lineHeight = 20;
        const padding = 12;
        const totalHeight = lines.length * lineHeight + padding * 2;
        const bubbleWidth = Math.min(maxWidth + padding * 2, 300);

        const x = isMe ? width - bubbleWidth - 20 : 20;
        const bubbleY = y;

        ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = isMe ? '#FF1493' : '#FFFFFF';
        ctx.beginPath();
        ctx.roundRect(x, bubbleY, bubbleWidth, totalHeight, 14);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = isMe ? '#FFFFFF' : '#000000';
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        lines.forEach((line, i) => {
            ctx.fillText(line, x + padding, bubbleY + padding + 14 + i * lineHeight);
        });

        ctx.fillStyle = isMe ? 'rgba(255,255,255,0.6)' : 'rgba(100,100,100,0.6)';
        ctx.font = '10px Arial';
        ctx.textAlign = isMe ? 'right' : 'left';
        const timeX = isMe ? x - 8 : x + bubbleWidth + 8;
        ctx.fillText(msg.time || '', timeX, bubbleY + totalHeight - 4);

        y += totalHeight + 14;
        if (y > msgEndY - 60) break;
    }

    const remaining = messages.length - recentMessages.length;
    if (remaining > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`📄 + ${remaining} mensagens`, width / 2, msgEndY - 12);
    }

    const inputY = height - 55;
    ctx.fillStyle = 'rgba(245, 245, 245, 0.95)';
    ctx.fillRect(10, inputY, width - 70, 40);
    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, inputY, width - 70, 40);

    ctx.fillStyle = '#999999';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Digite uma mensagem...', 20, inputY + 26);

    ctx.fillStyle = '#FF1493';
    ctx.beginPath();
    ctx.roundRect(width - 55, inputY + 2, 42, 36, 20);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('➤', width - 34, inputY + 26);

    ctx.fillStyle = 'rgba(245, 245, 245, 0.95)';
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

    const pathImg = path.join(CACHE_PATH, `chat_${userId}_${targetId}_${Date.now()}.png`);
    const imageBuffer = canvas.toBuffer('image/png');
    fs.writeFileSync(pathImg, imageBuffer);
    return pathImg;
}

module.exports = {
    config: {
        name: "messages",
        aliases: ["msg", "conversas", "mensagens"],
        version: "2.2",
        author: "Tsuki",
        countDown: 5,
        role: 0,
        description: {
            pt: "Sistema de mensagens interativo"
        },
        category: "social",
        guide: {
            pt: "   {pn} - Tela inicial\n" +
                 "   {pn} wallpaper - Define wallpaper\n" +
                 "   Responda a imagem com o número da conversa\n" +
                 "   Responda a conversa com o texto para enviar"
        }
    },

    onStart: async function ({ api, event, args, usersData }) {
        const { senderID, threadID, messageID, body, attachments } = event;
        const userId = parseInt(senderID);
        const action = args[0]?.toLowerCase();

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

        if (!messagesData[userId]) {
            messagesData[userId] = {};
        }

        if (action === 'wallpaper') {
            if (!attachments || attachments.length === 0) {
                const replyMsg = await api.sendMessage(
                    '📸 **Wallpaper**\n\n' +
                    'Responda esta mensagem com a imagem que deseja usar como wallpaper.\n' +
                    'A imagem será salva e usada como fundo das suas conversas.',
                    threadID,
                    messageID
                );

                global.GoatBot.onReply.set(replyMsg.messageID, {
                    commandName: "messages",
                    author: senderID,
                    threadID: threadID,
                    type: "set_wallpaper"
                });

                return;
            }

            const imageUrl = attachments[0].url;
            if (!imageUrl) {
                return api.sendMessage('❌ | URL da imagem não encontrada!', threadID, messageID);
            }

            try {
                const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                const imageBuffer = Buffer.from(response.data, 'utf-8');
                const wallpaperPath = path.join(WALLPAPERS_PATH, `${userId}.jpg`);
                fs.writeFileSync(wallpaperPath, imageBuffer);

                if (!messagesData[userId].settings) {
                    messagesData[userId].settings = {};
                }
                messagesData[userId].settings.wallpaper = wallpaperPath;
                saveMessages(messagesData);

                return api.sendMessage('✅ **Wallpaper definido com sucesso!**', threadID, messageID);
            } catch (error) {
                return api.sendMessage(`❌ | Erro ao definir wallpaper: ${error.message}`, threadID, messageID);
            }
        }

        const allConversations = messagesData[userId] || {};
        const conversationList = [];

        for (const [targetId, msgs] of Object.entries(allConversations)) {
            if (msgs.length > 0 && targetId !== 'settings') {
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

        conversationList.sort((a, b) => (b.lastTime || '').localeCompare(a.lastTime || ''));

        if (conversationList.length === 0) {
            return api.sendMessage('📭 | Nenhuma conversa ainda.\n💡 Envie uma mensagem com: !messages sent <Uid> <mensagem>', threadID, messageID);
        }

        try {
            const imagePath = await generateMessagesCanvas(userId, userName, conversationList);

            api.sendMessage({
                body: '📱 **Suas conversas**\n\nResponda esta mensagem com o número da conversa.\nExemplo: 1',
                attachment: fs.createReadStream(imagePath)
            }, threadID, (err, info) => {
                if (!err) {
                    global.GoatBot.onReply.set(info.messageID, {
                        commandName: "messages",
                        author: senderID,
                        messageID: info.messageID,
                        threadID: threadID,
                        type: "select_conversation",
                        conversations: conversationList
                    });
                }
            }, messageID);

            setTimeout(() => {
                if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
            }, 5000);

        } catch (error) {
            console.error('Erro ao gerar mensagens:', error);
            let msg = '📱 **Suas conversas**\n\n';
            conversationList.forEach((conv, i) => {
                msg += `${i + 1}. ${normalizeText(conv.name)}\n`;
                msg += `   💬 ${conv.lastMessage}\n`;
                msg += `   🕒 ${conv.lastTime}\n\n`;
            });
            return api.sendMessage(msg, threadID, messageID);
        }
    },

    onReply: async function ({ api, event, Reply, usersData }) {
        const { senderID, threadID, body, attachments } = event;
        const userId = parseInt(senderID);

        if (!body || body.length === 0) return;
        if (senderID !== Reply.author) return;

        const messagesData = loadMessages();
        if (!messagesData[userId]) {
            messagesData[userId] = {};
        }

        if (Reply.type === 'set_wallpaper') {
            if (!attachments || attachments.length === 0) {
                return api.sendMessage('❌ | Envie uma imagem!', threadID);
            }

            const imageUrl = attachments[0].url;
            if (!imageUrl) {
                return api.sendMessage('❌ | URL da imagem não encontrada!', threadID);
            }

            try {
                const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                const imageBuffer = Buffer.from(response.data, 'utf-8');
                const wallpaperPath = path.join(WALLPAPERS_PATH, `${userId}.jpg`);
                fs.writeFileSync(wallpaperPath, imageBuffer);

                if (!messagesData[userId].settings) {
                    messagesData[userId].settings = {};
                }
                messagesData[userId].settings.wallpaper = wallpaperPath;
                saveMessages(messagesData);

                return api.sendMessage('✅ **Wallpaper definido com sucesso!**', threadID);
            } catch (error) {
                return api.sendMessage(`❌ | Erro ao definir wallpaper: ${error.message}`, threadID);
            }
        }

        if (Reply.type === 'select_conversation') {
            const num = parseInt(body.replace(/[^0-9]/g, ''));
            if (!num || num < 1 || num > Reply.conversations.length) {
                return api.sendMessage(`❌ | Número inválido! Escolha entre 1 e ${Reply.conversations.length}.`, threadID);
            }

            const selected = Reply.conversations[num - 1];
            const targetId = selected.userID;
            const targetName = selected.name;
            const conversation = messagesData[userId]?.[targetId] || [];

            if (conversation.length === 0) {
                return api.sendMessage(`📭 | Nenhuma mensagem com ${targetName} ainda.`, threadID);
            }

            const wallpaperPath = messagesData[userId]?.settings?.wallpaper || null;

            try {
                const imagePath = await generateChatCanvas(
                    userId,
                    'Você',
                    targetId,
                    targetName,
                    conversation,
                    wallpaperPath
                );

                api.sendMessage({
                    body: `💬 **Conversa com ${targetName}**\n\nResponda esta mensagem com o texto que deseja enviar.`,
                    attachment: fs.createReadStream(imagePath)
                }, threadID, (err, info) => {
                    if (!err) {
                        global.GoatBot.onReply.set(info.messageID, {
                            commandName: "messages",
                            author: senderID,
                            threadID: threadID,
                            type: "send_message",
                            targetId: targetId,
                            targetName: targetName
                        });
                    }
                });

                setTimeout(() => {
                    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
                }, 5000);

            } catch (error) {
                console.error('Erro ao abrir conversa:', error);
                let msg = `💬 **Conversa com ${targetName}**\n\n`;
                const recent = conversation.slice(-10);
                recent.forEach(m => {
                    const isMe = m.senderID == userId;
                    msg += `${isMe ? '👤 Eu' : '👤 ' + (m.senderName || 'Desconhecido')}: ${m.content}\n`;
                    msg += `   🕒 ${m.time}\n\n`;
                });
                return api.sendMessage(msg, threadID);
            }
        }

        if (Reply.type === 'send_message') {
            const targetId = Reply.targetId;
            const targetName = Reply.targetName;

            if (body.toLowerCase() === 'ver mais' || body.toLowerCase() === 'mais') {
                const conversation = messagesData[userId]?.[targetId] || [];
                const wallpaperPath = messagesData[userId]?.settings?.wallpaper || null;
                const moreMessages = conversation.slice(-40);

                try {
                    const imagePath = await generateChatCanvas(
                        userId,
                        'Você',
                        targetId,
                        targetName,
                        moreMessages,
                        wallpaperPath
                    );

                    api.sendMessage({
                        body: `💬 **Conversa com ${targetName}** (mais mensagens)`,
                        attachment: fs.createReadStream(imagePath)
                    }, threadID);

                    setTimeout(() => {
                        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
                    }, 5000);

                } catch (error) {
                    return api.sendMessage(`❌ | Erro: ${error.message}`, threadID);
                }
                return;
            }

            if (!body || body.length < 1) {
                return api.sendMessage('❌ | Digite uma mensagem!', threadID);
            }

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
                senderName: 'Você',
                content: body,
                time: timeStr,
                date: dateStr,
                timestamp: now.getTime()
            };

            messagesData[userId][targetId].push(messageObj);
            messagesData[targetId][userId].push({
                ...messageObj,
                senderID: userId,
                senderName: 'Você'
            });

            saveMessages(messagesData);

            const updatedConversation = messagesData[userId]?.[targetId] || [];
            const wallpaperPath = messagesData[userId]?.settings?.wallpaper || null;

            try {
                const imagePath = await generateChatCanvas(
                    userId,
                    'Você',
                    targetId,
                    targetName,
                    updatedConversation,
                    wallpaperPath
                );

                api.sendMessage({
                    body: `✅ **Mensagem enviada!**\n📤 Para: ${targetName}\n💬 ${body}\n🕒 ${timeStr}`,
                    attachment: fs.createReadStream(imagePath)
                }, threadID);

                setTimeout(() => {
                    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
                }, 5000);

            } catch (error) {
                console.error('Erro ao atualizar conversa:', error);
                return api.sendMessage(`✅ **Mensagem enviada!**\n📤 Para: ${targetName}\n💬 ${body}`, threadID);
            }
        }
    }
};

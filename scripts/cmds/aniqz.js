const axios = require('axios');
const Canvas = require('canvas');
const fs = require('fs-extra');
const path = require('path');

// 🔥 CAMINHO DAS IMAGENS
const DATA_PATH = path.join(__dirname, '..', '..', 'database', 'data');

// 🔥 ESTADO DO QUIZ POR GRUPO
const quizState = {};

// 🔥 PRÊMIOS FINAIS
const FINAL_PRIZES = {
    1: 30000,
    2: 15000,
    3: 7500
};

// 🔥 META DE PONTOS
const WINNER_POINTS = 10000;

// 🔥 FUNÇÃO INTELIGENTE PRA ACHAR A IMAGEM
function findImageFile(characterName) {
    if (!fs.existsSync(DATA_PATH)) return null;

    const files = fs.readdirSync(DATA_PATH);
    const searchName = characterName.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const file of files) {
        const fileName = file.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (fileName.includes(searchName) || searchName.includes(fileName)) {
            return path.join(DATA_PATH, file);
        }
    }
    return null;
}

// 🔥 FUNÇÃO PARA CARREGAR PERSONAGENS
function loadCharacters() {
    try {
        const jsonPath = path.join(DATA_PATH, 'characters.json');
        if (!fs.existsSync(jsonPath)) {
            console.log('⚠️ characters.json não encontrado! Usando lista local.');
            return LOCAL_CHARACTERS;
        }
        return fs.readJSONSync(jsonPath);
    } catch (error) {
        console.error('❌ Erro ao carregar characters.json:', error.message);
        return LOCAL_CHARACTERS;
    }
}

// 🔥 LISTA LOCAL (FALLBACK)
const LOCAL_CHARACTERS = [
    { name: 'Naruto Uzumaki', anime: 'Naruto' },
    { name: 'Sasuke Uchiha', anime: 'Naruto' },
    { name: 'Monkey D. Luffy', anime: 'One Piece' },
    { name: 'Roronoa Zoro', anime: 'One Piece' },
    { name: 'Goku', anime: 'Dragon Ball Z' }
];

// 🔥 BUSCA PERSONAGEM
async function fetchCharacter() {
    const characters = loadCharacters();
    const randomIndex = Math.floor(Math.random() * characters.length);
    const character = characters[randomIndex];

    return {
        name: character.name,
        anime: character.anime || 'Anime desconhecido',
        dica1: character.dica1 || `🔍 Personagem de ${character.anime || 'anime'}!`,
        dica2: character.dica2 || '🔍 Tente lembrar do nome dele(a)!',
        dica3: character.dica3 || '🔍 É um personagem muito famoso!',
        source: 'Local'
    };
}

// 🔥 COMANDO PRINCIPAL
module.exports = {
    config: {
        name: "animequiz",
        aliases: ["aq", "quizanime"],
        version: "5.0",
        author: "Hinata",
        countDown: 10,
        role: 0,
        description: {
            pt: "Quiz de anime! Primeiro a atingir 10.000 pontos ganha!"
        },
        category: "game",
        guide: {
            pt: "   {pn}: Inicia um quiz\n" +
                "   {pn} ranking: Mostra o ranking do grupo\n" +
                "   {pn} top: Top 10 global"
        }
    },

    onStart: async function ({ api, event, args, usersData }) {
        const { threadID, senderID, messageID } = event;
        const action = args[0]?.toLowerCase();

        if (action === 'ranking' || action === 'rank') {
            return await showGroupRanking(api, event, usersData);
        }

        if (action === 'top') {
            return await showGlobalTop(api, event, usersData);
        }

        if (quizState[threadID] && quizState[threadID].active) {
            return api.sendMessage('⏳ | Um quiz já está em andamento neste grupo!', threadID, messageID);
        }

        await startQuiz(api, event, usersData);
    },

    onReply: async function ({ api, event, Reply, usersData }) {
        const { threadID, senderID, body } = event;
        const quiz = quizState[threadID];

        if (!quiz || !quiz.active) return;
        if (!body || body.length < 2) return;

        if (quiz.answers.some(a => a.senderID === senderID)) {
            return api.sendMessage('⏳ | Você já respondeu esta pergunta!', threadID);
        }

        const normalizeName = (name) => {
            return name
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9 ]/g, '')
                .toLowerCase()
                .trim();
        };

        const normalizedCharacter = normalizeName(quiz.characterName);
        const normalizedAnswer = normalizeName(body);

        const isCorrect =
            normalizedAnswer === normalizedCharacter ||
            normalizedAnswer.includes(normalizedCharacter) ||
            normalizedCharacter.includes(normalizedAnswer);

        if (isCorrect) {
            const position = quiz.answers.length + 1;

            // 🔥 SALVA A RESPOSTA (sem dinheiro, só pontos)
            quiz.answers.push({
                senderID: senderID,
                position: position
            });

            // 🔥 ATUALIZA PONTOS DO USUÁRIO (SÓ PONTOS, SEM DINHEIRO)
            const userData = await usersData.get(senderID);
            const currentPoints = userData.data?.quizPoints || 0;
            const newPoints = currentPoints + 1;

            await usersData.set(senderID, {
                "data.quizPoints": newPoints,
                "data.quizWins": (userData.data?.quizWins || 0) + 1
            });

            let medal = '';
            if (position === 1) medal = '🥇';
            else if (position === 2) medal = '🥈';
            else if (position === 3) medal = '🥉';

            const name = userData.name || `User_${senderID}`;
            let msg = `✅ **${medal} ${name} acertou!**\n` +
                `🎯 Posição: ${position}º\n` +
                `📊 Pontos: ${newPoints}/${WINNER_POINTS}\n\n` +
                `📝 Resposta: **${quiz.characterName}**`;

            if (position === 1) {
                msg += `\n\n🎉 **PRIMEIRA RESPOSTA CORRETA!** 🎉`;
            }

            api.sendMessage(msg, threadID);

            // 🔥 VERIFICA SE ALGUÉM ATINGIU 10.000 PONTOS
            if (newPoints >= WINNER_POINTS) {
                await endQuiz(api, threadID, usersData);
                return;
            }

            // 🔥 SE 3 PESSOAS ACERTAREM, ENCERRA A RODADA E COMEÇA OUTRA
            if (quiz.answers.length >= 3) {
                // 🔥 MOSTRA OS RESULTADOS DA RODADA
                let resultMsg = `🏁 **RODADA FINALIZADA!**\n\n📊 **Resultados:**\n`;
                quiz.answers.forEach((a, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
                    const userData = usersData.get(a.senderID);
                    const name = userData?.name || `User_${a.senderID}`;
                    const points = userData?.data?.quizPoints || 0;
                    resultMsg += `${medal} ${name}: ${points} pts\n`;
                });
                api.sendMessage(resultMsg, threadID);

                // 🔥 RESETA A RODADA E COMEÇA OUTRA PERGUNTA
                await startQuiz(api, { threadID, senderID, messageID: quiz.messageID }, usersData);
            }
        }
    }
};

// 🔥 INICIA O QUIZ
async function startQuiz(api, event, usersData) {
    const { threadID, messageID, senderID } = event;

    try {
        const character = await fetchCharacter();
        const characterName = character.name;
        const animeName = character.anime || 'Anime desconhecido';

        // 🔥 PROCURA A IMAGEM
        const imagePath = findImageFile(characterName);
        let imageAttachment = null;

        if (imagePath) {
            try {
                imageAttachment = fs.createReadStream(imagePath);
                console.log(`✅ Imagem encontrada: ${path.basename(imagePath)}`);
            } catch (e) {
                console.log('❌ Erro ao carregar imagem:', e.message);
            }
        } else {
            console.log(`⚠️ Imagem não encontrada para: ${characterName}`);
        }

        // 🔥 TEXTO DA PERGUNTA
        const question = `📺 **QUIZ DE ANIME**\n\n` +
            `🔍 Quem é esse personagem?\n`
            `⏳ Você tem 30 segundos para responder!\n` +
            `🏆 **Quem atingir ${WINNER_POINTS.toLocaleString()} pontos primeiro ganha!**\n\n` +
            `📊 **Prêmios finais:**\n` +
            `🥇 1º: 30.000$\n` +
            `🥈 2º: 15.000$\n` +
            `🥉 3º: 7.500$\n\n` +
            `📝 Digite o nome do personagem!`;

        // 🔥 ENVIA O TEXTO
        const sentMessage = await api.sendMessage(question, threadID, messageID);

        // 🔥 DEPOIS ENVIA A IMAGEM SEPARADA (SE TIVER)
        if (imageAttachment) {
            await api.sendMessage({
                body: `🖼️ Foto}`,
                attachment: imageAttachment
            }, threadID);
        }

        // 🔥 GUARDA O ESTADO DO QUIZ
        quizState[threadID] = {
            active: true,
            character: character,
            characterName: characterName,
            answers: [],
            startTime: Date.now(),
            messageID: sentMessage.messageID,
            timeout: setTimeout(async () => {
                await endRound(api, threadID, usersData);
            }, 30000)
        };

        // 🔥 REGISTRA O onReply
        global.GoatBot.onReply.set(sentMessage.messageID, {
            commandName: "animequiz",
            author: senderID,
            messageID: sentMessage.messageID,
            threadID: threadID
        });

    } catch (error) {
        console.error('❌ Erro no quiz:', error);
        api.sendMessage(`❌ | Erro: ${error.message}`, threadID, messageID);
    }
}

// 🔥 FINALIZA UMA RODADA
async function endRound(api, threadID, usersData) {
    const quiz = quizState[threadID];
    if (!quiz || !quiz.active) return;

    quiz.active = false;

    if (quiz.timeout) {
        clearTimeout(quiz.timeout);
        quiz.timeout = null;
    }

    const winners = quiz.answers.slice(0, 3);
    const characterName = quiz.characterName;

    if (winners.length === 0) {
        const msg = `⏰ **TEMPO ESGOTADO!**\n\nNinguém acertou a pergunta.\n📝 Resposta: **${characterName}**\n\n🔄 Nova rodada em breve...`;
        api.sendMessage(msg, threadID);
        
        // 🔥 COMEÇA UMA NOVA RODADA
        setTimeout(async () => {
            await startQuiz(api, { threadID, messageID: quiz.messageID, senderID: quiz.senderID }, usersData);
        }, 3000);
        return;
    }

    // 🔥 MOSTRA OS RESULTADOS DA RODADA
    let resultMsg = `🏁 **RODADA FINALIZADA!**\n\n📝 Resposta: **${characterName}**\n\n📊 **Resultados:**\n`;
    winners.forEach((a, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
        const userData = usersData.get(a.senderID);
        const name = userData?.name || `User_${a.senderID}`;
        const points = userData?.data?.quizPoints || 0;
        resultMsg += `${medal} ${name}: ${points} pts\n`;
    });
    api.sendMessage(resultMsg, threadID);

    // 🔥 VERIFICA SE ALGUÉM ATINGIU 10.000 PONTOS (se tiver, encerra o jogo)
    for (const answer of quiz.answers) {
        const userData = await usersData.get(answer.senderID);
        const points = userData?.data?.quizPoints || 0;
        if (points >= WINNER_POINTS) {
            await endGame(api, threadID, usersData);
            return;
        }
    }

    // 🔥 COMEÇA UMA NOVA RODADA
    setTimeout(async () => {
        await startQuiz(api, { threadID, messageID: quiz.messageID, senderID: quiz.senderID }, usersData);
    }, 3000);

    delete quizState[threadID];
}

// 🔥 FINALIZA O JOGO (QUANDO ALGUÉM ATINGE 10.000 PONTOS)
async function endGame(api, threadID, usersData) {
    const quiz = quizState[threadID];
    if (!quiz) return;

    // 🔥 PEGA TODOS OS JOGADORES E ORDENA POR PONTOS
    const allUsers = await usersData.getAll();
    const players = allUsers
        .filter(u => (u.data?.quizPoints || 0) > 0)
        .map(u => ({
            userID: u.userID,
            name: u.name || `User_${u.userID}`,
            points: u.data?.quizPoints || 0,
            wins: u.data?.quizWins || 0
        }))
        .sort((a, b) => b.points - a.points);

    const top3 = players.slice(0, 3);

    // 🔥 DISTRIBUI OS PRÊMIOS
    let prizeMsg = `🏆 **FIM DE JOGO!** 🏆\n\n`;
    prizeMsg += `🎯 **Alguém atingiu ${WINNER_POINTS.toLocaleString()} pontos!**\n\n`;
    prizeMsg += `📊 **TOP 3 FINAL:**\n`;

    for (let i = 0; i < Math.min(top3.length, 3); i++) {
        const player = top3[i];
        const prize = FINAL_PRIZES[i + 1] || 0;
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
        
        // 🔥 ADICIONA O DINHEIRO
        const userData = await usersData.get(player.userID);
        await usersData.set(player.userID, {
            money: (userData.money || 0) + prize
        });

        // 🔥 RESETA OS PONTOS DO QUIZ
        await usersData.set(player.userID, {
            "data.quizPoints": 0
        });

        prizeMsg += `${medal} **${player.name}**\n`;
        prizeMsg += `   💰 ${player.points} pts | +${prize.toLocaleString()}$\n\n`;
    }

    // 🔥 RESETA OS PONTOS DOS OUTROS JOGADORES
    for (const player of players.slice(3)) {
        await usersData.set(player.userID, {
            "data.quizPoints": 0
        });
    }

    api.sendMessage(prizeMsg, threadID);

    // 🔥 LIMPA O ESTADO
    delete quizState[threadID];
}

// 🔥 FUNÇÃO PARA GERAR IMAGEM DOS VENCEDORES (MANTIDA)
async function generateWinnerImage(winners, usersData, characterName) {
    const width = 1200;
    const height = 600;
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#0a1628');
    gradient.addColorStop(0.5, '#1a0a2e');
    gradient.addColorStop(1, '#0a1628');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.shadowColor = '#FF1493';
    ctx.shadowBlur = 30;
    ctx.strokeStyle = '#FF1493';
    ctx.lineWidth = 3;
    ctx.strokeRect(15, 15, width - 30, height - 30);
    ctx.shadowBlur = 0;

    ctx.shadowColor = '#FF1493';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🏆 RESULTADO DO QUIZ 🏆', width / 2, 60);
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`📝 Resposta: ${characterName}`, width / 2, 95);

    ctx.strokeStyle = 'rgba(255, 215, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(100, 110);
    ctx.lineTo(width - 100, 110);
    ctx.stroke();

    const positions = [
        { x: width / 2, y: 280, scale: 1.4, color: '#FFD700', glow: '#FFD700', rank: '🥇' },
        { x: width / 2 - 280, y: 310, scale: 1.0, color: '#C0C0C0', glow: '#C0C0C0', rank: '🥈' },
        { x: width / 2 + 280, y: 310, scale: 1.0, color: '#CD7F32', glow: '#CD7F32', rank: '🥉' }
    ];

    for (let i = 0; i < Math.min(winners.length, 3); i++) {
        const winner = winners[i];
        const pos = positions[i];
        const userData = await usersData.get(winner.senderID);
        const name = userData?.name || `User_${winner.senderID}`;
        const avatarUrl = `https://graph.facebook.com/${winner.senderID}/picture?width=200&height=200`;

        const avatarSize = 120 * pos.scale;
        const x = pos.x - avatarSize / 2;
        const y = pos.y - avatarSize / 2;

        ctx.shadowColor = pos.glow;
        ctx.shadowBlur = 40;
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, avatarSize / 2 + 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        try {
            const avatar = await Canvas.loadImage(avatarUrl);
            ctx.shadowColor = pos.glow;
            ctx.shadowBlur = 30;

            ctx.save();
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, avatarSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, x, y, avatarSize, avatarSize);
            ctx.restore();
            ctx.shadowBlur = 0;

            ctx.strokeStyle = pos.color;
            ctx.lineWidth = 4;
            ctx.shadowColor = pos.glow;
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, avatarSize / 2 + 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        } catch (e) {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, avatarSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = '#1a2a6c';
            ctx.fill();
            ctx.strokeStyle = pos.color;
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.font = `${50 * pos.scale}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText('👤', pos.x, pos.y + 20 * pos.scale);
        }

        ctx.shadowColor = pos.glow;
        ctx.shadowBlur = 20;
        ctx.fillStyle = pos.color;
        ctx.font = `bold ${44 * pos.scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(pos.rank, pos.x, pos.y - avatarSize / 2 - 30);
        ctx.shadowBlur = 0;

        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${22 * pos.scale}px Arial`;
        ctx.textAlign = 'center';
        const displayName = name.length > 15 ? name.substring(0, 13) + '...' : name;
        ctx.fillText(displayName, pos.x, pos.y + avatarSize / 2 + 35);
        ctx.shadowBlur = 0;

        ctx.fillStyle = pos.color;
        ctx.font = `bold ${20 * pos.scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(`💰 ${winner.prize.toLocaleString()}$`, pos.x, pos.y + avatarSize / 2 + 65);
    }

    ctx.fillStyle = 'rgba(255,20,147,0.2)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('✦ Hinata Bot ✦', width - 20, height - 15);

    const pathImg = path.join(__dirname, 'cache', `quiz_result_${Date.now()}.png`);
    const imageBuffer = canvas.toBuffer('image/png');
    fs.writeFileSync(pathImg, imageBuffer);
    return pathImg;
}

// 🔥 RANKING DO GRUPO
async function showGroupRanking(api, event, usersData) {
    const { threadID, messageID } = event;
    const allUsers = await usersData.getAll();

    const players = allUsers
        .filter(u => (u.data?.quizPoints || 0) > 0)
        .map(u => ({
            name: u.name || `User_${u.userID}`,
            points: u.data?.quizPoints || 0,
            wins: u.data?.quizWins || 0
        }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 10);

    if (players.length === 0) {
        return api.sendMessage('📊 | Ninguém jogou quiz ainda!', threadID, messageID);
    }

    let msg = `🏆 **RANKING DO QUIZ**\n\n`;
    players.forEach((p, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`;
        msg += `${medal} ${p.name}\n`;
        msg += `   💰 ${p.points}pts | 🎯 ${p.wins} acertos\n\n`;
    });

    api.sendMessage(msg, threadID, messageID);
}

// 🔥 TOP GLOBAL
async function showGlobalTop(api, event, usersData) {
    const { threadID, messageID } = event;
    const allUsers = await usersData.getAll();

    const players = allUsers
        .filter(u => (u.data?.quizPoints || 0) > 0)
        .map(u => ({
            name: u.name || `User_${u.userID}`,
            points: u.data?.quizPoints || 0,
            wins: u.data?.quizWins || 0
        }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 10);

    if (players.length === 0) {
        return api.sendMessage('📊 | Ninguém jogou quiz ainda!', threadID, messageID);
    }

    let msg = `🌍 **TOP GLOBAL DO QUIZ**\n\n`;
    players.forEach((p, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`;
        msg += `${medal} ${p.name}\n`;
        msg += `   💰 ${p.points}pts | 🎯 ${p.wins} acertos\n\n`;
    });

    api.sendMessage(msg, threadID, messageID);
}

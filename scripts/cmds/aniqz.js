const axios = require('axios');
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

// 🔥 TEMPO DE RESPOSTA (ms)
const ROUND_TIME = 15000;

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

// 🔥 LISTA LOCAL (FALLBACK)
const LOCAL_CHARACTERS = [
    { name: 'Naruto Uzumaki', anime: 'Naruto' },
    { name: 'Sasuke Uchiha', anime: 'Naruto' },
    { name: 'Monkey D. Luffy', anime: 'One Piece' },
    { name: 'Roronoa Zoro', anime: 'One Piece' },
    { name: 'Goku', anime: 'Dragon Ball Z' }
];

// 🔥 FUNÇÃO PARA CARREGAR PERSONAGENS
function loadCharacters() {
    try {
        const jsonPath = path.join(DATA_PATH, 'characters.json');
        if (!fs.existsSync(jsonPath)) return LOCAL_CHARACTERS;
        return fs.readJSONSync(jsonPath);
    } catch (error) {
        console.error('❌ Erro ao carregar characters.json:', error.message);
        return LOCAL_CHARACTERS;
    }
}

// 🔥 BUSCA PERSONAGEM
async function fetchCharacter() {
    const characters = loadCharacters();
    const randomIndex = Math.floor(Math.random() * characters.length);
    const character = characters[randomIndex];
    return {
        name: character.name,
        anime: character.anime || 'Anime desconhecido'
    };
}

// 🔥 NORMALIZA NOME
function normalizeName(name) {
    if (!name) return '';
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .toLowerCase()
        .trim();
}

// 🔥 VERIFICA SE A RESPOSTA ESTÁ CORRETA
function checkAnswer(userAnswer, correctAnswer) {
    const ua = normalizeName(userAnswer);
    const ca = normalizeName(correctAnswer);
    if (!ua || !ca) return false;
    // Remove espaços para comparação mais flexível
    const uaNoSpace = ua.replace(/\s+/g, '');
    const caNoSpace = ca.replace(/\s+/g, '');
    return ua === ca
        || uaNoSpace === caNoSpace
        || ua.includes(ca)
        || ca.includes(ua)
        || uaNoSpace.includes(caNoSpace)
        || caNoSpace.includes(uaNoSpace);
}

// 🔥 COMANDO PRINCIPAL
module.exports = {
    config: {
        name: "animequiz",
        aliases: ["aq", "quizanime"],
        version: "8.0",
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

    // ============================================================
    // 🔥 onStart - Inicia o quiz / mostra ranking
    // ============================================================
    onStart: async function ({ api, event, args, usersData }) {
        const { threadID, messageID } = event;
        const action = (args[0] || '').toLowerCase();

        if (action === 'ranking' || action === 'rank') {
            return await showGroupRanking(api, event, usersData);
        }
        if (action === 'top') {
            return await showGlobalTop(api, event, usersData);
        }

        const quiz = quizState[threadID];
        if (quiz && quiz.active) {
            return api.sendMessage('⏳ | Um quiz já está em andamento neste grupo!', threadID, messageID);
        }

        await startQuiz(api, event, usersData);
    },

    // ============================================================
    // 🔥 onReply - Quando alguém responde CITANDO a mensagem do bot
    // ============================================================
    onReply: async function ({ api, event, Reply, usersData }) {
        const { threadID, senderID, body, messageID } = event;

        const quiz = quizState[threadID];
        if (!quiz || !quiz.active) return;

        // 🔥 Verifica se a resposta é para a mensagem correta (a que registrou o onReply)
        if (Reply && Reply.messageID && quiz.messageID && Reply.messageID !== quiz.messageID) return;

        if (!body || body.trim().length < 2) return;

        await handleAnswer({ api, event, usersData, quiz, senderID, body, threadID });
    },

    // ============================================================
    // 🔥 onChat - Fallback: captura respostas DIRETAS (sem citar)
    // ============================================================
    onChat: async function ({ api, event, usersData }) {
        const { threadID, senderID, body, messageID, messageReply } = event;
        const quiz = quizState[threadID];
        if (!quiz || !quiz.active) return;

        // Se for uma resposta citando a mensagem do bot, o onReply já vai tratar
        if (messageReply && messageReply.messageID === quiz.messageID) return;

        // Se for comando (começa com prefixo), ignora
        const prefix = global.GoatBot.config.prefix;
        if (body && body.startsWith(prefix)) return;

        // Se for muito curto, ignora
        if (!body || body.trim().length < 2) return;

        // Se for o autor tentando reiniciar, ignora
        if (['ranking', 'rank', 'top'].includes(body.trim().toLowerCase())) return;

        await handleAnswer({ api, event, usersData, quiz, senderID, body, threadID });
    }
};

// ============================================================
// 🔥 PROCESSA A RESPOSTA (usado por onReply e onChat)
// ============================================================
async function handleAnswer({ api, event, usersData, quiz, senderID, body, threadID }) {
    // 🔥 Verifica se o usuário já respondeu
    if (quiz.answers.some(a => a.senderID === senderID)) {
        return api.sendMessage('⏳ | Você já respondeu esta pergunta!', threadID);
    }

    const isCorrect = checkAnswer(body, quiz.characterName);

    if (!isCorrect) return; // silencioso para não floodar

    // 🔥 Acertou!
    const position = quiz.answers.length + 1;

    let points = 50;
    if (position === 1) points = 300;
    else if (position === 2) points = 200;
    else if (position === 3) points = 100;

    quiz.answers.push({ senderID, position, points });

    const userData = await usersData.get(senderID);
    const currentPoints = userData?.data?.quizPoints || 0;
    const newPoints = currentPoints + points;

    await usersData.set(senderID, {
        "data.quizPoints": newPoints,
        "data.quizWins": (userData?.data?.quizWins || 0) + 1
    });

    const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '🏅';
    const name = userData?.name || `User_${senderID}`;

    let msg = `✅ ${medal} ${name} acertou!\n` +
        `🎯 Posição: ${position}º\n` +
        `💰 +${points} pts\n` +
        `📊 Total: ${newPoints}/${WINNER_POINTS}\n\n` +
        `📝 Resposta: ${quiz.characterName}`;

    if (position === 1) msg += `\n\n🎉 Primeira resposta correta! 🎉`;

    api.sendMessage(msg, threadID);

    // 🔥 Verifica se atingiu a meta
    if (newPoints >= WINNER_POINTS) {
        await endGame(api, threadID, usersData);
        return;
    }

    // 🔥 Se já teve 3 acertos, encerra a rodada
    if (quiz.answers.length >= 3) {
        await endRound(api, threadID, usersData);
    }
}

// ============================================================
// 🔥 INICIA UMA NOVA RODADA
// ============================================================
async function startQuiz(api, event, usersData) {
    const { threadID, messageID } = event;

    // 🔥 Cancela timer anterior se existir
    const oldQuiz = quizState[threadID];
    if (oldQuiz && oldQuiz.timeout) {
        clearTimeout(oldQuiz.timeout);
    }

    try {
        const character = await fetchCharacter();
        const characterName = character.name;
        const animeName = character.anime || 'Anime desconhecido';

        const imagePath = findImageFile(characterName);
        let imageAttachment = null;

        if (imagePath) {
            try {
                imageAttachment = fs.createReadStream(imagePath);
            } catch (e) {
                console.log('❌ Erro ao carregar imagem:', e.message);
            }
        }

        const question = `📺 QUIZ DE ANIME\n\n` +
            `🔍 Quem é esse personagem?\n` +
            `📖 Anime: ${animeName}\n\n` +
            `⏳ Você tem ${ROUND_TIME / 1000} segundos!\n` +
            `💡 Responda esta mensagem com o nome do personagem!\n\n` +
            `🏆 Quem atingir ${WINNER_POINTS.toLocaleString()} pontos primeiro ganha!\n\n` +
            `📊 Prêmios finais:\n` +
            `🥇 1º: 30.000$\n` +
            `🥈 2º: 15.000$\n` +
            `🥉 3º: 7.500$`;

        // 🔥 Envia imagem + texto juntos (melhor UX)
        let sentMessage;
        if (imageAttachment) {
            sentMessage = await api.sendMessage({
                body: question,
                attachment: imageAttachment
            }, threadID, messageID);
        } else {
            sentMessage = await api.sendMessage(question, threadID, messageID);
        }

        // 🔥 Registra onReply para a mensagem enviada
        global.GoatBot.onReply.set(sentMessage.messageID, {
            commandName: "animequiz",
            messageID: sentMessage.messageID,
            threadID: threadID,
            author: event.senderID || null
        });

        // 🔥 Estado do quiz
        const quiz = {
            active: true,
            character,
            characterName,
            answers: [],
            startTime: Date.now(),
            messageID: sentMessage.messageID,
            threadID,
            senderID: event.senderID || null,
            timeout: null
        };

        quiz.timeout = setTimeout(async () => {
            await endRound(api, threadID, usersData);
        }, ROUND_TIME);

        quizState[threadID] = quiz;

    } catch (error) {
        console.error('❌ Erro no quiz:', error);
        api.sendMessage(`❌ | Erro: ${error.message}`, threadID, messageID);
    }
}

// ============================================================
// 🔥 FINALIZA UMA RODADA (tempo esgotado ou 3 acertos)
// ============================================================
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
        api.sendMessage(
            `⏰ Tempo esgotado!\n\nNinguém acertou.\n📝 Resposta: ${characterName}\n\n🔄 Nova rodada em 3s...`,
            threadID
        );
    } else {
        let resultMsg = `🏁 Rodada finalizada!\n\n📝 Resposta: ${characterName}\n\n📊 Resultados:\n`;
        for (let i = 0; i < winners.length; i++) {
            const a = winners[i];
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
            const userData = await usersData.get(a.senderID);
            const name = userData?.name || `User_${a.senderID}`;
            const total = userData?.data?.quizPoints || 0;
            resultMsg += `${medal} ${name}: +${a.points} pts (Total: ${total})\n`;
        }
        api.sendMessage(resultMsg, threadID);
    }

    // 🔥 Verifica se alguém bateu a meta
    for (const answer of quiz.answers) {
        const userData = await usersData.get(answer.senderID);
        const points = userData?.data?.quizPoints || 0;
        if (points >= WINNER_POINTS) {
            await endGame(api, threadID, usersData);
            return;
        }
    }

    // 🔥 Limpa estado e agenda nova rodada
    delete quizState[threadID];

    setTimeout(async () => {
        // 🔥 Verifica se não foi iniciado outro quiz nesse meio tempo
        if (quizState[threadID] && quizState[threadID].active) return;
        await startQuiz(api, { threadID, messageID: quiz.messageID, senderID: quiz.senderID }, usersData);
    }, 3000);
}

// ============================================================
// 🔥 FINALIZA O JOGO (alguém atingiu 10.000 pontos)
// ============================================================
async function endGame(api, threadID, usersData) {
    const quiz = quizState[threadID];
    if (quiz) {
        quiz.active = false;
        if (quiz.timeout) clearTimeout(quiz.timeout);
        delete quizState[threadID];
    }

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

    let prizeMsg = `🏆 FIM DE JOGO! 🏆\n\n`;
    prizeMsg += `🎯 Alguém atingiu ${WINNER_POINTS.toLocaleString()} pontos!\n\n`;
    prizeMsg += `📊 TOP 3 FINAL:\n`;

    for (let i = 0; i < top3.length; i++) {
        const player = top3[i];
        const prize = FINAL_PRIZES[i + 1] || 0;
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';

        const userData = await usersData.get(player.userID);
        await usersData.set(player.userID, {
            money: (userData?.money || 0) + prize,
            "data.quizPoints": 0
        });

        prizeMsg += `${medal} ${player.name}\n`;
        prizeMsg += `   💰 ${player.points} pts | +${prize.toLocaleString()}$\n\n`;
    }

    // Reseta pontos de todos
    for (const player of players.slice(3)) {
        await usersData.set(player.userID, { "data.quizPoints": 0 });
    }

    api.sendMessage(prizeMsg, threadID);
}

// ============================================================
// 🔥 RANKING DO GRUPO
// ============================================================
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

    let msg = `🏆 RANKING DO QUIZ\n\n`;
    players.forEach((p, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`;
        msg += `${medal} ${p.name}\n`;
        msg += `   💰 ${p.points}pts | 🎯 ${p.wins} acertos\n\n`;
    });

    api.sendMessage(msg, threadID, messageID);
}

// ============================================================
// 🔥 TOP GLOBAL
// ============================================================
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

    let msg = `🌍 TOP GLOBAL DO QUIZ\n\n`;
    players.forEach((p, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`;
        msg += `${medal} ${p.name}\n`;
        msg += `   💰 ${p.points}pts | 🎯 ${p.wins} acertos\n\n`;
    });

    api.sendMessage(msg, threadID, messageID);
}

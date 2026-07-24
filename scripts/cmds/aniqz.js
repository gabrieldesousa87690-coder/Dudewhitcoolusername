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

            // 🔥 CALCULA PONTOS BASEADO NA POSIÇÃO
            let points = 0;
            if (position === 1) {
                points = 500;
            } else if (position === 2) {
                points = 200;
            } else if (position === 3) {
                points = 100;
            } else {
                points = 50;
            }

            quiz.answers.push({
                senderID: senderID,
                position: position,
                points: points
            });

            const userData = await usersData.get(senderID);
            const currentPoints = userData.data?.quizPoints || 0;
            const newPoints = currentPoints + points;

            await usersData.set(senderID, {
                "data.quizPoints": newPoints,
                "data.quizWins": (userData.data?.quizWins || 0) + 1
            });

            let medal = '';
            if (position === 1) medal = '🥇';
            else if (position === 2) medal = '🥈';
            else if (position === 3) medal = '🥉';

            const name = userData.name || `User_${senderID}`;
            let msg = `✅ ${medal} ${name} acertou!\n` +
                `🎯 Posição: ${position}º\n` +
                `💰 +${points} pts\n` +
                `📊 Total: ${newPoints}/${WINNER_POINTS}\n\n` +
                `📝 Resposta: ${quiz.characterName}`;

            if (position === 1) {
                msg += `\n\n🎉 Primeira resposta correta! 🎉`;
            }

            api.sendMessage(msg, threadID);

            if (newPoints >= WINNER_POINTS) {
                await endGame(api, threadID, usersData);
                return;
            }

            if (quiz.answers.length >= 3) {
                let resultMsg = `🏁 Rodada finalizada!\n\n📊 Resultados:\n`;
                quiz.answers.forEach((a, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
                    const userData = usersData.get(a.senderID);
                    const name = userData?.name || `User_${a.senderID}`;
                    const points = a.points || 0;
                    const total = userData?.data?.quizPoints || 0;
                    resultMsg += `${medal} ${name}: +${points} pts (Total: ${total})\n`;
                });
                api.sendMessage(resultMsg, threadID);

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

        const question = `📺 QUIZ DE ANIME\n\n` +
            `🔍 Quem é esse personagem?\n` +
            `📖 Anime: ${animeName}\n\n` +
            `⏳ Você tem 30 segundos para responder!\n` +
            `🏆 Quem atingir ${WINNER_POINTS.toLocaleString()} pontos primeiro ganha!\n\n` +
            `📊 Prêmios finais:\n` +
            `🥇 1º: 30.000$\n` +
            `🥈 2º: 15.000$\n` +
            `🥉 3º: 7.500$\n\n` +
            `📝 Digite o nome do personagem!`;

        const sentMessage = await api.sendMessage(question, threadID, messageID);

        if (imageAttachment) {
            await api.sendMessage({
                body: `🖼️`,
                attachment: imageAttachment
            }, threadID);
        }

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
        const msg = `⏰ Tempo esgotado!\n\nNinguém acertou a pergunta.\n📝 Resposta: ${characterName}\n\n🔄 Nova rodada em breve...`;
        api.sendMessage(msg, threadID);
        
        setTimeout(async () => {
            await startQuiz(api, { threadID, messageID: quiz.messageID, senderID: quiz.senderID }, usersData);
        }, 3000);
        return;
    }

    let resultMsg = `🏁 Rodada finalizada!\n\n📝 Resposta: ${characterName}\n\n📊 Resultados:\n`;
    winners.forEach((a, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
        const userData = usersData.get(a.senderID);
        const name = userData?.name || `User_${a.senderID}`;
        const points = a.points || 0;
        const total = userData?.data?.quizPoints || 0;
        resultMsg += `${medal} ${name}: +${points} pts (Total: ${total})\n`;
    });
    api.sendMessage(resultMsg, threadID);

    for (const answer of quiz.answers) {
        const userData = await usersData.get(answer.senderID);
        const points = userData?.data?.quizPoints || 0;
        if (points >= WINNER_POINTS) {
            await endGame(api, threadID, usersData);
            return;
        }
    }

    setTimeout(async () => {
        await startQuiz(api, { threadID, messageID: quiz.messageID, senderID: quiz.senderID }, usersData);
    }, 3000);

    delete quizState[threadID];
}

// 🔥 FINALIZA O JOGO (QUANDO ALGUÉM ATINGE 10.000 PONTOS)
async function endGame(api, threadID, usersData) {
    const quiz = quizState[threadID];
    if (!quiz) return;

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

    for (let i = 0; i < Math.min(top3.length, 3); i++) {
        const player = top3[i];
        const prize = FINAL_PRIZES[i + 1] || 0;
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
        
        const userData = await usersData.get(player.userID);
        await usersData.set(player.userID, {
            money: (userData.money || 0) + prize
        });

        await usersData.set(player.userID, {
            "data.quizPoints": 0
        });

        prizeMsg += `${medal} ${player.name}\n`;
        prizeMsg += `   💰 ${player.points} pts | +${prize.toLocaleString()}$\n\n`;
    }

    for (const player of players.slice(3)) {
        await usersData.set(player.userID, {
            "data.quizPoints": 0
        });
    }

    api.sendMessage(prizeMsg, threadID);

    delete quizState[threadID];
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

    let msg = `🏆 RANKING DO QUIZ\n\n`;
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

    let msg = `🌍 TOP GLOBAL DO QUIZ\n\n`;
    players.forEach((p, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`;
        msg += `${medal} ${p.name}\n`;
        msg += `   💰 ${p.points}pts | 🎯 ${p.wins} acertos\n\n`;
    });

    api.sendMessage(msg, threadID, messageID);
}

const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

// 🔥 CAMINHO DAS IMAGENS LOCAIS (fallback)
const DATA_PATH = path.join(__dirname, '..', '..', 'database', 'data');

// 🔥 ESTADO DO QUIZ
const quizState = {};

// 🔥 PRÊMIOS
const FINAL_PRIZES = { 1: 30000, 2: 15000, 3: 7500 };
const WINNER_POINTS = 10000;
const ROUND_TIME = 15000;

// ══════════════════════════════════════════════════════════════
// 🔥 JIKAN API - RATE LIMITER (3 req/s, 60 req/min)
// ══════════════════════════════════════════════════════════════
const JIKAN_BASE = 'https://api.jikan.moe/v4';
const JIKAN_RPS = 3;           // 3 por segundo
const JIKAN_RPM = 60;          // 60 por minuto
const JIKAN_DELAY = 4000;      // 4s para bulk/populate (obrigatório) [citation:4]

let jikanQueue = [];
let jikanProcessing = false;
let jikanTimestamps = [];      // timestamps das últimas requisições
let jikanMinuteTimestamps = [];

// 🔥 Controla o rate limit globalmente
async function jikanRequest(endpoint, params = {}) {
    return new Promise((resolve, reject) => {
        jikanQueue.push({ endpoint, params, resolve, reject });
        processJikanQueue();
    });
}

async function processJikanQueue() {
    if (jikanProcessing || jikanQueue.length === 0) return;
    jikanProcessing = true;

    while (jikanQueue.length > 0) {
        const now = Date.now();

        // Limpa timestamps antigos (>1s e >1min)
        jikanTimestamps = jikanTimestamps.filter(t => now - t < 1000);
        jikanMinuteTimestamps = jikanMinuteTimestamps.filter(t => now - t < 60000);

        // 🔥 Verifica limites
        if (jikanTimestamps.length >= JIKAN_RPS) {
            const wait = 1000 - (now - jikanTimestamps[0]) + 50;
            await sleep(wait);
            continue;
        }
        if (jikanMinuteTimestamps.length >= JIKAN_RPM) {
            const wait = 60000 - (now - jikanMinuteTimestamps[0]) + 100;
            await sleep(wait);
            continue;
        }

        // 🔥 Processa próxima requisição
        const item = jikanQueue.shift();
        jikanTimestamps.push(Date.now());
        jikanMinuteTimestamps.push(Date.now());

        try {
            const url = `${JIKAN_BASE}${item.endpoint}`;
            const response = await axios.get(url, {
                params: item.params,
                timeout: 15000,
                headers: { 'User-Agent': 'Hinata-Bot-AnimeQuiz/1.0' }
            });
            item.resolve(response.data);
        } catch (error) {
            // 🔥 Trata 429 (Too Many Requests)
            if (error.response && error.response.status === 429) {
                const retryAfter = parseInt(error.response.headers['retry-after'] || '5');
                console.log(`⏳ Jikan rate limit atingido. Aguardando ${retryAfter}s...`);
                jikanQueue.unshift(item); // devolve pra fila
                await sleep(retryAfter * 1000);
            } else {
                item.reject(error);
            }
        }

        // 🔥 Delay mínimo entre requisições (300ms = ~3/s)
        await sleep(350);
    }

    jikanProcessing = false;
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// ══════════════════════════════════════════════════════════════
// 🔥 BUSCA ANIMES VIA JIKAN
// ══════════════════════════════════════════════════════════════

// Cache local de animes para reduzir requisições
const jikanCache = {
    popularAnime: [],      // lista de animes populares
    lastFetch: 0,
    CACHE_TTL: 1000 * 60 * 60 // 1 hora
};

// 🔥 Busca lista de animes populares (usado como "banco" de perguntas)
async function fetchPopularAnime(limit = 50) {
    // 🔥 Usa cache se válido
    if (jikanCache.popularAnime.length > 0 && Date.now() - jikanCache.lastFetch < jikanCache.CACHE_TTL) {
        return jikanCache.popularAnime;
    }

    try {
        // 🔥 Busca top animes (endpoint: /top/anime)
        const data = await jikanRequest('/top/anime', { limit, filter: 'bypopularity' });

        if (data && data.data && data.data.length > 0) {
            jikanCache.popularAnime = data.data.map(a => ({
                mal_id: a.mal_id,
                title: a.title,
                title_english: a.title_english || a.title,
                title_japanese: a.title_japanese || '',
                image: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || null,
                synopsis: a.synopsis || '',
                episodes: a.episodes,
                score: a.score,
                year: a.year,
                genres: (a.genres || []).map(g => g.name)
            }));
            jikanCache.lastFetch = Date.now();
            console.log(`✅ Jikan: carregados ${jikanCache.popularAnime.length} animes populares`);
            return jikanCache.popularAnime;
        }
    } catch (error) {
        console.error('❌ Jikan fetchPopularAnime:', error.message);
    }

    return [];
}

// 🔥 Busca personagens de um anime específico
async function fetchAnimeCharacters(malId) {
    try {
        const data = await jikanRequest(`/anime/${malId}/characters`);
        if (data && data.data) {
            return data.data.map(c => ({
                mal_id: c.character.mal_id,
                name: c.character.name,
                image: c.character.images?.jpg?.image_url || null,
                role: c.role,
                favorites: c.favorites
            }));
        }
    } catch (error) {
        console.error('❌ Jikan fetchAnimeCharacters:', error.message);
    }
    return [];
}

// 🔥 Busca detalhes de um anime (fallback se /characters falhar)
async function fetchAnimeById(malId) {
    try {
        const data = await jikanRequest(`/anime/${malId}`);
        if (data && data.data) {
            return {
                mal_id: data.data.mal_id,
                title: data.data.title,
                title_english: data.data.title_english,
                image: data.data.images?.jpg?.large_image_url,
                synopsis: data.data.synopsis,
                genres: (data.data.genres || []).map(g => g.name)
            };
        }
    } catch (error) {
        console.error('❌ Jikan fetchAnimeById:', error.message);
    }
    return null;
}

// ══════════════════════════════════════════════════════════════
// 🔥 BUSCA PERSONAGEM ALEATÓRIO VIA JIKAN
// ══════════════════════════════════════════════════════════════

async function fetchCharacterFromJikan() {
    try {
        // 🔥 1. Pega lista de animes populares
        const animeList = await fetchPopularAnime(50);
        if (animeList.length === 0) throw new Error('Sem animes no cache');

        // 🔥 2. Escolhe anime aleatório
        const randomAnime = animeList[Math.floor(Math.random() * animeList.length)];

        // 🔥 3. Busca personagens desse anime
        let characters = await fetchAnimeCharacters(randomAnime.mal_id);

        // 🔥 Se não achou personagens, tenta outro anime (máx 3 tentativas)
        let attempts = 0;
        while (characters.length === 0 && attempts < 3) {
            const another = animeList[Math.floor(Math.random() * animeList.length)];
            characters = await fetchAnimeCharacters(another.mal_id);
            attempts++;
        }

        if (characters.length === 0) throw new Error('Sem personagens disponíveis');

        // 🔥 4. Prefere personagens principais (role: Main)
        const mainChars = characters.filter(c => c.role === 'Main');
        const pool = mainChars.length > 0 ? mainChars : characters;
        const randomChar = pool[Math.floor(Math.random() * pool.length)];

        // 🔥 5. Baixa imagem do personagem
        let imageBuffer = null;
        if (randomChar.image) {
            try {
                const imgRes = await axios.get(randomChar.image, {
                    responseType: 'arraybuffer',
                    timeout: 10000
                });
                imageBuffer = Buffer.from(imgRes.data);
            } catch (e) {
                console.log('⚠️ Não foi possível baixar imagem do Jikan');
            }
        }

        return {
            name: randomChar.name,
            anime: randomAnime.title_english || randomAnime.title,
            imageBuffer: imageBuffer,
            source: 'Jikan'
        };

    } catch (error) {
        console.error('❌ Jikan fetchCharacter:', error.message);
        return null;
    }
}

// ══════════════════════════════════════════════════════════════
// 🔥 FALLBACK LOCAL (caso Jikan falhe)
// ══════════════════════════════════════════════════════════════

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

const LOCAL_CHARACTERS = [
    { name: 'Naruto Uzumaki', anime: 'Naruto' },
    { name: 'Sasuke Uchiha', anime: 'Naruto' },
    { name: 'Monkey D. Luffy', anime: 'One Piece' },
    { name: 'Roronoa Zoro', anime: 'One Piece' },
    { name: 'Goku', anime: 'Dragon Ball Z' }
];

function fetchLocalCharacter() {
    const char = LOCAL_CHARACTERS[Math.floor(Math.random() * LOCAL_CHARACTERS.length)];
    const imagePath = findImageFile(char.name);
    let imageBuffer = null;
    if (imagePath) {
        try { imageBuffer = fs.readFileSync(imagePath); } catch (e) {}
    }
    return { name: char.name, anime: char.anime, imageBuffer, source: 'Local' };
}

// ══════════════════════════════════════════════════════════════
// 🔥 NORMALIZAÇÃO E VERIFICAÇÃO
// ══════════════════════════════════════════════════════════════

function normalizeName(name) {
    if (!name) return '';
    return name.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .toLowerCase()
        .trim();
}

function checkAnswer(userAnswer, correctAnswer) {
    const ua = normalizeName(userAnswer);
    const ca = normalizeName(correctAnswer);
    if (!ua || !ca) return false;
    const uaNoSpace = ua.replace(/\s+/g, '');
    const caNoSpace = ca.replace(/\s+/g, '');
    return ua === ca || uaNoSpace === caNoSpace
        || ua.includes(ca) || ca.includes(ua)
        || uaNoSpace.includes(caNoSpace) || caNoSpace.includes(uaNoSpace);
}

// ══════════════════════════════════════════════════════════════
// 🔥 COMANDO PRINCIPAL
// ══════════════════════════════════════════════════════════════

module.exports = {
    config: {
        name: "animequiz",
        aliases: ["aq", "quizanime"],
        version: "8.0",
        author: "Hinata",
        countDown: 10,
        role: 0,
        description: { pt: "Quiz de anime com Jikan API!" },
        category: "game",
        guide: {
            pt: "   {pn}: Inicia quiz\n   {pn} ranking: Ranking do grupo\n   {pn} top: Top 10 global"
        }
    },

    onStart: async function ({ api, event, args, usersData }) {
        const { threadID, messageID } = event;
        const action = (args[0] || '').toLowerCase();

        if (action === 'ranking' || action === 'rank') return await showGroupRanking(api, event, usersData);
        if (action === 'top') return await showGlobalTop(api, event, usersData);

        const quiz = quizState[threadID];
        if (quiz && quiz.active) {
            return api.sendMessage('⏳ | Um quiz já está em andamento!', threadID, messageID);
        }

        await startQuiz(api, event, usersData);
    },

    onReply: async function ({ api, event, Reply, usersData }) {
        const { threadID, senderID, body } = event;
        const quiz = quizState[threadID];
        if (!quiz || !quiz.active) return;
        if (Reply && Reply.messageID && quiz.messageID && Reply.messageID !== quiz.messageID) return;
        if (!body || body.trim().length < 2) return;

        await handleAnswer({ api, event, usersData, quiz, senderID, body, threadID });
    },

    onChat: async function ({ api, event, usersData }) {
        const { threadID, senderID, body, messageReply } = event;
        const quiz = quizState[threadID];
        if (!quiz || !quiz.active) return;
        if (messageReply && messageReply.messageID === quiz.messageID) return;

        const prefix = global.GoatBot.config.prefix;
        if (body && body.startsWith(prefix)) return;
        if (!body || body.trim().length < 2) return;
        if (['ranking', 'rank', 'top'].includes(body.trim().toLowerCase())) return;

        await handleAnswer({ api, event, usersData, quiz, senderID, body, threadID });
    }
};

// ══════════════════════════════════════════════════════════════
// 🔥 PROCESSAR RESPOSTA
// ══════════════════════════════════════════════════════════════

async function handleAnswer({ api, event, usersData, quiz, senderID, body, threadID }) {
    if (quiz.answers.some(a => a.senderID === senderID)) {
        return api.sendMessage('⏳ | Você já respondeu!', threadID);
    }

    if (!checkAnswer(body, quiz.characterName)) return;

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

    api.sendMessage(
        `✅ ${medal} ${name} acertou!\n🎯 ${position}º | +${points} pts\n📊 Total: ${newPoints}/${WINNER_POINTS}\n\n📝 Resposta: ${quiz.characterName}`,
        threadID
    );

    if (newPoints >= WINNER_POINTS) return await endGame(api, threadID, usersData);
    if (quiz.answers.length >= 3) await endRound(api, threadID, usersData);
}

// ══════════════════════════════════════════════════════════════
// 🔥 INICIAR RODADA (COM JIKAN)
// ══════════════════════════════════════════════════════════════

async function startQuiz(api, event, usersData) {
    const { threadID, messageID } = event;
    const oldQuiz = quizState[threadID];
    if (oldQuiz && oldQuiz.timeout) clearTimeout(oldQuiz.timeout);

    try {
        // 🔥 Tenta Jikan primeiro, fallback local
        let character = await fetchCharacterFromJikan();
        let source = '🌐 Jikan API';

        if (!character) {
            console.log('⚠️ Jikan falhou, usando fallback local');
            character = fetchLocalCharacter();
            source = '📁 Local';
        }

        const question = `📺 QUIZ DE ANIME [${source}]\n\n` +
            `🔍 Quem é esse personagem?\n` +
            `📖 Anime: ${character.anime}\n\n` +
            `⏳ Você tem ${ROUND_TIME / 1000}s!\n` +
            `💡 Responda esta mensagem!\n\n` +
            `🏆 Meta: ${WINNER_POINTS.toLocaleString()} pontos!`;

        let sentMessage;
        if (character.imageBuffer) {
            sentMessage = await api.sendMessage({
                body: question,
                attachment: character.imageBuffer
            }, threadID, messageID);
        } else {
            sentMessage = await api.sendMessage(question, threadID, messageID);
        }

        global.GoatBot.onReply.set(sentMessage.messageID, {
            commandName: "animequiz",
            messageID: sentMessage.messageID,
            threadID,
            author: event.senderID || null
        });

        const quiz = {
            active: true,
            character,
            characterName: character.name,
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
        console.error('❌ Erro quiz:', error);
        api.sendMessage(`❌ | Erro: ${error.message}`, threadID, messageID);
    }
}

// ══════════════════════════════════════════════════════════════
// 🔥 FINALIZAR RODADA
// ══════════════════════════════════════════════════════════════

async function endRound(api, threadID, usersData) {
    const quiz = quizState[threadID];
    if (!quiz || !quiz.active) return;

    quiz.active = false;
    if (quiz.timeout) { clearTimeout(quiz.timeout); quiz.timeout = null; }

    const winners = quiz.answers.slice(0, 3);
    const charName = quiz.characterName;

    if (winners.length === 0) {
        api.sendMessage(`⏰ Tempo esgotado!\n📝 Resposta: ${charName}\n\n🔄 Nova rodada em 3s...`, threadID);
    } else {
        let msg = `🏁 Rodada finalizada!\n📝 ${charName}\n\n📊 Resultados:\n`;
        for (let i = 0; i < winners.length; i++) {
            const a = winners[i];
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
            const uData = await usersData.get(a.senderID);
            msg += `${medal} ${uData?.name || `User_${a.senderID}`}: +${a.points} pts\n`;
        }
        api.sendMessage(msg, threadID);
    }

    for (const a of quiz.answers) {
        const uData = await usersData.get(a.senderID);
        if ((uData?.data?.quizPoints || 0) >= WINNER_POINTS) {
            return await endGame(api, threadID, usersData);
        }
    }

    delete quizState[threadID];
    setTimeout(async () => {
        if (quizState[threadID] && quizState[threadID].active) return;
        await startQuiz(api, { threadID, messageID: quiz.messageID, senderID: quiz.senderID }, usersData);
    }, 3000);
}

// ══════════════════════════════════════════════════════════════
// 🔥 FINALIZAR JOGO
// ══════════════════════════════════════════════════════════════

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
        .map(u => ({ userID: u.userID, name: u.name || `User_${u.userID}`, points: u.data?.quizPoints || 0 }))
        .sort((a, b) => b.points - a.points);

    const top3 = players.slice(0, 3);
    let msg = `🏆 FIM DE JOGO! 🏆\n\n📊 TOP 3:\n`;

    for (let i = 0; i < top3.length; i++) {
        const p = top3[i];
        const prize = FINAL_PRIZES[i + 1] || 0;
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
        const uData = await usersData.get(p.userID);
        await usersData.set(p.userID, { money: (uData?.money || 0) + prize, "data.quizPoints": 0 });
        msg += `${medal} ${p.name}: +${prize.toLocaleString()}$\n`;
    }

    for (const p of players.slice(3)) {
        await usersData.set(p.userID, { "data.quizPoints": 0 });
    }

    api.sendMessage(msg, threadID);
}

// ══════════════════════════════════════════════════════════════
// 🔥 RANKINGS
// ══════════════════════════════════════════════════════════════

async function showGroupRanking(api, event, usersData) {
    const { threadID, messageID } = event;
    const allUsers = await usersData.getAll();
    const players = allUsers
        .filter(u => (u.data?.quizPoints || 0) > 0)
        .map(u => ({ name: u.name || `User_${u.userID}`, points: u.data?.quizPoints || 0, wins: u.data?.quizWins || 0 }))
        .sort((a, b) => b.points - a.points).slice(0, 10);

    if (players.length === 0) return api.sendMessage('📊 Ninguém jogou ainda!', threadID, messageID);

    let msg = `🏆 RANKING DO QUIZ\n\n`;
    players.forEach((p, i) => {
        const m = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`;
        msg += `${m} ${p.name} — ${p.points}pts | ${p.wins} acertos\n`;
    });
    api.sendMessage(msg, threadID, messageID);
}

async function showGlobalTop(api, event, usersData) {
    const { threadID, messageID } = event;
    const allUsers = await usersData.getAll();
    const players = allUsers
        .filter(u => (u.data?.quizPoints || 0) > 0)
        .map(u => ({ name: u.name || `User_${u.userID}`, points: u.data?.quizPoints || 0, wins: u.data?.quizWins || 0 }))
        .sort((a, b) => b.points - a.points).slice(0, 10);

    if (players.length === 0) return api.sendMessage('📊 Ninguém jogou ainda!', threadID, messageID);

    let msg = `🌍 TOP GLOBAL\n\n`;
    players.forEach((p, i) => {
        const m = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`;
        msg += `${m} ${p.name} — ${p.points}pts | ${p.wins} acertos\n`;
    });
    api.sendMessage(msg, threadID, messageID);
}

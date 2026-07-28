const fs = require('fs-extra');
const path = require('path');

// 🔥 CAMINHO DO ARQUIVO DE DADOS
const DATA_PATH = path.join(__dirname, 'cache', 'blacklist.json');

// 🔥 GARANTE QUE O ARQUIVO EXISTE
function ensureFile() {
    fs.ensureDirSync(path.dirname(DATA_PATH));
    if (!fs.existsSync(DATA_PATH)) {
        fs.writeJSONSync(DATA_PATH, { users: [], threads: [] });
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

// 🔥 ADICIONA À BLACKLIST
function addToBlacklist(type, id, reason = 'Sem motivo') {
    const data = loadData();
    const list = type === 'user' ? data.users : data.threads;
    
    // 🔥 VERIFICA SE JÁ ESTÁ NA LISTA
    if (list.some(item => item.id === id)) {
        return { success: false, message: '⚠️ Já está na blacklist!' };
    }
    
    list.push({
        id: id,
        reason: reason,
        date: new Date().toLocaleString(),
        type: type
    });
    
    saveData(data);
    return { success: true, message: `✅ ${type === 'user' ? 'Usuário' : 'Grupo'} adicionado à blacklist!` };
}

// 🔥 REMOVE DA BLACKLIST
function removeFromBlacklist(type, id) {
    const data = loadData();
    const list = type === 'user' ? data.users : data.threads;
    const index = list.findIndex(item => item.id === id);
    
    if (index === -1) {
        return { success: false, message: '❌ Não está na blacklist!' };
    }
    
    list.splice(index, 1);
    saveData(data);
    return { success: true, message: `✅ ${type === 'user' ? 'Usuário' : 'Grupo'} removido da blacklist!` };
}

// 🔥 VERIFICA SE ESTÁ NA BLACKLIST
function isBlacklisted(type, id) {
    const data = loadData();
    const list = type === 'user' ? data.users : data.threads;
    return list.find(item => item.id === id) || null;
}

// 🔥 LISTA TODOS OS BANIDOS
function listBlacklist() {
    const data = loadData();
    return data;
}

module.exports = {
    config: {
        name: "blacklist",
        aliases: ["bl", "banlist", "blocklist"],
        version: "1.0",
        author: "Hinata",
        countDown: 5,
        role: 2, // 🔥 APENAS ADMINS DO BOT
        description: {
            pt: "Gerencia a blacklist de usuários e grupos"
        },
        category: "admin",
        guide: {
            pt: "   {pn} add [user|thread] <id> <motivo> - Adiciona à blacklist\n" +
                 "   {pn} remove [user|thread] <id> - Remove da blacklist\n" +
                 "   {pn} list - Lista todos os banidos\n" +
                 "   {pn} check [user|thread] <id> - Verifica se está banido"
        }
    },

    onStart: async function ({ api, event, args }) {
        const { threadID, messageID } = event;
        const action = args[0]?.toLowerCase();

        // 🔥 SE NÃO TIVER AÇÃO
        if (!action) {
            return api.sendMessage(
                `📋 **COMANDO BLACKLIST**\n\n` +
                `🔹 ${api.getPrefix()}blacklist add user <id> <motivo> - Banir usuário\n` +
                `🔹 ${api.getPrefix()}blacklist add thread <id> <motivo> - Banir grupo\n` +
                `🔹 ${api.getPrefix()}blacklist remove user <id> - Desbanir usuário\n` +
                `🔹 ${api.getPrefix()}blacklist remove thread <id> - Desbanir grupo\n` +
                `🔹 ${api.getPrefix()}blacklist list - Listar banidos\n` +
                `🔹 ${api.getPrefix()}blacklist check user <id> - Verificar usuário\n` +
                `🔹 ${api.getPrefix()}blacklist check thread <id> - Verificar grupo\n\n` +
                `⚠️ Apenas administradores do bot podem usar.`,
                threadID,
                messageID
            );
        }

        // 🔥 COMANDO: ADD
        if (action === 'add') {
            const type = args[1]?.toLowerCase();
            const id = args[2];
            const reason = args.slice(3).join(' ') || 'Sem motivo';

            if (!type || !['user', 'thread'].includes(type)) {
                return api.sendMessage('❌ | Use: blacklist add [user|thread] <id> <motivo>', threadID, messageID);
            }

            if (!id || isNaN(id)) {
                return api.sendMessage('❌ | ID inválido!', threadID, messageID);
            }

            const result = addToBlacklist(type, id, reason);
            if (result.success) {
                api.sendMessage(
                    `${result.message}\n\n` +
                    `📌 ID: ${id}\n` +
                    `📝 Motivo: ${reason}\n` +
                    `🕒 Data: ${new Date().toLocaleString()}`,
                    threadID,
                    messageID
                );
            } else {
                api.sendMessage(result.message, threadID, messageID);
            }
            return;
        }

        // 🔥 COMANDO: REMOVE
        if (action === 'remove' || action === 'rm') {
            const type = args[1]?.toLowerCase();
            const id = args[2];

            if (!type || !['user', 'thread'].includes(type)) {
                return api.sendMessage('❌ | Use: blacklist remove [user|thread] <id>', threadID, messageID);
            }

            if (!id || isNaN(id)) {
                return api.sendMessage('❌ | ID inválido!', threadID, messageID);
            }

            const result = removeFromBlacklist(type, id);
            api.sendMessage(result.message, threadID, messageID);
            return;
        }

        // 🔥 COMANDO: LIST
        if (action === 'list' || action === 'all') {
            const data = listBlacklist();
            
            if (data.users.length === 0 && data.threads.length === 0) {
                return api.sendMessage('📭 | A blacklist está vazia!', threadID, messageID);
            }

            let msg = '📋 **BLACKLIST**\n\n';

            if (data.users.length > 0) {
                msg += `👤 **Usuários (${data.users.length}):**\n`;
                data.users.forEach((item, i) => {
                    msg += `${i + 1}. ID: ${item.id}\n`;
                    msg += `   📝 Motivo: ${item.reason}\n`;
                    msg += `   🕒 Data: ${item.date}\n\n`;
                });
            }

            if (data.threads.length > 0) {
                msg += `💬 **Grupos (${data.threads.length}):**\n`;
                data.threads.forEach((item, i) => {
                    msg += `${i + 1}. ID: ${item.id}\n`;
                    msg += `   📝 Motivo: ${item.reason}\n`;
                    msg += `   🕒 Data: ${item.date}\n\n`;
                });
            }

            api.sendMessage(msg, threadID, messageID);
            return;
        }

        // 🔥 COMANDO: CHECK
        if (action === 'check' || action === 'verify') {
            const type = args[1]?.toLowerCase();
            const id = args[2];

            if (!type || !['user', 'thread'].includes(type)) {
                return api.sendMessage('❌ | Use: blacklist check [user|thread] <id>', threadID, messageID);
            }

            if (!id || isNaN(id)) {
                return api.sendMessage('❌ | ID inválido!', threadID, messageID);
            }

            const result = isBlacklisted(type, id);
            if (result) {
                api.sendMessage(
                    `⚠️ **${type === 'user' ? 'Usuário' : 'Grupo'} ESTÁ NA BLACKLIST!**\n\n` +
                    `📌 ID: ${id}\n` +
                    `📝 Motivo: ${result.reason}\n` +
                    `🕒 Data: ${result.date}`,
                    threadID,
                    messageID
                );
            } else {
                api.sendMessage(
                    `✅ **${type === 'user' ? 'Usuário' : 'Grupo'} NÃO ESTÁ NA BLACKLIST!**\n\n` +
                    `📌 ID: ${id}`,
                    threadID,
                    messageID
                );
            }
            return;
        }

        // 🔥 COMANDO INVÁLIDO
        api.sendMessage(`❌ | Ação inválida! Use: add, remove, list, check`, threadID, messageID);
    }
};

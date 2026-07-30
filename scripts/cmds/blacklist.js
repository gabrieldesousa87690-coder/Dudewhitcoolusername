const fs = require('fs-extra');
const path = require('path');

// 🔥 CAMINHO DO ARQUIVO DE DADOS (AGORA EM TMP/)
const DATA_PATH = path.join(__dirname, 'tmp', 'blacklist.json');

// 🔥 GARANTE QUE A PASTA TMP EXISTE
fs.ensureDirSync(path.dirname(DATA_PATH));

// 🔥 GARANTE QUE O ARQUIVO EXISTE
function ensureFile() {
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
    // 🔥 ATUALIZA O GLOBAL
    if (global.blacklist) {
        global.blacklist.data = data;
    }
}

// 🔥 ADICIONA À BLACKLIST
function addToBlacklist(type, id, reason = 'Sem motivo') {
    const data = loadData();
    const list = type === 'user' ? data.users : data.threads;
    
    if (list.some(item => item.id === id)) {
        return { success: false, message: '⚠️ Já está na blacklist!' };
    }
    
    list.push({
        id: id,
        reason: reason,
        date: new Date().toLocaleString()
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

// 🔥 LISTA TODOS OS BANIDOS
function listBlacklist() {
    return loadData();
}

// 🔥 VERIFICA SE ESTÁ NA BLACKLIST
function isBlacklisted(type, id) {
    const data = loadData();
    const list = type === 'user' ? data.users : data.threads;
    return list.find(item => item.id === id) || null;
}

// 🔥 COMANDO PRINCIPAL
module.exports = {
    config: {
        name: "blacklist",
        aliases: ["bl", "banlist", "blocklist"],
        version: "2.0",
        author: "Hinata",
        countDown: 5,
        role: 2,
        description: {
            pt: "Gerencia a blacklist de usuários e grupos (salva em tmp/)"
        },
        category: "admin",
        guide: {
            pt: "   {pn} add [user|thread] <id> <motivo> - Adiciona à blacklist\n" +
                 "   {pn} remove [user|thread] <id> - Remove da blacklist\n" +
                 "   {pn} list - Lista todos os banidos\n" +
                 "   {pn} backup - Envia o JSON da blacklist (sem texto)\n" +
                 "   {pn} check [user|thread] <id> - Verifica se está banido"
        }
    },

    onStart: async function ({ api, event, args }) {
        const { threadID, messageID } = event;
        const action = args[0]?.toLowerCase();

        // 🔥 COMANDO: BACKUP (ENVIA O JSON PURO)
        if (action === 'backup') {
            try {
                const data = loadData();
                const jsonText = JSON.stringify(data, null, 2);
                
                // 🔥 ENVIA APENAS O JSON, SEM TEXTO ADICIONAL
                return api.sendMessage(jsonText, threadID, messageID);
                
            } catch (error) {
                return api.sendMessage(`❌ | Erro ao gerar backup: ${error.message}`, threadID, messageID);
            }
        }

        // 🔥 SE NÃO TIVER AÇÃO
        if (!action) {
            return api.sendMessage(
                `📋 **COMANDO BLACKLIST**\n\n` +
                `🔹 blacklist add user <id> <motivo> - Banir usuário\n` +
                `🔹 blacklist add thread <id> <motivo> - Banir grupo\n` +
                `🔹 blacklist remove user <id> - Desbanir usuário\n` +
                `🔹 blacklist remove thread <id> - Desbanir grupo\n` +
                `🔹 blacklist list - Listar banidos\n` +
                `🔹 blacklist backup - Envia o JSON puro\n` +
                `🔹 blacklist check user <id> - Verificar usuário\n` +
                `🔹 blacklist check thread <id> - Verificar grupo`,
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
            return api.sendMessage(result.message, threadID, messageID);
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
            return api.sendMessage(result.message, threadID, messageID);
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

            return api.sendMessage(msg, threadID, messageID);
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
                return api.sendMessage(
                    `⚠️ **${type === 'user' ? 'Usuário' : 'Grupo'} ESTÁ NA BLACKLIST!**\n\n` +
                    `📌 ID: ${id}\n` +
                    `📝 Motivo: ${result.reason}\n` +
                    `🕒 Data: ${result.date}`,
                    threadID,
                    messageID
                );
            } else {
                return api.sendMessage(
                    `✅ **${type === 'user' ? 'Usuário' : 'Grupo'} NÃO ESTÁ NA BLACKLIST!**\n\n` +
                    `📌 ID: ${id}`,
                    threadID,
                    messageID
                );
            }
        }

        return api.sendMessage(`❌ | Ação inválida! Use: add, remove, list, check, backup`, threadID, messageID);
    }
};

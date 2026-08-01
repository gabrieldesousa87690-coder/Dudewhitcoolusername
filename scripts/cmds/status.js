const os = require('os');
const moment = require('moment-timezone');

module.exports = {
    config: {
        name: "status",
        aliases: ["groups", "lista", "grupos"],
        version: "1.1",
        author: "Tsuki",
        countDown: 10,
        role: 0,
        description: {
            pt: "Lista todos os grupos que o bot está presente"
        },
        category: "info",
        guide: {
            pt: "   {pn} - Lista todos os grupos\n" +
                 "   {pn} <número> - Mostra uma página específica"
        }
    },

    onStart: async function ({ api, event, args }) {
        const { threadID, messageID } = event;
        const page = parseInt(args[0]) || 1;
        const itemsPerPage = 10;

        // 🔥 INFORMAÇÕES DO SISTEMA
        const totalRAM = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const freeRAM = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
        const usedRAM = (totalRAM - freeRAM).toFixed(2);
        const ramPercent = ((usedRAM / totalRAM) * 100).toFixed(1);
        const uptime = os.uptime();
        const uptimeFormatted = formatUptime(uptime);
        const cpuCores = os.cpus().length;
        const hostname = os.hostname();

        // 🔥 BUSCA A LISTA DE GRUPOS
        api.getThreadList(500, null, ["INBOX"], async (err, list) => {
            if (err) {
                console.error('Erro ao buscar grupos:', err);
                return api.sendMessage(
                    '❌ | Erro ao buscar a lista de grupos. Tente novamente.',
                    threadID,
                    messageID
                );
            }

            // 🔥 FILTRA APENAS GRUPOS
            const groups = list.filter(t => t.isGroup === true);
            
            if (groups.length === 0) {
                return api.sendMessage(
                    '📭 | O bot não está presente em nenhum grupo.',
                    threadID,
                    messageID
                );
            }

            // 🔥 ORDENA POR NOME (A-Z)
            groups.sort((a, b) => (a.name || 'Sem nome').localeCompare(b.name || 'Sem nome'));

            // 🔥 CALCULA PÁGINAS
            const totalPages = Math.ceil(groups.length / itemsPerPage);
            
            if (page < 1 || page > totalPages) {
                return api.sendMessage(
                    `❌ | Página inválida! Use um número entre 1 e ${totalPages}.`,
                    threadID,
                    messageID
                );
            }

            // 🔥 PEGA OS ITENS DA PÁGINA ATUAL
            const startIndex = (page - 1) * itemsPerPage;
            const endIndex = Math.min(startIndex + itemsPerPage, groups.length);
            const pageGroups = groups.slice(startIndex, endIndex);

            // 🔥 CONTA ESTATÍSTICAS DOS GRUPOS
            let totalMembers = 0;
            let totalAdmins = 0;
            let botGroups = 0;
            
            for (const group of groups) {
                try {
                    const info = await api.getThreadInfo(group.threadID);
                    totalMembers += info.participantIDs?.length || 0;
                    totalAdmins += info.adminIDs?.length || 0;
                    botGroups++;
                } catch (e) {
                    // IGNORA ERRO E CONTINUA
                }
            }

            // 🔥 MONTA A MENSAGEM
            let msg = `📊 **STATUS DO BOT**\n\n`;
            msg += `🖥️ **Sistema:**\n`;
            msg += `   💾 RAM: ${usedRAM}GB / ${totalRAM}GB (${ramPercent}%)\n`;
            msg += `   🧠 CPU: ${cpuCores} núcleos\n`;
            msg += `   ⏱️ Uptime: ${uptimeFormatted}\n`;
            msg += `   🏷️ Host: ${hostname}\n\n`;
            
            msg += `👥 **Grupos:**\n`;
            msg += `   📦 Total: ${groups.length}\n`;
            msg += `   👤 Membros: ~${totalMembers}\n`;
            msg += `   🛡️ Admins: ~${totalAdmins}\n`;
            msg += `   📄 Página ${page}/${totalPages}\n\n`;
            
            msg += `╔══════════════════════════════════╗\n`;

            pageGroups.forEach((group, index) => {
                const num = startIndex + index + 1;
                const name = group.name || 'Sem nome';
                const id = group.threadID;
                const members = group.participants?.length || '?';
                
                msg += `║ ${num.toString().padStart(2, '0')}. ${name}\n`;
                msg += `║    🆔 ${id}\n`;
                msg += `║    👥 ${members} membros\n`;
                msg += `╠══════════════════════════════════╣\n`;
            });

            msg += `╚══════════════════════════════════╝\n\n`;
            msg += `💡 Use: ${api.getPrefix()}status <número> para ver outras páginas.`;

            // 🔥 SE FOR MUITO GRANDE, DIVIDE
            if (msg.length > 2000) {
                const parts = [];
                let currentPart = '';
                const lines = msg.split('\n');
                
                for (const line of lines) {
                    if (currentPart.length + line.length > 1900) {
                        parts.push(currentPart);
                        currentPart = '';
                    }
                    currentPart += line + '\n';
                }
                if (currentPart) parts.push(currentPart);

                for (let i = 0; i < parts.length; i++) {
                    await api.sendMessage(parts[i], threadID);
                }
            } else {
                await api.sendMessage(msg, threadID, messageID);
            }
        });
    }
};

// 🔥 FUNÇÃO PARA FORMATAR UPTIME
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}m `;
    if (secs > 0 || result === '') result += `${secs}s`;
    
    return result.trim();
}

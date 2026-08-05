const fs = require('fs-extra');
const path = require('path');

module.exports = {
    config: {
        name: "broadcast",
        aliases: ["bc", "anunciar", "anuncio"],
        version: "2.0",
        author: "Tsuki",
        countDown: 10,
        role: 2,
        description: {
            pt: "Envia uma mensagem para todos os grupos (com confirmação)"
        },
        category: "admin",
        guide: {
            pt: "   {pn} <mensagem> - Envia a mensagem\n" +
                 "   {pn} confirm - Confirma o envio\n" +
                 "   {pn} cancel - Cancela o envio\n" +
                 "   {pn} status - Verifica o status do broadcast"
        }
    },

    onStart: async function ({ api, event, args }) {
        const { senderID, threadID, messageID } = event;
        const action = args[0]?.toLowerCase();

        // 🔥 CANCELAR
        if (action === 'cancel') {
            if (!global.broadcastPending) {
                return api.sendMessage('❌ | Nenhum broadcast pendente!', threadID, messageID);
            }
            global.broadcastPending = null;
            return api.sendMessage('✅ | Broadcast cancelado!', threadID, messageID);
        }

        // 🔥 STATUS
        if (action === 'status') {
            if (global.broadcastPending) {
                const { mensagem, totalGrupos, enviados, erros } = global.broadcastPending;
                return api.sendMessage(
                    `📊 **STATUS DO BROADCAST**\n\n` +
                    `📝 Mensagem: ${mensagem}\n` +
                    `📦 Total de grupos: ${totalGrupos}\n` +
                    `✅ Enviados: ${enviados || 0}\n` +
                    `❌ Falhas: ${erros || 0}\n` +
                    `📌 Status: ${global.broadcastPending.running ? '🔄 Em andamento...' : '⏸️ Pendente'}`,
                    threadID,
                    messageID
                );
            }
            return api.sendMessage('📭 | Nenhum broadcast pendente ou em andamento.', threadID, messageID);
        }

        // 🔥 CONFIRMAR
        if (action === 'confirm') {
            if (!global.broadcastPending) {
                return api.sendMessage('❌ | Nenhum broadcast pendente!', threadID, messageID);
            }

            if (global.broadcastPending.running) {
                return api.sendMessage('⏳ | O broadcast já está em andamento!', threadID, messageID);
            }

            const { mensagem, senderID: authorID } = global.broadcastPending;

            if (senderID !== authorID) {
                return api.sendMessage('🔒 | Apenas quem solicitou pode confirmar!', threadID, messageID);
            }

            global.broadcastPending.running = true;
            global.broadcastPending.enviados = 0;
            global.broadcastPending.erros = 0;

            await api.sendMessage('📢 | Iniciando broadcast... Aguarde.', threadID, messageID);

            return await executeBroadcast(api, threadID);
        }

        // 🔥 NOVO BROADCAST
        const msg = args.join(' ');
        if (!msg) {
            return api.sendMessage(
                `📢 **COMANDO BROADCAST**\n\n` +
                `🔹 ${api.getPrefix()}broadcast <mensagem> - Prepara um broadcast\n` +
                `🔹 ${api.getPrefix()}broadcast confirm - Confirma o envio\n` +
                `🔹 ${api.getPrefix()}broadcast cancel - Cancela o envio\n` +
                `🔹 ${api.getPrefix()}broadcast status - Verifica o status\n\n` +
                `⚠️ A mensagem será enviada para TODOS os grupos que o bot está presente.`,
                threadID,
                messageID
            );
        }

        // 🔥 BUSCA OS GRUPOS
        const loadingMsg = await api.sendMessage('⏳ | Buscando grupos...', threadID, messageID);

        api.getThreadList(500, null, ["INBOX"], async (err, list) => {
            if (err) {
                console.error('Erro ao buscar grupos:', err);
                return api.editMessage('❌ | Erro ao buscar grupos.', loadingMsg.messageID);
            }

            const groups = list.filter(t => t.isGroup === true && t.threadID);

            if (groups.length === 0) {
                return api.editMessage('📭 | O bot não está presente em nenhum grupo.', loadingMsg.messageID);
            }

            // 🔥 SALVA O PENDING
            global.broadcastPending = {
                mensagem: msg,
                senderID: senderID,
                totalGrupos: groups.length,
                grupos: groups,
                enviados: 0,
                erros: 0,
                running: false
            };

            return api.editMessage(
                `📢 **BROADCAST PREPARADO!**\n\n` +
                `📝 Mensagem: ${msg}\n` +
                `📊 Grupos: ${groups.length}\n\n` +
                `✅ Para confirmar, digite:\n${api.getPrefix()}broadcast confirm\n` +
                `❌ Para cancelar, digite:\n${api.getPrefix()}broadcast cancel`,
                loadingMsg.messageID
            );
        });
    }
};

// 🔥 FUNÇÃO PARA EXECUTAR O BROADCAST
async function executeBroadcast(api, threadID) {
    const pending = global.broadcastPending;
    if (!pending) return;

    const { mensagem, grupos } = pending;
    const total = grupos.length;

    // 🔥 DESIGN DA MENSAGEM
    const msg = 
`🌸 **Tsuki Bot - Broadcast** 🌸
╔══════════════════════════════════╗
║                                    ║
║  ${mensagem}                        ║
║                                    ║
╚══════════════════════════════════╝
✦ Enviado por: ${await api.getUserInfo(pending.senderID).then(info => info[pending.senderID]?.name || 'Admin')}
✦ Data: ${new Date().toLocaleString()}`;

    let enviados = 0;
    let erros = 0;
    let falhas = [];

    for (let i = 0; i < grupos.length; i++) {
        const group = grupos[i];
        try {
            await api.sendMessage(msg, group.threadID);
            enviados++;
            pending.enviados = enviados;
            
            // 🔥 ATUALIZA STATUS A CADA 10 GRUPOS
            if (i % 10 === 0 && i > 0) {
                await api.sendMessage(
                    `📊 Progresso: ${enviados}/${total} (${Math.round((enviados/total)*100)}%)`,
                    threadID
                );
            }
            
            await new Promise(resolve => setTimeout(resolve, 1500)); // DELAY

        } catch (e) {
            erros++;
            pending.erros = erros;
            falhas.push(group.name || group.threadID);
            console.error(`❌ Falha ao enviar para ${group.threadID}:`, e.message);
        }
    }

    pending.running = false;

    // 🔥 RELATÓRIO FINAL
    const report = 
`✅ **BROADCAST FINALIZADO!**

📤 Enviados: ${enviados}
❌ Falhas: ${erros}
📊 Total: ${total}
📝 Mensagem: ${mensagem}
🕒 Finalizado: ${new Date().toLocaleString()}

${falhas.length > 0 ? `\n⚠️ Grupos com falha:\n${falhas.slice(0, 5).join('\n')}${falhas.length > 5 ? `\n... e mais ${falhas.length - 5}` : ''}` : ''}`;

    await api.sendMessage(report, threadID);

    // 🔥 LIMPA O PENDING
    global.broadcastPending = null;
}

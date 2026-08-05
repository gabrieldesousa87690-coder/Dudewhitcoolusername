const Canvas = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

module.exports = {
    config: {
        name: "startup", // Nome do evento
        version: "1.0",
        author: "Tsuki",
        category: "events" // 🔥 CATEGORIA CORRETA (plural)
    },

    langs: {
        pt: {
            online: "🌸 **Tsuki Bot ESTÁ ONLINE!** 🌸\n\n⏱️ Uptime: %1h %2m\n💾 RAM: %3GB / %4GB\n📅 Data: %5\n\n💡 Use %6help para ver os comandos.\n🌙 Tsuki Bot • Sempre ativo para você!"
        }
    },

    onStart: async function ({ api, getLang, getPrefix }) {
        try {
            console.log('🌸 Evento startup iniciado...');

            // 🔥 GERA O BANNER
            const imagePath = await generateStartupBanner();

            // 🔥 BUSCA TODOS OS GRUPOS
            api.getThreadList(500, null, ["INBOX"], async (err, list) => {
                if (err) {
                    console.error('❌ Erro ao buscar grupos:', err);
                    return;
                }

                const groups = list.filter(t => t.isGroup === true && t.threadID);

                if (groups.length === 0) {
                    console.log('📭 Nenhum grupo encontrado.');
                    return;
                }

                // 🔥 INFORMAÇÕES
                const botInfo = await api.getUserInfo(api.getCurrentUserID());
                const botName = botInfo[api.getCurrentUserID()]?.name || 'Tsuki Bot';
                const prefix = getPrefix ? getPrefix() : '!';

                const uptime = process.uptime();
                const hours = Math.floor(uptime / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                const totalRAM = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
                const usedRAM = ((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024).toFixed(2);
                const date = new Date().toLocaleString();

                // 🔥 MONTA A MENSAGEM
                const msg = getLang("online", hours, minutes, usedRAM, totalRAM, date, prefix);

                let enviados = 0;
                let erros = 0;

                // 🔥 ENVIA PARA TODOS OS GRUPOS
                for (const group of groups) {
                    try {
                        await api.sendMessage({
                            body: msg,
                            attachment: fs.createReadStream(imagePath)
                        }, group.threadID);
                        enviados++;
                        await new Promise(resolve => setTimeout(resolve, 1500));
                    } catch (e) {
                        erros++;
                        console.error(`❌ Falha ao enviar para ${group.threadID}:`, e.message);
                    }
                }

                console.log(`✅ Startup enviado para ${enviados} grupos. ${erros} falhas.`);

                // 🔥 DELETA A IMAGEM
                setTimeout(() => {
                    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
                }, 5000);
            });

        } catch (error) {
            console.error('❌ Erro no evento startup:', error);
        }
    }
};

// 🔥 FUNÇÃO QUE GERA O BANNER DE STARTUP
async function generateStartupBanner() {
    const width = 800;
    const height = 400;
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 🔥 FUNDO
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#0a1628');
    gradient.addColorStop(0.5, '#1a0a2e');
    gradient.addColorStop(1, '#0a1628');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 🔥 BORDA ROSA
    ctx.shadowColor = '#FF1493';
    ctx.shadowBlur = 30;
    ctx.strokeStyle = '#FF1493';
    ctx.lineWidth = 3;
    ctx.strokeRect(15, 15, width - 30, height - 30);
    ctx.shadowBlur = 0;

    // 🔥 PONTOS BRILHANTES
    for (let i = 0; i < 50; i++) {
        ctx.fillStyle = 'rgba(255, 20, 147, ' + (Math.random() * 0.1) + ')';
        ctx.beginPath();
        ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 2 + 0.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // 🔥 TÍTULO
    ctx.shadowColor = '#FF1493';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#FF1493';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🌸 Tsuki Bot', width / 2, 90);
    ctx.shadowBlur = 0;

    // 🔥 SUBTÍTULO
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('✨ Online • Pronto para Uso ✨', width / 2, 145);

    // 🔥 LINHA
    ctx.strokeStyle = 'rgba(255, 20, 147, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(150, 175);
    ctx.lineTo(width - 150, 175);
    ctx.stroke();

    // 🔥 STATUS
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🟢 Sistema Operacional', width / 2, 215);

    // 🔥 PREFIXO
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('💡 Prefixo: ! (ex: !help)', width / 2, 255);

    // 🔥 INFO
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ 24/7 • Sempre ativo para você', width / 2, 295);

    // 🔥 RODAPÉ
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('✦ Tsuki Bot ✦', width / 2, height - 18);

    // 🔥 SALVA
    const pathImg = path.join(__dirname, 'cache', `startup_${Date.now()}.png`);
    const imageBuffer = canvas.toBuffer('image/png');
    fs.writeFileSync(pathImg, imageBuffer);
    return pathImg;
}

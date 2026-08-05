const Canvas = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

module.exports = {
    config: {
        name: "startup",
        event: "onStart", // 🔥 NOME DO EVENTO
        version: "1.1",
        author: "Tsuki",
        description: {
            pt: "Mensagem de boas-vindas quando o bot inicia"
        },
        category: "events" // 🔥 CATEGORIA OBRIGATÓRIA
    },

    onStart: async function ({ api }) {
        try {
            // 🔥 GERA O BANNER
            const imagePath = await generateWelcomeBanner();
            
            // 🔥 BUSCA TODOS OS GRUPOS
            api.getThreadList(500, null, ["INBOX"], async (err, list) => {
                if (err) {
                    console.error('Erro ao buscar grupos:', err);
                    return;
                }

                const groups = list.filter(t => t.isGroup === true && t.threadID);
                
                if (groups.length === 0) {
                    console.log('📭 Nenhum grupo encontrado.');
                    return;
                }

                const botInfo = await api.getUserInfo(api.getCurrentUserID());
                const botName = botInfo[api.getCurrentUserID()]?.name || 'Tsuki Bot';

                const uptime = process.uptime();
                const hours = Math.floor(uptime / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                const totalRAM = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
                const freeRAM = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
                const usedRAM = (totalRAM - freeRAM).toFixed(2);

                const msg = 
`🌸 **${botName} ESTÁ ONLINE!** 🌸

⏱️ Uptime: ${hours}h ${minutes}m
💾 RAM: ${usedRAM}GB / ${totalRAM}GB
📅 Data: ${new Date().toLocaleString()}

💡 Para ver os comandos, digite !help`;

                let enviados = 0;
                let erros = 0;

                for (const group of groups) {
                    try {
                        await api.sendMessage({
                            body: msg,
                            attachment: fs.createReadStream(imagePath)
                        }, group.threadID);
                        enviados++;
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (e) {
                        erros++;
                    }
                }

                console.log(`✅ Startup enviado para ${enviados} grupos. ${erros} falhas.`);

                setTimeout(() => {
                    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
                }, 5000);
            });

        } catch (error) {
            console.error('❌ Erro no startup:', error);
        }
    }
};

async function generateWelcomeBanner() {
    const width = 800;
    const height = 400;
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

    for (let i = 0; i < 50; i++) {
        ctx.fillStyle = 'rgba(255, 20, 147, ' + (Math.random() * 0.1) + ')';
        ctx.beginPath();
        ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 2 + 0.5, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.shadowColor = '#FF1493';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#FF1493';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🌸 Tsuki Bot', width / 2, 100);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('✨ Online e Pronto para Uso ✨', width / 2, 160);

    ctx.strokeStyle = 'rgba(255, 20, 147, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(150, 190);
    ctx.lineTo(width - 150, 190);
    ctx.stroke();

    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🟢 Sistema Operacional', width / 2, 235);

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ Pronto para receber comandos', width / 2, 275);

    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('✦ Tsuki Bot ✦', width / 2, height - 20);

    const pathImg = path.join(__dirname, 'cache', `startup_${Date.now()}.png`);
    const imageBuffer = canvas.toBuffer('image/png');
    fs.writeFileSync(pathImg, imageBuffer);
    return pathImg;
}

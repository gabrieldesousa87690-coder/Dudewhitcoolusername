const Canvas = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

// 🔥 DADOS PARA GERAR IDENTIDADE
const NOMES = ['João Silva', 'Maria Santos', 'Pedro Costa', 'Ana Oliveira', 'Carlos Souza', 'Juliana Lima', 'Rafael Pereira', 'Fernanda Alves', 'Lucas Ferreira', 'Beatriz Gomes', 'Gerson Azael', 'Hinata Hyuga', 'Naruto Uzumaki', 'Sasuke Uchiha', 'Sakura Haruno'];
const SOBRENOMES = ['Silva', 'Santos', 'Costa', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Alves', 'Ferreira', 'Gomes'];
const CIDADES = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Brasília', 'Curitiba', 'Porto Alegre', 'Salvador', 'Fortaleza', 'Recife', 'Luanda', 'Maputo', 'Lisboa'];
const ESTADOS = ['SP', 'RJ', 'MG', 'DF', 'PR', 'RS', 'BA', 'CE', 'PE', 'AO', 'MO', 'PT'];
const PROFISSOES = ['Programador', 'Designer', 'Engenheiro', 'Médico', 'Advogado', 'Professor', 'Arquiteto', 'Jornalista', 'Artista', 'Músico'];

// 🔥 FUNÇÕES AUXILIARES
function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomDate() {
    const year = Math.floor(Math.random() * 40) + 1970;
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
    return `${day}/${month}/${year}`;
}
function randomCPF() {
    const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 9));
    let d1 = n.reduce((s, v, i) => s + v * (10 - i), 0);
    let d2 = n.reduce((s, v, i) => s + v * (11 - i), 0) + d1 * 2;
    d1 = (d1 * 10) % 11; if (d1 === 10) d1 = 0;
    d2 = (d2 * 10) % 11; if (d2 === 10) d2 = 0;
    return `${n.slice(0,3).join('')}.${n.slice(3,6).join('')}.${n.slice(6,9).join('')}-${d1}${d2}`;
}
function randomRG() {
    const n = Array.from({ length: 8 }, () => Math.floor(Math.random() * 9));
    const d = Math.floor(Math.random() * 9);
    return `${n.slice(0,2).join('')}.${n.slice(2,5).join('')}.${n.slice(5,8).join('')}-${d}`;
}
function randomPhone() {
    const ddd = ['11', '21', '31', '41', '51', '61', '71', '81', '91', '92', '93', '94', '95', '96', '97', '98', '99'];
    const num = Math.floor(Math.random() * 900000000) + 100000000;
    return `(${randomItem(ddd)}) 9${String(num).padStart(8, '0')}`;
}

module.exports = {
    config: {
        name: "identidade",
        aliases: ["rg", "cpf", "id"],
        version: "1.0",
        author: "Tsuki",
        countDown: 5,
        role: 0,
        description: {
            pt: "Gera uma identidade falsa personalizada"
        },
        category: "fun",
        guide: {
            pt: "   {pn} - Gera uma identidade aleatória\n" +
                 "   {pn} <nome> - Gera identidade com nome específico"
        }
    },

    onStart: async function ({ api, event, args }) {
        const { threadID, messageID } = event;
        let nome = args.join(' ') || randomItem(NOMES);

        try {
            const imagePath = await generateIdentity(nome);
            
            return api.sendMessage({
                body: `🪪 **IDENTIDADE GERADA**\n👤 ${nome}`,
                attachment: fs.createReadStream(imagePath)
            }, threadID, () => {
                if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
            }, messageID);

        } catch (error) {
            console.error('Erro ao gerar identidade:', error);
            return api.sendMessage(
                `❌ | Erro ao gerar identidade: ${error.message}`,
                threadID,
                messageID
            );
        }
    }
};

// 🔥 FUNÇÃO QUE GERA A IMAGEM DA IDENTIDADE
async function generateIdentity(nome) {
    const width = 600;
    const height = 400;
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 🔥 FUNDO (ESTILO DOCUMENTO)
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.5, '#0f3460');
    gradient.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 🔥 BORDA
    ctx.shadowColor = '#4a9eff';
    ctx.shadowBlur = 20;
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 3;
    ctx.strokeRect(15, 15, width - 30, height - 30);
    ctx.shadowBlur = 0;

    // 🔥 TÍTULO
    ctx.shadowColor = '#4a9eff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🪪 IDENTIDADE OFICIAL', width / 2, 50);
    ctx.shadowBlur = 0;

    // 🔥 LINHA
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, 65);
    ctx.lineTo(width - 80, 65);
    ctx.stroke();

    // 🔥 DADOS
    const dados = [
        { label: 'Nome Completo', value: nome },
        { label: 'Data de Nascimento', value: randomDate() },
        { label: 'CPF', value: randomCPF() },
        { label: 'RG', value: randomRG() },
        { label: 'Telefone', value: randomPhone() },
        { label: 'Endereço', value: `${Math.floor(Math.random() * 999) + 1}, ${randomItem(['Rua', 'Avenida', 'Travessa'])} ${randomItem(['das Flores', 'da Paz', 'do Sol', 'da Lua', 'do Mar', 'das Estrelas'])}` },
        { label: 'Cidade/UF', value: `${randomItem(CIBADES)} - ${randomItem(ESTADOS)}` },
        { label: 'Profissão', value: randomItem(PROFISSOES) },
        { label: 'Validade', value: randomDate() }
    ];

    let y = 100;
    const col1 = 50;
    const col2 = 320;

    dados.forEach((d, i) => {
        const isEven = i % 2 === 0;
        const x = isEven ? col1 : col2;
        const yOffset = Math.floor(i / 2) * 32;

        // 🔥 FUNDO DO CAMPO (ALTERNADO)
        ctx.fillStyle = isEven ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)';
        ctx.fillRect(x - 10, y + yOffset - 18, 260, 28);

        // 🔥 LABEL
        ctx.fillStyle = '#8888aa';
        ctx.font = '11px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(d.label + ':', x, y + yOffset);

        // 🔥 VALOR
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(d.value.length > 20 ? d.value.substring(0, 18) + '...' : d.value, x + 120, y + yOffset);
    });

    // 🔥 FOTO (ROSTO GENÉRICO)
    const fotoX = width - 140;
    const fotoY = 80;
    const fotoSize = 100;

    ctx.shadowColor = '#4a9eff';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(fotoX + fotoSize / 2, fotoY + fotoSize / 2, fotoSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#2d2d44';
    ctx.fill();
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 🔥 EMOJI NO LUGAR DA FOTO
    ctx.fillStyle = '#ffffff';
    ctx.font = '50px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('👤', fotoX + fotoSize / 2, fotoY + fotoSize / 2 + 16);

    // 🔥 QR CODE (FAKE)
    const qrX = width - 140;
    const qrY = 200;
    const qrSize = 80;

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(qrX, qrY, qrSize, qrSize);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(qrX, qrY, qrSize, qrSize);

    for (let i = 0; i < 15; i++) {
        const x = qrX + Math.floor(Math.random() * qrSize);
        const y = qrY + Math.floor(Math.random() * qrSize);
        const w = Math.floor(Math.random() * 6) + 2;
        const h = Math.floor(Math.random() * 6) + 2;
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)';
        ctx.fillRect(x, y, w, h);
    }

    // 🔥 RODAPÉ
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('✦ Documento gerado por Hinata Bot ✦', width / 2, height - 15);

    // 🔥 SALVA A IMAGEM
    const pathImg = path.join(__dirname, 'cache', `identity_${Date.now()}.png`);
    const imageBuffer = canvas.toBuffer('image/png');
    fs.writeFileSync(pathImg, imageBuffer);
    return pathImg;
}

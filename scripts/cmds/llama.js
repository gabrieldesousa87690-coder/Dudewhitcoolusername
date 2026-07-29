const fs = require('fs-extra');
const path = require('path');

// 🔥 CAMINHO PARA CACHE DO MODELO
const MODEL_CACHE = path.join(__dirname, 'cache', 'models');

// 🔥 GARANTE QUE A PASTA EXISTE
fs.ensureDirSync(MODEL_CACHE);

// 🔥 ESTADO DO MODELO
let generator = null;
let isReady = false;
let statusMessage = '⏸️ Aguardando...';

// 🔥 CARREGA O MODELO QWEN2.5-0.5B (MAIS LEVE)
async function loadModel(progressCallback) {
    if (isReady) return true;

    try {
        statusMessage = '📥 Carregando biblioteca...';
        const { pipeline } = await import('@huggingface/transformers');
        
        statusMessage = '📥 Baixando Qwen2.5-0.5B (modelo leve)...';
        
        // 🔥 Qwen2.5-0.5B - 0.5B parâmetros (~1GB RAM)
        generator = await pipeline(
            'text-generation',
            'onnx-community/Qwen2.5-0.5B-Instruct',
            {
                dtype: 'q4', // Quantização para economizar RAM
                cache_dir: MODEL_CACHE,
                device: 'cpu',
                progress_callback: (progress) => {
                    if (progressCallback) {
                        try {
                            progressCallback(progress);
                        } catch (e) {}
                    }
                }
            }
        );
        
        isReady = true;
        statusMessage = '✅ Pronto! (~1GB RAM)';
        return true;
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        statusMessage = `❌ Erro: ${error.message}`;
        return false;
    }
}

// 🔥 GERA RESPOSTA
async function generateResponse(prompt, maxTokens = 200) {
    if (!isReady) {
        return '❌ Modelo não está pronto.';
    }

    try {
        const result = await generator(prompt, {
            max_new_tokens: maxTokens,
            temperature: 0.7,
            top_p: 0.9,
            do_sample: true,
            pad_token_id: 50256,
            eos_token_id: 50256,
        });

        let response = result[0]?.generated_text || '⚠️ Sem resposta.';
        if (response.startsWith(prompt)) {
            response = response.substring(prompt.length).trim();
        }
        return response || '⚠️ Sem resposta.';
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        return `❌ Erro: ${error.message}`;
    }
}

// 🔥 COMANDO PRINCIPAL
module.exports = {
    config: {
        name: "llama",
        aliases: ["ia", "ai", "gpt", "qwen"],
        version: "1.4",
        author: "Hinata",
        countDown: 10,
        role: 0,
        description: {
            pt: "IA local com Qwen2.5-0.5B (modelo leve ~1GB)"
        },
        category: "ai",
        guide: {
            pt: "   {pn} <pergunta> - Pergunte algo\n" +
                 "   {pn} status - Verifica o status"
        }
    },

    onStart: async function ({ api, event, args }) {
        const { threadID, messageID } = event;
        const action = args[0]?.toLowerCase();

        // 🔥 STATUS
        if (action === 'status') {
            const status = isReady ? '✅ Carregado' : '❌ Não carregado';
            const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            return api.sendMessage(
                `📊 **STATUS DO MODELO**\n\n` +
                `🔹 Modelo: Qwen2.5-0.5B\n` +
                `🔹 RAM: ~1GB\n` +
                `🔹 Estado: ${status}\n` +
                `🔹 Memória usada: ${mem} MB\n` +
                `🔹 Status: ${statusMessage}\n\n` +
                `💡 Use !llama <pergunta> para testar.`,
                threadID,
                messageID
            );
        }

        // 🔥 PERGUNTA
        const prompt = args.join(' ');
        if (!prompt || prompt.length < 2) {
            return api.sendMessage(
                '❌ | Digite uma pergunta!\n' +
                'Exemplo: !llama Qual é a capital do Brasil?',
                threadID,
                messageID
            );
        }

        // 🔥 ENVIA MENSAGEM DE PROGRESSO
        const progressMsg = await api.sendMessage(
            `🧠 **INICIANDO IA LOCAL**\n\n` +
            `📥 Baixando Qwen2.5-0.5B (~1GB)\n` +
            `⏳ Isso pode levar alguns minutos na primeira vez.\n\n` +
            `📊 Status: 0%`,
            threadID,
            messageID
        );

        let lastProgress = 0;
        const updateProgress = async (progress) => {
            const percent = Math.round(progress);
            if (percent !== lastProgress && percent > 0) {
                lastProgress = percent;
                const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5));
                try {
                    await api.editMessage(
                        `🧠 **INICIANDO IA LOCAL**\n\n` +
                        `📥 Baixando Qwen2.5... ${percent}%\n` +
                        `[${bar}] ${percent}%\n` +
                        `⏳ ${percent < 100 ? 'Aguarde...' : 'Finalizando...'}\n\n` +
                        `📊 Status: ${percent < 100 ? 'Baixando...' : 'Quase lá!'}`,
                        progressMsg.messageID
                    );
                } catch (e) {}
            }
        };

        try {
            // 🔥 CARREGA O MODELO
            const success = await loadModel(updateProgress);
            
            if (!success) {
                await api.editMessage(
                    `❌ **FALHA AO CARREGAR**\n\n` +
                    `Verifique sua conexão com a internet.\n\n` +
                    `💬 Erro: ${statusMessage}`,
                    progressMsg.messageID
                );
                return;
            }

            // 🔥 PROCESSANDO
            await api.editMessage(
                `🧠 **IA CARREGADA!**\n\n` +
                `✅ Qwen2.5 pronto para uso!\n` +
                `🤔 Processando sua pergunta...\n\n` +
                `📝 **Pergunta:** ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`,
                progressMsg.messageID
            );

            // 🔥 GERA RESPOSTA
            const response = await generateResponse(prompt);
            
            if (response.length > 2000) {
                const parts = [];
                for (let i = 0; i < response.length; i += 2000) {
                    parts.push(response.substring(i, i + 2000));
                }
                
                await api.editMessage(
                    `💬 **RESPOSTA:**\n\n${parts[0]}`,
                    progressMsg.messageID
                );
                for (let i = 1; i < parts.length; i++) {
                    await api.sendMessage(`📄 **Continuação:**\n\n${parts[i]}`, threadID);
                }
            } else {
                await api.editMessage(
                    `💬 **RESPOSTA:**\n\n${response}`,
                    progressMsg.messageID
                );
            }
            
        } catch (error) {
            console.error('Erro:', error);
            await api.editMessage(
                `❌ **ERRO AO PROCESSAR**\n\n` +
                `💬 ${error.message}`,
                progressMsg.messageID
            );
        }
    }
};

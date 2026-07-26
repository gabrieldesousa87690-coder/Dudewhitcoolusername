const fs = require('fs-extra');
const path = require('path');

// 🔥 ARQUIVO DE DADOS LOCAL
const DATA_PATH = path.join(__dirname, 'cache', 'baby_data.json');

// 🔥 GARANTE QUE O ARQUIVO EXISTE
function ensureFile() {
    fs.ensureDirSync(path.dirname(DATA_PATH));
    if (!fs.existsSync(DATA_PATH)) {
        fs.writeJSONSync(DATA_PATH, {});
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

// 🔥 ADICIONA UMA RESPOSTA
function addResponse(trigger, response) {
    const data = loadData();
    const key = trigger.toLowerCase().trim();
    if (!data[key]) data[key] = [];
    data[key].push(response);
    saveData(data);
    return data[key].length;
}

// 🔥 REMOVE UMA RESPOSTA
function removeResponse(trigger, index) {
    const data = loadData();
    const key = trigger.toLowerCase().trim();
    if (!data[key] || !data[key][index]) return false;
    data[key].splice(index, 1);
    if (data[key].length === 0) delete data[key];
    saveData(data);
    return true;
}

// 🔥 BUSCA RESPOSTA ALEATÓRIA
function getResponse(trigger) {
    const data = loadData();
    const key = trigger.toLowerCase().trim();
    if (!data[key] || data[key].length === 0) return null;
    return data[key][Math.floor(Math.random() * data[key].length)];
}

// 🔥 LISTA RESPOSTAS
function listResponses(trigger) {
    const data = loadData();
    const key = trigger.toLowerCase().trim();
    if (!data[key] || data[key].length === 0) return null;
    return data[key].map((r, i) => `${i + 1}. ${r}`).join('\n');
}

// 🔥 LISTA TODOS OS TRIGGERS
function listAllTriggers() {
    const data = loadData();
    return Object.keys(data).sort();
}

// 🔥 PALAVRAS DE ATIVAÇÃO
const mahmud = [
    "baby",
    "bby",
    "Azael",
    "bbu",
    "jan",
    "bot",
    "Shiro",
    "Yoshiro",
    "Sousa",
    "Gerson",
    "hina",
    "hinata",
];

module.exports.config = {
    name: "baby",
    aliases: ["bby", "sousa", "jan", "snow", "wifey", "bot", "hinata", "hina"],
    version: "2.0",
    author: "MahMUD",
    countDown: 0,
    role: 0,
    description: "better then all sim simi & most fastest",
    category: "chat",
    guide: {
        en: "{pn} [anyMessage] OR\nteach [YourMessage] - [Reply1], [Reply2], [Reply3]... OR\nremove [YourMessage] - [indexNumber] OR\nrm [YourMessage] - [indexNumber] OR\nmsg [YourMessage] OR\nlist OR \nall OR\nedit [YourMessage] - [NeWMessage]\nNote: The most updated and fastest all-in-one Simi Chat"
    }
};

module.exports.onStart = async ({ api, event, args, usersData }) => {
    const msg = args.join(" ");
    const uid = event.senderID;

    try {
        if (!args[0]) {
            const ran = ["Bolo baby", "I love you", "type !bby hi"];
            return api.sendMessage(ran[Math.floor(Math.random() * ran.length)], event.threadID, event.messageID);
        }

        // 🔥 TEACH (ENSINAR)
        if (args[0] === "teach") {
            const mahmudStr = msg.replace("teach ", "");
            const [trigger, ...responsesArr] = mahmudStr.split(" - ");
            const responses = responsesArr.join(" - ");
            if (!trigger || !responses) {
                return api.sendMessage("❌ | teach [question] - [response1, response2,...]", event.threadID, event.messageID);
            }
            const count = addResponse(trigger, responses);
            const userName = (await usersData.getName(uid)) || "Unknown User";
            return api.sendMessage(
                `✅ Replies added: "${responses}" to "${trigger}"\n• 𝐓𝐞𝐚𝐜𝐡𝐞𝐫: ${userName}\n• 𝐓𝐨𝐭𝐚𝐥: ${count}`,
                event.threadID,
                event.messageID
            );
        }

        // 🔥 REMOVE
        if (args[0] === "remove" || args[0] === "rm") {
            const mahmudStr = msg.replace(/remove |rm /, "");
            const [trigger, index] = mahmudStr.split(" - ");
            if (!trigger || !index || isNaN(index)) {
                return api.sendMessage("❌ | remove [question] - [index]", event.threadID, event.messageID);
            }
            const success = removeResponse(trigger, parseInt(index) - 1);
            if (success) {
                return api.sendMessage(`✅ Removed response #${index} from "${trigger}"`, event.threadID, event.messageID);
            } else {
                return api.sendMessage(`❌ No response found at index ${index} for "${trigger}"`, event.threadID, event.messageID);
            }
        }

        // 🔥 LIST
        if (args[0] === "list") {
            const trigger = msg.replace("list ", "").trim();
            if (!trigger) {
                return api.sendMessage("❌ | list [question]", event.threadID, event.messageID);
            }
            const list = listResponses(trigger);
            if (list) {
                return api.sendMessage(`📋 Responses for "${trigger}":\n\n${list}`, event.threadID, event.messageID);
            } else {
                return api.sendMessage(`❌ No responses found for "${trigger}"`, event.threadID, event.messageID);
            }
        }

        // 🔥 ALL (LISTAR TODOS OS TRIGGERS)
        if (args[0] === "all") {
            const triggers = listAllTriggers();
            if (triggers.length === 0) {
                return api.sendMessage("📭 No questions taught yet!", event.threadID, event.messageID);
            }
            let message = "📋 List of all taught questions:\n\n";
            triggers.forEach((t, i) => {
                const data = loadData();
                const count = data[t]?.length || 0;
                message += `${i + 1}. ${t} (${count} replies)\n`;
            });
            return api.sendMessage(message, event.threadID, event.messageID);
        }

        // 🔥 EDIT
        if (args[0] === "edit") {
            const mahmudStr = msg.replace("edit ", "");
            const [oldTrigger, ...newArr] = mahmudStr.split(" - ");
            const newResponse = newArr.join(" - ");
            if (!oldTrigger || !newResponse) {
                return api.sendMessage("❌ | Format: edit [question] - [newResponse]", event.threadID, event.messageID);
            }
            const data = loadData();
            const key = oldTrigger.toLowerCase().trim();
            if (!data[key] || data[key].length === 0) {
                return api.sendMessage(`❌ No responses found for "${oldTrigger}"`, event.threadID, event.messageID);
            }
            data[key][0] = newResponse;
            saveData(data);
            return api.sendMessage(`✅ Edited "${oldTrigger}" to "${newResponse}"`, event.threadID, event.messageID);
        }

        // 🔥 MSG (BUSCAR RESPOSTA ESPECÍFICA)
        if (args[0] === "msg") {
            const searchTrigger = args.slice(1).join(" ");
            if (!searchTrigger) {
                return api.sendMessage("Please provide a message to search.", event.threadID, event.messageID);
            }
            const response = getResponse(searchTrigger);
            if (response) {
                return api.sendMessage(`💬 Response for "${searchTrigger}":\n\n${response}`, event.threadID, event.messageID);
            } else {
                return api.sendMessage(`❌ No response found for "${searchTrigger}"`, event.threadID, event.messageID);
            }
        }

        // 🔥 RESPOSTA NORMAL (SEM COMANDO)
        const response = getResponse(msg);
        if (response) {
            api.sendMessage(response, event.threadID, (err, info) => {
                if (!err) {
                    global.GoatBot.onReply.set(info.messageID, {
                        commandName: this.config.name,
                        type: "reply",
                        messageID: info.messageID,
                        author: uid,
                        text: response
                    });
                }
            }, event.messageID);
        } else {
            // 🔥 SE NÃO SOUBER, OFERECE PARA ENSINAR
            api.sendMessage(
                `😅 Ainda não sei responder isso!\n\n💡 Me ensine com:\n!bby teach ${msg} - [sua resposta]`,
                event.threadID,
                event.messageID
            );
        }

    } catch (err) {
        console.error(err);
        api.sendMessage(`❌ Error: ${err.message}`, event.threadID, event.messageID);
    }
};

// 🔥 ONREPLY - RESPONDE A REPLIES
module.exports.onReply = async ({ api, event }) => {
    if (event.type !== "message_reply") return;
    try {
        const response = getResponse(event.body);
        if (response) {
            api.sendMessage(response, event.threadID, (err, info) => {
                if (!err) {
                    global.GoatBot.onReply.set(info.messageID, {
                        commandName: this.config.name,
                        type: "reply",
                        messageID: info.messageID,
                        author: event.senderID,
                        text: response
                    });
                }
            }, event.messageID);
        } else {
            api.sendMessage(
                `😅 Ainda não sei responder isso!\n\n💡 Me ensine com:\n!bby teach ${event.body} - [sua resposta]`,
                event.threadID,
                event.messageID
            );
        }
    } catch (err) {
        console.error(err);
    }
};

// 🔥 ONCHAT - REAGE QUANDO ALGUÉM FALA "HINATA", "BABY", ETC.
module.exports.onChat = async ({ api, event }) => {
    try {
        const message = event.body?.toLowerCase() || "";
        const attachments = event.attachments || [];

        if (event.type !== "message_reply" && mahmud.some(word => message.startsWith(word))) {
            api.setMessageReaction("🪽", event.messageID, () => {}, true);
            api.sendTypingIndicator(event.threadID, true);

            const messageParts = message.trim().split(/\s+/);

            // 🔥 SE FOR SÓ A PALAVRA DE ATIVAÇÃO (ex: "hinata")
            if (messageParts.length === 1 && attachments.length === 0) {
                const randomMessages = [
                    "Na verdade o meu nome real é hinata",
                    "Hinata baby🌸",
                    "Se me chamar, vou te dar um beijo😘",
                    "Não, mande mensagem pro meu chefe no whatsapp: 867872770",
                    "No lugar de flor de rosa, te mandei uma mensagem, idiota",
                    "Nunca sobra nada pro beta, que é você óbvio ",
                    "Eu te amo, é isso que a sua namorada imaginaria disse",
                    "tudo ficou pior quando você me chamou ",
                    "Se ficar dizendo bby, vai virar pai😒😒",
                    "Se me chamar demais, vou te dar um beijo na boca🥺",
                    "Se ficar muito de bby Bbby, vou dar um tempo😒😒",
                    "Se falar muito baby, vou te chamar de kamur🤭🤭",
                    "Você não tem namorada, por isso me chama? 😂😂😂",
                    "Não me chame, estou ocupada 🙆🏻‍♀",
                    "Se disser Bby, vai ficar sem emprego",
                    "Em vez de Bby Bby, meu chefe é gerson, pode dizer Gerson também😑?",
                    "Meu Sonar Bangla, qual é o próximo verso? 🙈",
                    "🍺 Toma, bebe esse suco..! De tanto falar Bby 🥲",
                    "De repente lembrou de mim? 🙄",
                    "Que susto achei que era o Elon musk, mas era um beta",
                    "Fala ae porra 🐤🐤",
                    "Sou sua irmã mais velha, ok? 😼 Me dê respeito🙁",
                    "Não te quero desgraça",
                    "Não chegue tão perto, senão vou acabar me apaixonando🙈",
                    "Ei, não estou com humor pra brincadeira😒",
                    "Diga Hey, beta. 😁",
                    "Ei, como você está? ",
                    "Arranja um namorada para você, eu já tô ocupada 💅🏻💛😻",
                    "Ei, tio, não me chama mais de pfvrrr😿",
                    "Preciso de um Janu (amor), você está solteiro(a)?",
                    "Você podia sentar pra estudar um pouco sem olhar pra mim🥺🥺",
                    "Você não é casado, como é que é Bby então?,,🙄",
                    "oh",
                    "Feito usando node.js (me da dinheiro baby :3)",
                    "'como fazer desaparecer 70kg de carne de galinha ' - alô é o FBI?",
                    "Diga o que vai dizer, vai dizer na frente de todo mundo?🤭🤏",
                    "Me esqueça, não falo com beta",
                    "Quando a gente se ver, me dê uma rosa de madeira..🤗",
                    "Que podre você é 🥺 pedindo atenção",
                    "Não, você não pode jogar GTA VI na sua batata",
                    "Diga o que posso fazer por você, porque tava acariciando alguém agora.. :3",
                    "Beta beta beta.. 😌",
                    "Ficou me perturbando toda hora, estou ocupada com meu dono 😋",
                    "Ohhh, foda-se",
                    "Se me chamar toda hora, minha cabeça esquenta😑😒",
                    "Sim, sou a baby hinata, SousaSadX que se foda",
                    "Hinata baby",
                    "Sou o crush de milhares de mosquitos😓",
                    "Tenho uma vergonha imensa dos homens, são uns palhaços, e os palhaços me assustam🥹🫣",
                    "Uso Facebook de graça porque quero rir da sua cara 😪😹",
                    "Melhore o coração, para o rosto já existe o Snapchat! 🌚"
                ];
                const hinataMessage = randomMessages[Math.floor(Math.random() * randomMessages.length)];
                api.sendMessage(hinataMessage, event.threadID, (err, info) => {
                    if (!err) {
                        global.GoatBot.onReply.set(info.messageID, {
                            commandName: this.config.name,
                            type: "reply",
                            messageID: info.messageID,
                            author: event.senderID,
                            text: hinataMessage
                        });
                    }
                }, event.messageID);
            } else {
                // 🔥 SE TIVER MAIS PALAVRAS, TENTA RESPONDER DO BANCO DE DADOS
                let userText = message;
                for (const prefix of mahmud) {
                    if (message.startsWith(prefix)) {
                        userText = message.substring(prefix.length).trim();
                        break;
                    }
                }
                const response = getResponse(userText);
                if (response) {
                    api.sendMessage(response, event.threadID, (err, info) => {
                        if (!err) {
                            global.GoatBot.onReply.set(info.messageID, {
                                commandName: this.config.name,
                                type: "reply",
                                messageID: info.messageID,
                                author: event.senderID,
                                text: response
                            });
                        }
                    }, event.messageID);
                } else {
                    // 🔥 SE NÃO SOUBER, OFERECE ENSINAR
                    api.sendMessage(
                        `😅 Ainda não sei responder isso!\n\n💡 Me ensine com:\n!bby teach ${userText} - [sua resposta]`,
                        event.threadID,
                        event.messageID
                    );
                }
            }
        }
    } catch (err) {
        console.error(err);
    }
};

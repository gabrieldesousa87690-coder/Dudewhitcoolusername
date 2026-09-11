module.exports = {
  config: {
    name: "set",
    aliases: ["ap", "setmoney", "setexp"],
    version: "2.0",
    author: "Loid Butter",
    role: 2, // 🔥 Apenas admin do bot (ou use a lista abaixo)
    description: {
      en: "Set coins and experience points for a user",
      pt: "Define moedas e experiência de um usuário"
    },
    category: "economy",
    guide: {
      en: "{pn} [money|exp] [amount] (respondendo ou mencionando alguém)\n" +
          "Ex: {pn} money 1000\n" +
          "Ex: {pn} exp 500 @usuario",
      pt: "{pn} [money|exp] [valor] (respondendo ou mencionando alguém)\n" +
          "Ex: {pn} money 1000\n" +
          "Ex: {pn} exp 500 @usuario"
    }
  },

  onStart: async function ({ args, event, api, usersData }) {
    const { messageID, senderID, threadID, mentions, messageReply } = event;

    // 🔥 PERMISSÃO: aceita lista hardcoded OU owner do bot
    const ALLOWED_IDS = ["61592278927885"];
    const botOwner = global.GoatBot?.config?.ownerID 
      ? String(global.GoatBot.config.ownerID) 
      : null;
    
    const isAllowed = ALLOWED_IDS.includes(String(senderID)) 
      || (botOwner && String(senderID) === botOwner);

    if (!isAllowed) {
      return api.sendMessage(
        "❌ | Você não tem permissão para usar este comando.\n" +
        "Apenas o dono do bot pode usar.",
        threadID,
        messageID
      );
    }

    // 🔥 VALIDAÇÃO DE ARGUMENTOS
    const query = (args[0] || "").toLowerCase().trim();
    const rawAmount = args[1];

    if (!query || rawAmount === undefined) {
      return api.sendMessage(
        "❌ | Uso correto: set [money|exp] [valor]\n" +
        "💡 Ex: set money 1000\n" +
        "💡 Ex: set exp 500 (respondendo alguém)",
        threadID,
        messageID
      );
    }

    if (!["money", "exp"].includes(query)) {
      return api.sendMessage(
        "❌ | Query inválida. Use 'money' ou 'exp'.",
        threadID,
        messageID
      );
    }

    // 🔥 Converte valor (aceita 1k, 1m, etc)
    let amount = parseAmount(rawAmount);
    if (amount === null || isNaN(amount)) {
      return api.sendMessage(
        "❌ | Valor inválido! Use um número (ex: 1000, 1k, 1.5m).",
        threadID,
        messageID
      );
    }

    if (amount < 0) {
      return api.sendMessage("❌ | O valor não pode ser negativo.", threadID, messageID);
    }

    // 🔥 IDENTIFICA ALVO (reply > mention > sender)
    let targetUser = null;
    if (messageReply && messageReply.senderID) {
      targetUser = String(messageReply.senderID);
    } else if (mentions && Object.keys(mentions).length > 0) {
      targetUser = String(Object.keys(mentions)[0]);
    } else {
      targetUser = String(senderID);
    }

    // 🔥 Não permite setar no próprio bot
    const botID = api.getCurrentUserID ? String(api.getCurrentUserID()) : null;
    if (botID && targetUser === botID) {
      return api.sendMessage("❌ | Não posso setar valores no próprio bot.", threadID, messageID);
    }

    // 🔥 BUSCA O USUÁRIO (cria se não existir)
    let userData = await usersData.get(targetUser);
    if (!userData) {
      try {
        await usersData.create(targetUser, {
          name: `User_${targetUser}`,
          money: 0,
          exp: 0,
          data: {}
        });
        userData = await usersData.get(targetUser);
      } catch (e) {
        return api.sendMessage(`❌ | Usuário não encontrado e não foi possível criar.`, threadID, messageID);
      }
    }

    // 🔥 NOME (com fallback)
    let name = "Usuário";
    try {
      if (typeof usersData.getName === "function") {
        name = await usersData.getName(targetUser) || userData.name || `User_${targetUser}`;
      } else {
        name = userData.name || `User_${targetUser}`;
      }
    } catch (e) {
      name = userData.name || `User_${targetUser}`;
    }

    // 🔥 ATUALIZA (preservando outros campos)
    try {
      if (query === "exp") {
        await usersData.set(targetUser, {
          money: userData.money ?? 0,
          exp: amount,
          data: userData.data ?? {}
        });
        return api.sendMessage(
          `✅ | Experiência de ${name} definida para ${amount} XP.`,
          threadID,
          messageID
        );
      } else {
        await usersData.set(targetUser, {
          money: amount,
          exp: userData.exp ?? 0,
          data: userData.data ?? {}
        });
        return api.sendMessage(
          `✅ | Moedas de ${name} definidas para ${formatMoney(amount)}.`,
          threadID,
          messageID
        );
      }
    } catch (error) {
      console.error("Erro no comando set:", error);
      return api.sendMessage(
        `❌ | Erro ao atualizar: ${error.message}`,
        threadID,
        messageID
      );
    }
  }
};

// 🔥 Converte "1k" → 1000, "1.5m" → 1500000, etc
function parseAmount(raw) {
  if (raw === undefined || raw === null) return null;
  let str = String(raw).toLowerCase().trim().replace(/\s/g, "").replace(",", ".");
  let multiplier = 1;
  if (str.endsWith("k")) { multiplier = 1000; str = str.slice(0, -1); }
  else if (str.endsWith("m")) { multiplier = 1000000; str = str.slice(0, -1); }
  else if (str.endsWith("b")) { multiplier = 1000000000; str = str.slice(0, -1); }
  const num = parseFloat(str);
  if (isNaN(num)) return null;
  return Math.floor(num * multiplier);
}

// 🔥 Formata dinheiro
function formatMoney(num) {
  const n = parseInt(num) || 0;
  if (n < 1000) return n + "$";
  if (n < 1000000) return (n / 1000).toFixed(1) + "K$";
  if (n < 1000000000) return (n / 1000000).toFixed(1) + "M$";
  if (n < 1000000000000) return (n / 1000000000).toFixed(1) + "B$";
  return (n / 1000000000000).toFixed(1) + "T$";
}

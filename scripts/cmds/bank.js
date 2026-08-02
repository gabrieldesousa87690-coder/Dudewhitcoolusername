const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

// 🔥 CAMINHOS
const BANK_PATH = path.join(__dirname, 'tmp', 'bank_data.json');
const TMP_PATH = path.join(__dirname, 'tmp');

// 🔥 GARANTE QUE A PASTA TMP EXISTE
fs.ensureDirSync(TMP_PATH);

// 🔥 LISTA DE OWNERS
const OWNERS = ['61590677925905', '100076392843792'];

// 🔥 FUNÇÕES DO BANCO
function loadBank() {
    try {
        if (fs.existsSync(BANK_PATH)) {
            return fs.readJSONSync(BANK_PATH);
        }
    } catch (e) {
        console.error('Erro ao carregar bank_data.json:', e.message);
    }
    return {};
}

function saveBank(data) {
    try {
        fs.writeJSONSync(BANK_PATH, data, { spaces: 2 });
        return true;
    } catch (e) {
        console.error('Erro ao salvar bank_data.json:', e.message);
        return false;
    }
}

// 🔥 FUNÇÃO PARA GARANTIR QUE O USUÁRIO EXISTE (IGUAL AO BALANCE)
async function ensureUserExists(userID, usersData) {
    try {
        let user = await usersData.get(userID);
        if (!user) {
            await usersData.set(userID, {
                money: 0,
                exp: 0,
                name: `User_${userID}`,
                data: {}
            });
            user = await usersData.get(userID);
        }
        return user;
    } catch (e) {
        console.error('Erro ao criar usuário:', e.message);
        return null;
    }
}

function getOrCreateAccount(userID) {
    const bank = loadBank();
    if (!bank[userID]) {
        bank[userID] = {
            phone: userID.toString(), // 🔥 USA O UID COMO TELEFONE
            password: null,
            balance: 0,
            debt: 0,
            debtDate: null,
            interestRate: 0.01,
            lastInterest: Date.now(),
            history: [],
            createdAt: new Date().toLocaleString()
        };
        saveBank(bank);
    }
    return bank[userID];
}

function addHistory(userID, type, amount, description) {
    const bank = loadBank();
    if (!bank[userID]) return;
    bank[userID].history.push({
        type,
        amount,
        description,
        date: new Date().toLocaleString()
    });
    if (bank[userID].history.length > 50) bank[userID].history.shift();
    saveBank(bank);
}

// 🔥 CALCULA JUROS (1% a cada 30 minutos)
function calculateInterest(userID) {
    const bank = loadBank();
    if (!bank[userID]) return 0;
    const account = bank[userID];
    if (account.debt <= 0) return 0;
    
    const now = Date.now();
    const diff = now - (account.lastInterest || now);
    const intervals = Math.floor(diff / (30 * 60 * 1000));
    
    if (intervals > 0) {
        let interest = 0;
        let debt = account.debt;
        for (let i = 0; i < intervals; i++) {
            interest += Math.floor(debt * 0.01);
            debt += interest;
        }
        account.debt = debt;
        account.lastInterest = now;
        addHistory(userID, 'interest', interest, `Juros de 1% (${intervals} períodos de 30min)`);
        saveBank(bank);
        return interest;
    }
    return 0;
}

// 🔥 COMANDO PRINCIPAL
module.exports = {
    config: {
        name: "bank",
        aliases: ["banco", "conta"],
        version: "3.3",
        author: "Tsuki",
        countDown: 5,
        role: 0,
        description: {
            pt: "Sistema bancário completo com backup manual"
        },
        category: "economy",
        guide: {
            pt: "   {pn} - Ver sua conta\n" +
                 "   {pn} senha <senha> - Criar/alterar senha\n" +
                 "   {pn} depositar <valor> - Deposita dinheiro\n" +
                 "   {pn} sacar <valor> - Saca dinheiro (pede senha)\n" +
                 "   {pn} transferir <valor> <@user> - Transfere (pede senha)\n" +
                 "   {pn} emprestimo <valor> - Pega empréstimo (1% a cada 30min)\n" +
                 "   {pn} pagar [agua|luz|internet] - Paga conta\n" +
                 "   {pn} extrato - Ver histórico\n" +
                 "   {pn} backup - Envia backup em texto (Owner only)"
        }
    },

    onStart: async function ({ api, event, args, usersData }) {
        const { senderID, threadID, messageID, mentions } = event;
        const userId = parseInt(senderID);
        const action = args[0]?.toLowerCase();
        const isOwner = OWNERS.includes(senderID);

        // 🔥 GARANTE QUE O USUÁRIO EXISTE (IGUAL AO BALANCE)
        const user = await ensureUserExists(userId, usersData);
        if (!user) {
            return api.sendMessage('❌ | Erro ao criar usuário!', threadID, messageID);
        }

        // 🔥 CALCULA JUROS
        calculateInterest(userId);

        const account = getOrCreateAccount(userId);
        const userData = user;
        const name = userData.name || `User_${userId}`;

        // 🔥 COMANDO: BACKUP (ENVIA JSON EM TEXTO)
        if (action === 'backup' && isOwner) {
            try {
                const bank = loadBank();
                const jsonText = JSON.stringify(bank, null, 2);
                const size = (jsonText.length / 1024).toFixed(2);

                if (jsonText.length < 2000) {
                    return api.sendMessage(
                        `📂 **BACKUP DO BANCO**\n\n` +
                        `📊 Total de contas: ${Object.keys(bank).length}\n` +
                        `📦 Tamanho: ${size} KB\n` +
                        `🕒 ${new Date().toLocaleString()}\n\n` +
                        `\`\`\`json\n${jsonText}\n\`\`\``,
                        threadID,
                        messageID
                    );
                } else {
                    const parts = [];
                    const maxLength = 1800;
                    let currentPart = '';
                    
                    for (const line of jsonText.split('\n')) {
                        if (currentPart.length + line.length > maxLength) {
                            parts.push(currentPart);
                            currentPart = '';
                        }
                        currentPart += line + '\n';
                    }
                    if (currentPart) parts.push(currentPart);

                    await api.sendMessage(
                        `📂 **BACKUP DO BANCO**\n\n` +
                        `📊 Total de contas: ${Object.keys(bank).length}\n` +
                        `📦 Tamanho: ${size} KB\n` +
                        `📄 ${parts.length} partes\n` +
                        `🕒 ${new Date().toLocaleString()}`,
                        threadID,
                        messageID
                    );

                    for (let i = 0; i < parts.length; i++) {
                        await api.sendMessage(
                            `📄 Parte ${i + 1}/${parts.length}\n\n\`\`\`json\n${parts[i]}\n\`\`\``,
                            threadID,
                            messageID
                        );
                    }
                }

            } catch (error) {
                return api.sendMessage(`❌ | Erro ao gerar backup: ${error.message}`, threadID, messageID);
            }
        }

        // 🔥 COMANDO: SENHA
        if (action === 'senha' || action === 'password') {
            const password = args[1];
            if (!password || password.length < 4) {
                return api.sendMessage('❌ | Senha deve ter pelo menos 4 caracteres!', threadID, messageID);
            }
            
            const hashed = crypto.createHash('sha256').update(password).digest('hex');
            account.password = hashed;
            saveBank(loadBank());
            
            return api.sendMessage('🔐 | Senha definida com sucesso!', threadID, messageID);
        }

        // 🔥 COMANDO: EMPRÉSTIMO
        if (action === 'emprestimo' || action === 'loan') {
            const amount = parseInt(args[1]);
            if (!amount || amount <= 0) {
                return api.sendMessage('❌ | Valor inválido! Use: !bank emprestimo 1000', threadID, messageID);
            }
            
            if (account.debt > 0) {
                return api.sendMessage(`❌ | Você já tem uma dívida de ${account.debt.toLocaleString()}$!`, threadID, messageID);
            }
            
            const maxLoan = (userData.money || 0) * 2;
            if (amount > maxLoan) {
                return api.sendMessage(`❌ | Empréstimo máximo: ${maxLoan.toLocaleString()}$ (2x seu saldo)`, threadID, messageID);
            }
            
            account.debt = amount;
            account.debtDate = Date.now();
            account.lastInterest = Date.now();
            account.balance += amount;
            addHistory(userId, 'loan', amount, 'Empréstimo recebido');
            saveBank(loadBank());
            
            return api.sendMessage(
                `✅ **EMPRÉSTIMO APROVADO!**\n\n` +
                `💰 Valor: ${amount.toLocaleString()}$\n` +
                `📊 Juros: 1% a cada 30 minutos\n` +
                `🏦 Saldo: ${account.balance.toLocaleString()}$\n` +
                `⚠️ Quando seu saldo ultrapassar ${(amount * 2).toLocaleString()}$, o banco cobrará a dívida!`,
                threadID,
                messageID
            );
        }

        // 🔥 COMANDO: DEPOSITAR
        if (action === 'depositar' || action === 'deposit') {
            const amount = parseInt(args[1]);
            if (!amount || amount <= 0) {
                return api.sendMessage('❌ | Valor inválido! Use: !bank depositar 1000', threadID, messageID);
            }
            
            const money = userData.money || 0;
            if (amount > money) {
                return api.sendMessage(`❌ | Você só tem ${money.toLocaleString()}$ na carteira!`, threadID, messageID);
            }
            
            await usersData.set(userId, { money: money - amount });
            account.balance += amount;
            addHistory(userId, 'deposit', amount, 'Depósito na conta');
            saveBank(loadBank());
            
            return api.sendMessage(
                `✅ **DEPÓSITO REALIZADO!**\n\n` +
                `💰 ${amount.toLocaleString()}$\n` +
                `🏦 Saldo: ${account.balance.toLocaleString()}$`,
                threadID,
                messageID
            );
        }

        // 🔥 COMANDO: SACAR (COM SENHA)
        if (action === 'sacar' || action === 'withdraw') {
            const amount = parseInt(args[1]);
            if (!amount || amount <= 0) {
                return api.sendMessage('❌ | Valor inválido!', threadID, messageID);
            }
            
            if (!account.password) {
                return api.sendMessage('❌ | Defina uma senha primeiro! Use: !bank senha <senha>', threadID, messageID);
            }
            
            const password = args[2];
            if (!password) {
                return api.sendMessage('🔐 | Digite sua senha: !bank sacar <valor> <senha>', threadID, messageID);
            }
            
            const hashed = crypto.createHash('sha256').update(password).digest('hex');
            if (hashed !== account.password) {
                return api.sendMessage('❌ | Senha incorreta!', threadID, messageID);
            }
            
            if (amount > account.balance) {
                return api.sendMessage(`❌ | Saldo insuficiente! Você tem ${account.balance.toLocaleString()}$`, threadID, messageID);
            }
            
            account.balance -= amount;
            const currentMoney = userData.money || 0;
            await usersData.set(userId, { money: currentMoney + amount });
            addHistory(userId, 'withdraw', amount, 'Saque da conta');
            saveBank(loadBank());
            
            return api.sendMessage(
                `✅ **SAQUE REALIZADO!**\n\n` +
                `💰 ${amount.toLocaleString()}$\n` +
                `🏦 Saldo: ${account.balance.toLocaleString()}$`,
                threadID,
                messageID
            );
        }

        // 🔥 COMANDO: TRANSFERIR (COM SENHA)
        if (action === 'transferir' || action === 'transfer') {
            const amount = parseInt(args[1]);
            if (!amount || amount <= 0) {
                return api.sendMessage('❌ | Valor inválido!', threadID, messageID);
            }
            
            if (!account.password) {
                return api.sendMessage('❌ | Defina uma senha primeiro! Use: !bank senha <senha>', threadID, messageID);
            }
            
            let targetId = null;
            let targetName = '';
            
            if (Object.keys(mentions).length > 0) {
                targetId = parseInt(Object.keys(mentions)[0]);
                targetName = mentions[targetId].replace(/@/g, '').trim();
            } else {
                return api.sendMessage('❌ | Marque o destinatário!', threadID, messageID);
            }
            
            if (targetId === userId) {
                return api.sendMessage('❌ | Não pode transferir para si mesmo!', threadID, messageID);
            }

            // 🔥 GARANTE QUE O DESTINATÁRIO EXISTE (IGUAL AO BALANCE)
            const targetUser = await ensureUserExists(targetId, usersData);
            if (!targetUser) {
                return api.sendMessage('❌ | Erro ao criar usuário destinatário!', threadID, messageID);
            }
            
            const password = args[3];
            if (!password) {
                return api.sendMessage('🔐 | Digite sua senha: !bank transferir <valor> @user <senha>', threadID, messageID);
            }
            
            const hashed = crypto.createHash('sha256').update(password).digest('hex');
            if (hashed !== account.password) {
                return api.sendMessage('❌ | Senha incorreta!', threadID, messageID);
            }
            
            if (amount > account.balance) {
                return api.sendMessage(`❌ | Saldo insuficiente! Você tem ${account.balance.toLocaleString()}$`, threadID, messageID);
            }
            
            const targetAccount = getOrCreateAccount(targetId);
            account.balance -= amount;
            targetAccount.balance += amount;
            addHistory(userId, 'transfer_out', amount, `Transferência para ${targetName}`);
            addHistory(targetId, 'transfer_in', amount, `Transferência de ${name}`);
            saveBank(loadBank());
            
            return api.sendMessage(
                `✅ **TRANSFERÊNCIA REALIZADA!**\n\n` +
                `📤 Para: ${targetName}\n` +
                `💰 ${amount.toLocaleString()}$\n` +
                `🏦 Saldo: ${account.balance.toLocaleString()}$`,
                threadID,
                messageID
            );
        }

        // 🔥 COMANDO: PAGAR CONTA
        if (action === 'pagar') {
            const billType = args[1]?.toLowerCase();
            const bills = {
                agua: { min: 50, max: 200, emoji: '💧' },
                luz: { min: 80, max: 300, emoji: '⚡' },
                internet: { min: 100, max: 400, emoji: '🌐' }
            };
            
            if (!billType || !bills[billType]) {
                return api.sendMessage('❌ | Use: !bank pagar [agua|luz|internet]', threadID, messageID);
            }
            
            const bill = bills[billType];
            const amount = Math.floor(Math.random() * (bill.max - bill.min + 1)) + bill.min;
            
            if (amount > account.balance) {
                return api.sendMessage(`❌ | Saldo insuficiente! Conta: ${amount.toLocaleString()}$`, threadID, messageID);
            }
            
            account.balance -= amount;
            addHistory(userId, 'bill', amount, `Pagamento de conta ${billType}`);
            saveBank(loadBank());
            
            return api.sendMessage(
                `✅ **CONTA PAGA!**\n\n` +
                `${bill.emoji} ${billType.toUpperCase()}: ${amount.toLocaleString()}$\n` +
                `🏦 Saldo: ${account.balance.toLocaleString()}$`,
                threadID,
                messageID
            );
        }

        // 🔥 COMANDO: EXTRATO
        if (action === 'extrato' || action === 'history') {
            const history = account.history || [];
            if (history.length === 0) {
                return api.sendMessage('📭 | Nenhuma transação encontrada!', threadID, messageID);
            }
            
            let msg = `📊 **EXTRATO BANCÁRIO**\n\n`;
            const recent = history.slice(-10).reverse();
            recent.forEach((h) => {
                const emoji = {
                    deposit: '✅', withdraw: '💰', transfer_out: '📤',
                    transfer_in: '📥', bill: '📄', loan: '💳',
                    debt_paid: '💸', interest: '📈'
                }[h.type] || '📝';
                msg += `${emoji} ${h.description}: ${h.amount.toLocaleString()}$\n`;
                msg += `   📅 ${h.date}\n\n`;
            });
            
            return api.sendMessage(msg, threadID, messageID);
        }

        // 🔥 VERIFICA DÍVIDA E COBRA SE POSSÍVEL
        if (account.debt > 0) {
            const totalMoney = account.balance + (userData.money || 0);
            const doubleDebt = account.debt * 2;
            
            if (totalMoney >= doubleDebt) {
                const debtAmount = account.debt;
                const totalDebt = debtAmount;
                
                if (account.balance >= totalDebt) {
                    account.balance -= totalDebt;
                } else {
                    const remaining = totalDebt - account.balance;
                    account.balance = 0;
                    await usersData.set(userId, { money: Math.max(0, (userData.money || 0) - remaining) });
                }
                
                addHistory(userId, 'debt_paid', totalDebt, 'Dívida cobrada pelo banco');
                account.debt = 0;
                account.debtDate = null;
                saveBank(loadBank());
                
                return api.sendMessage(
                    `💸 **DÍVIDA COBRADA!**\n\n` +
                    `O banco cobrou sua dívida de ${debtAmount.toLocaleString()}$.\n` +
                    `💰 Total pago: ${totalDebt.toLocaleString()}$\n` +
                    `🏦 Saldo restante: ${account.balance.toLocaleString()}$`,
                    threadID,
                    messageID
                );
            }
        }

        // 🔥 VER CONTA (DEFAULT)
        const total = account.balance + (userData.money || 0);
        const debtStatus = account.debt > 0 ? 
            `⚠️ Dívida: ${account.debt.toLocaleString()}$ (1% a cada 30min)` : 
            '✅ Sem dívidas';
        
        return api.sendMessage(
            `🏦 **${name}**\n\n` +
            `📞 Telefone: ${account.phone}\n` +
            `💰 Saldo: ${account.balance.toLocaleString()}$\n` +
            `💵 Carteira: ${(userData.money || 0).toLocaleString()}$\n` +
            `💎 Total: ${total.toLocaleString()}$\n` +
            `📊 ${debtStatus}\n` +
            `📅 Criado: ${account.createdAt}`,
            threadID,
            messageID
        );
    }
};

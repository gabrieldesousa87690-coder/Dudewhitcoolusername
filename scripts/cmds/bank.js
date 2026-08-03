const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

// 🔥 CAMINHOS
const BANK_PATH = path.join(__dirname, 'tmp', 'bank_data.json');
const TMP_PATH = path.join(__dirname, 'tmp');
const USERS_PATH = path.join(__dirname, '..', '..', 'database', 'data', 'usersData.json');

// 🔥 GARANTE QUE AS PASTAS EXISTEM
fs.ensureDirSync(TMP_PATH);
fs.ensureDirSync(path.dirname(USERS_PATH));

// 🔥 LISTA DE OWNERS
const OWNERS = ['61590677925905', '100076392843792'];

// 🔥 ==================== FUNÇÕES DO BANCO ====================
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

// 🔥 ==================== FUNÇÕES DO USERSDATA ====================
function loadUsers() {
    try {
        if (fs.existsSync(USERS_PATH)) {
            return fs.readJSONSync(USERS_PATH);
        }
    } catch (e) {
        console.error('Erro ao carregar usersData.json:', e.message);
    }
    return [];
}

function saveUsers(users) {
    try {
        fs.writeJSONSync(USERS_PATH, users, { spaces: 2 });
        return true;
    } catch (e) {
        console.error('Erro ao salvar usersData.json:', e.message);
        return false;
    }
}

// 🔥 ==================== FUNÇÃO PARA GARANTIR USUÁRIO ====================
function ensureUserExists(userID, userName = '') {
    // 🔥 CRIA NO BANCO
    const bank = loadBank();
    if (!bank[userID]) {
        bank[userID] = {
            phone: userID.toString(),
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

    // 🔥 CRIA NO USERSDATA
    let users = loadUsers();
    const userIndex = users.findIndex(u => u.userID == userID);
    if (userIndex === -1) {
        users.push({
            userID: userID,
            money: 0,
            exp: 0,
            name: userName || `User_${userID}`,
            data: {}
        });
        saveUsers(users);
    }

    return {
        bank: bank[userID],
        user: users.find(u => u.userID == userID)
    };
}

// 🔥 ==================== FUNÇÃO PARA ATUALIZAR SALDO ====================
function updateUserMoney(userID, newMoney) {
    let users = loadUsers();
    const index = users.findIndex(u => u.userID == userID);
    if (index !== -1) {
        users[index].money = newMoney;
        saveUsers(users);
        return true;
    }
    return false;
}

function getUserMoney(userID) {
    const users = loadUsers();
    const user = users.find(u => u.userID == userID);
    return user ? user.money || 0 : 0;
}

// 🔥 ==================== FUNÇÕES DO BANCO ====================
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

// 🔥 ==================== COMANDO PRINCIPAL ====================
module.exports = {
    config: {
        name: "bank",
        aliases: ["banco", "conta"],
        version: "3.5",
        author: "Tsuki",
        countDown: 5,
        role: 0,
        description: {
            pt: "Sistema bancário completo com integração com a carteira"
        },
        category: "economy",
        guide: {
            pt: "   {pn} - Ver sua conta\n" +
                 "   {pn} senha <senha> - Criar/alterar senha\n" +
                 "   {pn} depositar <valor> - Deposita da carteira para o banco\n" +
                 "   {pn} sacar <valor> - Saca do banco para a carteira (pede senha)\n" +
                 "   {pn} transferir <valor> <@user> - Transfere do banco (pede senha)\n" +
                 "   {pn} emprestimo <valor> - Pega empréstimo (1% a cada 30min)\n" +
                 "   {pn} pagar [agua|luz|internet] - Paga conta\n" +
                 "   {pn} extrato - Ver histórico\n" +
                 "   {pn} backup - Envia backup em texto (Owner only)"
        }
    },

    onStart: async function ({ api, event, args }) {
        const { senderID, threadID, messageID, mentions } = event;
        const userId = parseInt(senderID);
        const action = args[0]?.toLowerCase();
        const isOwner = OWNERS.includes(senderID);

        // 🔥 GARANTE QUE O USUÁRIO EXISTE
        const { bank: account, user } = ensureUserExists(userId);
        const name = user?.name || `User_${userId}`;

        // 🔥 CALCULA JUROS
        calculateInterest(userId);

        // 🔥 PEGA O SALDO ATUAL DA CARTEIRA
        const walletMoney = getUserMoney(userId);

        // 🔥 ==================== BACKUP ====================
        if (action === 'backup' && isOwner) {
            try {
                const bank = loadBank();
                const jsonText = JSON.stringify(bank, null, 2);
                const size = (jsonText.length / 1024).toFixed(2);

                if (jsonText.length < 2000) {
                    return api.sendMessage(
                        `📂 **BACKUP DO BANCO**\n\n📊 Total de contas: ${Object.keys(bank).length}\n📦 ${size} KB\n🕒 ${new Date().toLocaleString()}\n\n\`\`\`json\n${jsonText}\n\`\`\``,
                        threadID,
                        messageID
                    );
                } else {
                    const parts = [];
                    let currentPart = '';
                    for (const line of jsonText.split('\n')) {
                        if (currentPart.length + line.length > 1800) {
                            parts.push(currentPart);
                            currentPart = '';
                        }
                        currentPart += line + '\n';
                    }
                    if (currentPart) parts.push(currentPart);

                    await api.sendMessage(`📂 **BACKUP DO BANCO**\n\n📊 Total: ${Object.keys(bank).length}\n📦 ${size} KB\n📄 ${parts.length} partes`, threadID, messageID);
                    for (let i = 0; i < parts.length; i++) {
                        await api.sendMessage(`📄 Parte ${i + 1}/${parts.length}\n\n\`\`\`json\n${parts[i]}\n\`\`\``, threadID, messageID);
                    }
                }
            } catch (error) {
                return api.sendMessage(`❌ | Erro ao gerar backup: ${error.message}`, threadID, messageID);
            }
            return;
        }

        // 🔥 ==================== SENHA ====================
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

        // 🔥 ==================== EMPRÉSTIMO ====================
        if (action === 'emprestimo' || action === 'loan') {
            const amount = parseInt(args[1]);
            if (!amount || amount <= 0) {
                return api.sendMessage('❌ | Valor inválido! Use: !bank emprestimo 1000', threadID, messageID);
            }
            if (account.debt > 0) {
                return api.sendMessage(`❌ | Você já tem uma dívida de ${account.debt.toLocaleString()}$!`, threadID, messageID);
            }
            const maxLoan = walletMoney * 2;
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
                `✅ **EMPRÉSTIMO APROVADO!**\n💰 ${amount.toLocaleString()}$\n📊 Juros: 1% a cada 30min\n🏦 Saldo: ${account.balance.toLocaleString()}$\n⚠️ Quando ultrapassar ${(amount * 2).toLocaleString()}$, o banco cobrará!`,
                threadID,
                messageID
            );
        }

        // 🔥 ==================== DEPOSITAR (CARTEIRA → BANCO) ====================
        if (action === 'depositar' || action === 'deposit') {
            const amount = parseInt(args[1]);
            if (!amount || amount <= 0) {
                return api.sendMessage('❌ | Valor inválido! Use: !bank depositar 1000', threadID, messageID);
            }
            if (amount > walletMoney) {
                return api.sendMessage(`❌ | Você só tem ${walletMoney.toLocaleString()}$ na carteira!`, threadID, messageID);
            }
            // 🔥 ATUALIZA CARTEIRA
            updateUserMoney(userId, walletMoney - amount);
            // 🔥 ATUALIZA BANCO
            account.balance += amount;
            addHistory(userId, 'deposit', amount, 'Depósito na conta');
            saveBank(loadBank());
            return api.sendMessage(
                `✅ **DEPÓSITO REALIZADO!**\n💰 ${amount.toLocaleString()}$\n💵 Carteira: ${(walletMoney - amount).toLocaleString()}$\n🏦 Banco: ${account.balance.toLocaleString()}$`,
                threadID,
                messageID
            );
        }

        // 🔥 ==================== SACAR (BANCO → CARTEIRA) ====================
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
                return api.sendMessage(`❌ | Saldo insuficiente! Você tem ${account.balance.toLocaleString()}$ no banco`, threadID, messageID);
            }
            // 🔥 ATUALIZA BANCO
            account.balance -= amount;
            // 🔥 ATUALIZA CARTEIRA
            updateUserMoney(userId, walletMoney + amount);
            addHistory(userId, 'withdraw', amount, 'Saque da conta');
            saveBank(loadBank());
            return api.sendMessage(
                `✅ **SAQUE REALIZADO!**\n💰 ${amount.toLocaleString()}$\n💵 Carteira: ${(walletMoney + amount).toLocaleString()}$\n🏦 Banco: ${account.balance.toLocaleString()}$`,
                threadID,
                messageID
            );
        }

        // 🔥 ==================== TRANSFERIR ====================
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

            // 🔥 GARANTE QUE O DESTINATÁRIO EXISTE
            const targetData = ensureUserExists(targetId, targetName);
            const targetAccount = targetData.bank;

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

            account.balance -= amount;
            targetAccount.balance += amount;
            addHistory(userId, 'transfer_out', amount, `Transferência para ${targetName}`);
            addHistory(targetId, 'transfer_in', amount, `Transferência de ${name}`);
            saveBank(loadBank());
            return api.sendMessage(
                `✅ **TRANSFERÊNCIA REALIZADA!**\n📤 Para: ${targetName}\n💰 ${amount.toLocaleString()}$\n🏦 Saldo: ${account.balance.toLocaleString()}$`,
                threadID,
                messageID
            );
        }

        // 🔥 ==================== PAGAR CONTA ====================
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
                `✅ **CONTA PAGA!**\n${bill.emoji} ${billType.toUpperCase()}: ${amount.toLocaleString()}$\n🏦 Saldo: ${account.balance.toLocaleString()}$`,
                threadID,
                messageID
            );
        }

        // 🔥 ==================== EXTRATO ====================
        if (action === 'extrato' || action === 'history') {
            const history = account.history || [];
            if (history.length === 0) {
                return api.sendMessage('📭 | Nenhuma transação encontrada!', threadID, messageID);
            }
            let msg = '📊 **EXTRATO BANCÁRIO**\n\n';
            const recent = history.slice(-10).reverse();
            recent.forEach((h) => {
                const emoji = { deposit: '✅', withdraw: '💰', transfer_out: '📤', transfer_in: '📥', bill: '📄', loan: '💳', debt_paid: '💸', interest: '📈' }[h.type] || '📝';
                msg += `${emoji} ${h.description}: ${h.amount.toLocaleString()}$\n   📅 ${h.date}\n\n`;
            });
            return api.sendMessage(msg, threadID, messageID);
        }

        // 🔥 ==================== VERIFICA DÍVIDA ====================
        if (account.debt > 0) {
            const totalMoney = account.balance + walletMoney;
            const doubleDebt = account.debt * 2;
            if (totalMoney >= doubleDebt) {
                const debtAmount = account.debt;
                if (account.balance >= debtAmount) {
                    account.balance -= debtAmount;
                } else {
                    const remaining = debtAmount - account.balance;
                    account.balance = 0;
                    updateUserMoney(userId, Math.max(0, walletMoney - remaining));
                }
                addHistory(userId, 'debt_paid', debtAmount, 'Dívida cobrada pelo banco');
                account.debt = 0;
                account.debtDate = null;
                saveBank(loadBank());
                return api.sendMessage(
                    `💸 **DÍVIDA COBRADA!**\nO banco cobrou ${debtAmount.toLocaleString()}$.\n🏦 Saldo restante: ${account.balance.toLocaleString()}$`,
                    threadID,
                    messageID
                );
            }
        }

        // 🔥 ==================== VER CONTA ====================
        const total = account.balance + walletMoney;
        const debtStatus = account.debt > 0 ? `⚠️ Dívida: ${account.debt.toLocaleString()}$ (1% a cada 30min)` : '✅ Sem dívidas';
        return api.sendMessage(
            `🏦 **${name}**\n\n📞 Telefone: ${account.phone}\n💰 Banco: ${account.balance.toLocaleString()}$\n💵 Carteira: ${walletMoney.toLocaleString()}$\n💎 Total: ${total.toLocaleString()}$\n📊 ${debtStatus}\n📅 Criado: ${account.createdAt}`,
            threadID,
            messageID
        );
    }
};

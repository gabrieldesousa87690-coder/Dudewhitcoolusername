const mongoose = require("mongoose");
const fs = require('fs-extra');
const path = require('path');

// 🔥 CAMINHO DO JSON
const JSON_PATH = path.join(__dirname, '..', 'data', 'usersData.json');

// 🔥 SUA URI DO MONGODB
const URI = 'mongodb+srv://gabrieldesousa0075_db_user:8XLXMWIUfA6KLtR9@cluster0.jwtys.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

module.exports = async function () {
    try {
        // 🔥 1. CONECTA AO MONGODB
        await mongoose.connect(URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Conectado ao MongoDB!');

        // 🔥 2. CRIA O SCHEMA (dentro do próprio código)
        const userSchema = new mongoose.Schema({
            userID: { type: Number, unique: true },
            name: String,
            money: { type: Number, default: 0 },
            exp: { type: Number, default: 0 },
            avatarBio: { type: String, default: '💫 Seja luz neste mundo' },
            avatarBg: { type: String, default: 'default' },
            slotWins: { type: Number, default: 0 },
            slotLosses: { type: Number, default: 0 },
            slotBiggestWin: { type: Number, default: 0 },
            slotTotalBet: { type: Number, default: 0 },
            slotLastPlay: { type: Number, default: 0 },
            workCount: { type: Number, default: 0 },
            workLastReset: { type: Number, default: 0 },
            data: { type: Object, default: {} }
        });

        const User = mongoose.model('User', userSchema);

        // 🔥 3. LÊ O JSON
        let jsonData = [];
        if (fs.existsSync(JSON_PATH)) {
            jsonData = fs.readJSONSync(JSON_PATH);
            console.log(`📂 JSON carregado: ${jsonData.length} usuários`);
        } else {
            console.log('⚠️ JSON não encontrado, criando vazio...');
            fs.ensureDirSync(path.dirname(JSON_PATH));
            fs.writeJSONSync(JSON_PATH, []);
        }

        // 🔥 4. SOBRESCREVE OS DADOS NO MONGODB
        if (jsonData.length > 0) {
            console.log('🔄 Migrando dados para o MongoDB...');
            
            for (const user of jsonData) {
                const userId = parseInt(user.userID);
                
                const mongoUser = {
                    userID: userId,
                    name: user.name || `User_${userId}`,
                    money: user.money || 0,
                    exp: user.exp || 0,
                    avatarBio: user.data?.avatar_bio || '💫 Seja luz neste mundo',
                    avatarBg: user.data?.avatar_bg || 'default',
                    slotWins: user.data?.slot_wins || 0,
                    slotLosses: user.data?.slot_losses || 0,
                    slotBiggestWin: user.data?.slot_biggest_win || 0,
                    slotTotalBet: user.data?.slot_total_bet || 0,
                    slotLastPlay: user.data?.slot_last_play || 0,
                    workCount: user.data?.work_count || 0,
                    workLastReset: user.data?.work_last_reset || 0,
                    data: user.data || {}
                };

                await User.findOneAndUpdate(
                    { userID: userId },
                    mongoUser,
                    { upsert: true, new: true }
                );
            }
            
            console.log(`✅ ${jsonData.length} usuários migrados para o MongoDB!`);
        } else {
            console.log('📭 Nenhum dado para migrar (JSON vazio)');
        }

        // 🔥 5. RETORNA O MODELO E FUNÇÕES
        return {
            User,
            // 🔥 FUNÇÕES QUE OS COMANDOS USAM
            get: async (userID) => await User.findOne({ userID }),
            set: async (userID, data) => await User.findOneAndUpdate(
                { userID },
                data,
                { upsert: true, new: true }
            ),
            getAll: async () => await User.find({}),
            existsSync: async (userID) => {
                const user = await User.findOne({ userID });
                return user !== null;
            },
            create: async (userID, userInfo) => {
                const user = new User({ userID, ...userInfo });
                return await user.save();
            },
            getAvatarUrl: (userID) => `https://graph.facebook.com/${userID}/picture?width=500&height=500`,
            getName: async (userID) => {
                const user = await User.findOne({ userID });
                return user ? user.name : null;
            },
            getMoney: async (userID) => {
                const user = await User.findOne({ userID });
                return user ? user.money : 0;
            },
            addMoney: async (userID, amount) => await User.findOneAndUpdate(
                { userID },
                { $inc: { money: amount } },
                { upsert: true, new: true }
            ),
            subtractMoney: async (userID, amount) => await User.findOneAndUpdate(
                { userID },
                { $inc: { money: -amount } },
                { upsert: true, new: true }
            )
        };

    } catch (error) {
        console.error('❌ Erro no connectDB:', error.message);
        throw error;
    }
};

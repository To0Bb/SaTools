const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// ============= إعدادات الأمان =============
const JWT_SECRET = 'SaTool_Super_Secret_Key_2025_ChangeThisInProduction';
const SALT_ROUNDS = 10;

// ============= MongoDB Connection =============
const MONGODB_URI = "mongodb+srv://alkaabisaeed171_db_user:6kHZvg7HCCXajtvS@satools.a0enlnp.mongodb.net/?appName=SaTools";
const client = new MongoClient(MONGODB_URI);

let db;
let usersCollection;
let sessionsCollection;
let logsCollection;

async function connectDB() {
    try {
        await client.connect();
        db = client.db('satools');
        usersCollection = db.collection('users');
        sessionsCollection = db.collection('sessions');
        logsCollection = db.collection('logs');
        
        // إنشاء المستخدم الأدمن إذا لم يكن موجود
        const adminExists = await usersCollection.findOne({ isAdmin: true });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('Admin@123', SALT_ROUNDS);
            await usersCollection.insertOne({
                username: 'Admin',
                email: 'admin@satool.com',
                password: hashedPassword,
                isAdmin: true,
                points: 999999,
                createdAt: new Date(),
                lastLogin: null
            });
            console.log('✅ تم إنشاء حساب الأدمن الافتراضي');
        }
        
        console.log('✅ تم الاتصال بقاعدة البيانات MongoDB');
    } catch (error) {
        console.error('❌ خطأ في الاتصال بقاعدة البيانات:', error);
    }
}
connectDB();

// ============= Rate Limiting (منع الهجمات) =============
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 100, // حد أقصى 100 طلب لكل IP
    message: { error: 'عدد الطلبات كبير جداً، حاول مرة أخرى بعد 15 دقيقة' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', limiter);

// ============= Middleware التحقق من التوكن =============
async function verifyToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'غير مصرح، يرجى تسجيل الدخول' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const session = await sessionsCollection.findOne({ token: token, active: true });
        if (!session || session.expiresAt < new Date()) {
            return res.status(401).json({ error: 'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى' });
        }
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'رمز غير صالح' });
    }
}

// ============= تسجيل الدخول =============
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const user = await usersCollection.findOne({ username: username });
        if (!user) {
            return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            await logsCollection.insertOne({ type: 'failed_login', username, ip: req.ip, timestamp: new Date() });
            return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }
        
        // إنشاء توكن JWT
        const token = jwt.sign({ id: user._id, username: user.username, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '1h' });
        
        // حفظ الجلسة
        await sessionsCollection.insertOne({
            token: token,
            userId: user._id,
            username: user.username,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 60 * 60 * 1000), // ساعة واحدة
            active: true,
            ip: req.ip
        });
        
        // تحديث آخر تسجيل دخول
        await usersCollection.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
        
        // تسجيل العملية
        await logsCollection.insertOne({ type: 'login', username, ip: req.ip, timestamp: new Date() });
        
        res.json({
            success: true,
            token: token,
            user: {
                id: user._id,
                username: user.username,
                isAdmin: user.isAdmin,
                points: user.points
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'خطأ في السيرفر' });
    }
});

// ============= تسجيل مستخدم جديد =============
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'يرجى ملء جميع الحقول' });
    }
    
    try {
        const existingUser = await usersCollection.findOne({ $or: [{ username: username }, { email: email }] });
        if (existingUser) {
            return res.status(400).json({ error: 'اسم المستخدم أو البريد موجود مسبقاً' });
        }
        
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const newUser = {
            username,
            email: email || '',
            password: hashedPassword,
            isAdmin: false,
            points: 100,
            createdAt: new Date(),
            lastLogin: null
        };
        
        const result = await usersCollection.insertOne(newUser);
        
        res.json({ success: true, message: 'تم إنشاء الحساب بنجاح' });
    } catch (error) {
        res.status(500).json({ error: 'خطأ في السيرفر' });
    }
});

// ============= تسجيل الخروج =============
app.post('/api/logout', async (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (token) {
        await sessionsCollection.updateOne({ token: token }, { $set: { active: false } });
    }
    res.json({ success: true });
});

// ============= الحصول على معلومات المستخدم =============
app.get('/api/user', verifyToken, async (req, res) => {
    try {
        const user = await usersCollection.findOne({ _id: new ObjectId(req.user.id) });
        res.json({
            id: user._id,
            username: user.username,
            isAdmin: user.isAdmin,
            points: user.points
        });
    } catch (error) {
        res.status(500).json({ error: 'خطأ في السيرفر' });
    }
});

// ============= تحديث النقاط =============
app.post('/api/update-points', verifyToken, async (req, res) => {
    const { points } = req.body;
    try {
        await usersCollection.updateOne({ _id: new ObjectId(req.user.id) }, { $inc: { points: points } });
        const user = await usersCollection.findOne({ _id: new ObjectId(req.user.id) });
        res.json({ success: true, points: user.points });
    } catch (error) {
        res.status(500).json({ error: 'خطأ في السيرفر' });
    }
});

// ============= الحصول على إحصائيات الموقع =============
app.get('/api/stats', async (req, res) => {
    try {
        const totalUsers = await usersCollection.countDocuments();
        const totalPurchases = await logsCollection.countDocuments({ type: 'purchase' });
        const activeSessions = await sessionsCollection.countDocuments({ active: true, expiresAt: { $gt: new Date() } });
        const todayVisitors = await logsCollection.countDocuments({ type: 'login', timestamp: { $gte: new Date(new Date().setHours(0,0,0,0)) } });
        
        res.json({
            totalUsers,
            totalPurchases,
            todayVisitors,
            activeSessions,
            profit: 0
        });
    } catch (error) {
        res.json({ totalUsers: 0, totalPurchases: 0, todayVisitors: 0, activeSessions: 0, profit: 0 });
    }
});

// ============= حماية من XSS في API =============
function sanitizeInput(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ============= شات الذكاء الاصطناعي =============
app.post('/api/chat', async (req, res) => {
    const { message, username } = req.body;
    const sanitizedMessage = sanitizeInput(message);
    const reply = `🤖 رد على: "${sanitizedMessage}"\n\nالهدف الحالي: example.com\nاسأل عن SQL, XSS, VPN, أو أي شيء آخر!`;
    res.json({ reply: reply });
});

// ============= صفحة رئيسية =============
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============= إغلاق الاتصال عند إيقاف السيرفر =============
process.on('SIGINT', async () => {
    await client.close();
    process.exit();
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`✅ SaTool شغال على http://localhost:${PORT}`);
    console.log(`✅ قاعدة البيانات MongoDB متصلة`);
});
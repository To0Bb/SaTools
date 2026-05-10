const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// قاعدة بيانات مؤقتة
let users = [
    { username: 'Admin', password: 'Admin@123', isAdmin: true, points: 999999 }
];
let sessions = {};

// تسجيل الدخول
app.post('/api/login', (req, res) => {
    console.log('طلب تسجيل دخول:', req.body);
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        const token = 'token_' + Date.now() + '_' + Math.random();
        sessions[token] = { username: user.username, isAdmin: user.isAdmin, points: user.points };
        res.json({ 
            success: true, 
            token: token,
            user: { username: user.username, isAdmin: user.isAdmin, points: user.points }
        });
    } else {
        res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }
});

// تسجيل مستخدم جديد
app.post('/api/register', (req, res) => {
    console.log('طلب تسجيل جديد:', req.body);
    const { username, email, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'يرجى ملء جميع الحقول' });
    }
    
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'اسم المستخدم موجود مسبقاً' });
    }
    
    users.push({ username, email, password, isAdmin: false, points: 100 });
    res.json({ success: true, message: 'تم إنشاء الحساب بنجاح' });
});

// إحصائيات
app.get('/api/stats', (req, res) => {
    res.json({
        totalUsers: users.length,
        totalPurchases: 0,
        todayVisitors: Math.floor(Math.random() * 100),
        activeSessions: Object.keys(sessions).length,
        profit: 0
    });
});

// شات
app.post('/api/chat', (req, res) => {
    const { message, username } = req.body;
    res.json({ reply: `🤖 مرحباً ${username}! رد على: "${message}"\n\nاسأل عن SQL, XSS, VPN, أو أي شيء آخر!` });
});

// الصفحة الرئيسية
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`✅ السيرفر يعمل على http://localhost:${PORT}`);
    console.log(`✅ حساب الأدمن: Admin / Admin@123`);
});
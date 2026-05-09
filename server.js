const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// ============= توكن البوت =============
const BOT_TOKEN = "8763461895:AAEcGKfQlur8t7gD6tbvPq8pGDwdaGVRonQ";

// ============= إرسال نجوم إلى تيليجرام =============
async function sendTelegramStars(chatId, amount, username) {
    const stars = Math.floor(amount * 10);
    
    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: `⭐ *تم تحويل ${stars} نجمة إلى حسابك!*\n\n💰 المبلغ: ${amount}$\n👤 المستخدم: ${username}\n📅 التاريخ: ${new Date().toLocaleString()}\n\nشكراً لاستخدامك *SaTool*! 🚀`,
                parse_mode: 'Markdown'
            })
        });
        
        const data = await response.json();
        return data.ok;
    } catch(error) {
        console.error('Telegram error:', error);
        return false;
    }
}

// ============= API السحب =============
app.post('/api/withdraw', async (req, res) => {
    const { telegramId, amount, adminId, adminUsername } = req.body;
    
    if (adminId !== 'admin_001') {
        return res.json({ success: false, error: 'غير مصرح - أنت لست أدمن' });
    }
    
    let chatId = telegramId;
    
    if (telegramId.startsWith('@')) {
        try {
            const testMsg = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: telegramId,
                    text: "⭐ جاري تجهيز طلب سحب أرباحك من SaTool..."
                })
            });
            const testData = await testMsg.json();
            if(!testData.ok) {
                return res.json({ success: false, error: 'معرف تيليجرام غير صحيح أو البوت لم يبدأ المحادثة مع هذا المستخدم' });
            }
        } catch(e) {
            return res.json({ success: false, error: 'خطأ في الاتصال. تأكد أن المستخدم بدأ المحادثة مع البوت أولاً' });
        }
    }
    
    const result = await sendTelegramStars(chatId, amount, adminUsername);
    
    if (result) {
        res.json({ success: true, message: `تم تحويل ${amount}$ (${Math.floor(amount*10)} نجمة) إلى ${telegramId}` });
    } else {
        res.json({ success: false, error: 'فشل التحويل. تأكد من معرف المستخدم الصحيح وأن البوت نشط' });
    }
});

// ============= API فحص البوت =============
app.get('/api/bot/status', async (req, res) => {
    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
        const data = await response.json();
        res.json({ success: data.ok, bot: data.result });
    } catch(error) {
        res.json({ success: false, error: 'بوت غير متصل' });
    }
});

// ============= AI CHAT BOT =============
app.post('/api/chat', async (req, res) => {
    const { message, username } = req.body;
    let reply = "";
    
    const m = message.toLowerCase();
    if(m.includes('مرحبا') || m.includes('السلام')) reply = `وعليكم السلام يا ${username}! 🌟 كيف أقدر أساعدك؟`;
    else if(m.includes('كيف حالك')) reply = `أنا بخير والحمد لله! كيف حالك أنت يا ${username}؟`;
    else if(m.includes('شكرا')) reply = `العفو يا ${username}! شرفني خدمتك 🤍`;
    else if(m.includes('هاكر') || m.includes('اختراق')) reply = `💀 الهاكر هو شخص ماهر في الأمن السيبراني. أنواعه: وايت هات (أخلاقي)، ريد هات (خبيث)، بلو هات (مدافع)`;
    else if(m.includes('sql')) reply = `💉 SQL Injection: ثغرة تسمح بتنفيذ أوامر SQL على قاعدة البيانات. الحماية: استخدام Prepared Statements`;
    else if(m.includes('xss')) reply = `🌐 XSS: ثغرة تسمح بحقن أكواد JavaScript. الحماية: htmlspecialchars() و CSP`;
    else if(m.includes('vpn')) reply = `🛡️ VPN يخفي عنوان IP ويشفر الاتصال. سيرفراتنا: أمريكا، ألمانيا، هولندا، روسيا`;
    else reply = `📋 سؤالك: "${message}"\n\nأنا بوت SaTool. اسألني عن: SQL Injection, XSS, VPN, هاكر, تعلم الأمن السيبراني, بايثون، أو أي شيء آخر!`;
    
    res.json({ reply: reply });
});

// ============= TOOLS API =============
app.post('/api/tool/run', async (req, res) => {
    const { tool, target } = req.body;
    let result = `✅ **${tool}**\n• الهدف: ${target}\n• اكتمل بنجاح\n• الوقت: ${new Date().toLocaleString()}`;
    res.json({ result: result });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`✅ SaTool شغال على http://localhost:${PORT}`);
    console.log(`✅ بوت تيليجرام متصل: ${BOT_TOKEN.substring(0,20)}...`);
});
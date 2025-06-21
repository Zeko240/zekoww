import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { runBotNewWallet } from './botNewWallet.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 5000;

let botProcess = null;
let botLogs = [];
let botStatus = 'متوقف';

app.use(express.static(__dirname));
app.use(express.json());

// Serve the dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Serve images
app.get('/images/:filename', (req, res) => {
    const filename = req.params.filename;
    const imagePath = path.join(__dirname, filename);
    
    if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
        res.sendFile(imagePath, (err) => {
            if (err) {
                res.status(404).json({ error: 'Image not found' });
            }
        });
    } else {
        res.status(400).json({ error: 'Invalid file type' });
    }
});

// Start bot endpoint
app.post('/start-bot', (req, res) => {
    try {
        if (botProcess) {
            botProcess.kill();
        }
        
        botLogs = [];
        botStatus = 'قيد التشغيل';
        
        botProcess = spawn('node', ['simple-bot.js'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: __dirname
        });
        
        botProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            lines.forEach(line => {
                if (line.trim()) {
                    const translatedLog = translateLog(line.trim());
                    botLogs.push(translatedLog);
                    console.log('New log:', translatedLog); // Debug output
                }
            });
        });
        
        botProcess.stderr.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            lines.forEach(line => {
                if (line.trim()) {
                    botLogs.push(`خطأ: ${line.trim()}`);
                }
            });
        });
        
        botProcess.on('close', (code) => {
            botStatus = 'مكتمل';
            if (code !== 0) {
                botLogs.push(`البوت توقف بالرمز: ${code}`);
            } else {
                botLogs.push('✅ اكتمل تشغيل البوت بنجاح');
            }
        });
        
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Get logs endpoint
app.get('/logs', (req, res) => {
    try {
        // Initialize botLogs if it doesn't exist
        if (!Array.isArray(botLogs)) {
            botLogs = [];
        }
        
        // Ensure logs array exists and has valid entries
        const safeLogs = botLogs.filter(log => log && typeof log === 'string');
        const safeStatus = typeof botStatus === 'string' ? botStatus : 'متوقف';
        
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({
            success: true,
            status: safeStatus,
            logs: safeLogs,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error in /logs endpoint:', error);
        
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({
            success: false,
            status: 'خطأ',
            logs: ['خطأ في جلب السجلات: ' + (error.message || 'خطأ غير معروف')],
            timestamp: new Date().toISOString()
        });
    }
});

// Run bot with new wallet endpoint
app.post('/run-new-wallet', async (req, res) => {
    try {
        botLogs = [];
        botStatus = 'قيد التشغيل - محفظة جديدة';
        
        // تشغيل البوت بمحفظة جديدة
        const result = await runBotNewWallet();
        
        if (result.success) {
            botStatus = 'مكتمل بنجاح';
            botLogs.push('🎉 تم تنفيذ جميع الخطوات بنجاح!');
            botLogs.push(`📄 المحفظة: ${result.wallet}`);
            botLogs.push(`🎯 التوكن: ${result.tokenAddress}`);
            botLogs.push(`🔐 AuthToken: ${result.authToken?.slice(0, 30)}...`);
        } else {
            botStatus = 'فشل';
            botLogs.push('❌ فشل في تنفيذ البوت');
            if (result.errors && result.errors.length > 0) {
                result.errors.forEach(error => {
                    botLogs.push(`❌ ${error}`);
                });
            }
        }
        
        res.json({ 
            success: result.success,
            result: result
        });
        
    } catch (error) {
        botStatus = 'خطأ';
        botLogs.push(`❌ خطأ في تشغيل البوت: ${error.message}`);
        res.json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Translate English log messages to Arabic
function translateLog(logLine) {
    // Remove console color codes
    const cleanLog = logLine.replace(/\u001b\[[0-9;]*m/g, '');
    
    const translations = {
        'Starting simple bot...': '🚀 بدء تشغيل البوت البسيط...',
        'Successfully loaded': '✅ تم تحميل',
        'wallets': 'محافظ',
        'Using wallet:': '✅ استخدام المحفظة:',
        'Going to PumpFun homepage...': '🌐 الانتقال إلى الصفحة الرئيسية لـ PumpFun...',
        'Found': 'تم العثور على',
        'token links': 'روابط عملات',
        'Selected token:': '🎯 العملة المختارة:',
        'Navigating to token page...': '🌐 الانتقال إلى صفحة العملة...',
        'Found welcome popup, clicking': '📋 تم العثور على النافذة المنبثقة، النقر على',
        "I'm ready to pump": "أنا مستعد للضخ",
        'Clicked ready button': '✅ تم النقر على زر الاستعداد',
        'Found comment input': '✅ تم العثور على حقل التعليق',
        'Typed: مرحباً': '📝 تم كتابة: مرحباً',
        'Pressed Enter key, waiting for submission...': '📝 تم الضغط على Enter، انتظار الإرسال...',
        'Comment found on page - successfully posted!': '✅ تم العثور على التعليق في الصفحة - نُشر بنجاح!',
        'Comment not found in page content yet': '⚠️ لم يتم العثور على التعليق في محتوى الصفحة بعد',
        'Waiting additional': '⏰ انتظار إضافي',
        'seconds for comment to process...': 'ثانية لمعالجة التعليق...',
        'Performing final verification...': '🔍 إجراء التحقق النهائي...',
        'SUCCESS! Comment': '🎉 نجح! التعليق',
        'posted successfully!': 'تم نشره بنجاح!',
        'Comment not visible in page text': '⚠️ التعليق غير مرئي في نص الصفحة',
        'Comment still in input field - submission may have failed': '📝 التعليق لا يزال في حقل الإدخال - قد يكون الإرسال فشل',
        'Comment cleared from input - might have been submitted': '📝 تم مسح التعليق من الإدخال - ربما تم إرساله',
        'Token contract:': '📄 عقد العملة:',
        'Token URL:': '🌐 رابط العملة:',
        'Simple bot completed!': '✅ اكتمل البوت البسيط!',
        'Error:': '❌ خطأ:',
        'Node is either not clickable or not an Element': 'العنصر غير قابل للنقر أو ليس عنصراً صحيحاً'
    };
    
    let translatedLog = cleanLog;
    
    // Apply translations
    for (const [english, arabic] of Object.entries(translations)) {
        translatedLog = translatedLog.replace(new RegExp(english, 'gi'), arabic);
    }
    
    // Handle specific patterns
    if (translatedLog.includes('Found') && translatedLog.includes('token links')) {
        const numberMatch = translatedLog.match(/(\d+)/);
        if (numberMatch) {
            translatedLog = `🔍 تم العثور على ${numberMatch[1]} روابط عملات`;
        }
    }
    
    if (translatedLog.includes('Using wallet:')) {
        const walletMatch = translatedLog.match(/([A-Za-z0-9]{8})\.\.\./);
        if (walletMatch) {
            translatedLog = `✅ استخدام المحفظة: ${walletMatch[1]}...`;
        }
    }
    
    if (translatedLog.includes('Selected token:')) {
        const tokenMatch = translatedLog.match(/([A-Za-z0-9]{32,})/);
        if (tokenMatch) {
            translatedLog = `🎯 العملة المختارة: ${tokenMatch[1]}`;
        }
    }
    
    if (translatedLog.includes('Token contract:')) {
        const contractMatch = translatedLog.match(/([A-Za-z0-9]{32,})/);
        if (contractMatch) {
            translatedLog = `📄 عقد العملة: ${contractMatch[1]}`;
        }
    }
    
    return translatedLog;
}

app.listen(port, '0.0.0.0', () => {
    console.log(`🌐 الخادم يعمل على المنفذ ${port}`);
    console.log(`🔗 افتح الرابط: http://localhost:${port}`);
});
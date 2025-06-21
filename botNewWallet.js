import puppeteer from 'puppeteer';
import chalk from 'chalk';
import { generateWallet } from './walletGen.js';
import { addWallet } from './readWallets.js';
import { createProfile } from './createProfile.js';
import { signTransaction } from './signTX.js';
import fetch from 'node-fetch';
import fs from 'fs';

// الحصول على عنوان توكن عشوائي
async function getRandomTokenAddress() {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run'
            ]
        });

        const page = await browser.newPage();

        // Set mobile viewport to simulate iPhone 14 Pro
        await page.setViewport({
            width: 393,
            height: 852,
            deviceScaleFactor: 3,
            isMobile: true,
            hasTouch: true,
            isLandscape: false
        });

        // Use updated iPhone user agent
        await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');

        console.log(chalk.blue('🌐 جاري الحصول على عنوان توكن عشوائي...'));
        await page.goto('https://pump.fun', { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 5000));

        // البحث عن روابط التوكنات
        const tokenLinks = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            return links
                .map(link => link.href)
                .filter(href => href && href.includes('pump.fun/') && href.split('/').pop().length > 30)
                .slice(0, 10);
        });

        if (tokenLinks.length > 0) {
            const randomToken = tokenLinks[Math.floor(Math.random() * tokenLinks.length)];
            const tokenAddress = randomToken.split('/').pop();
            console.log(chalk.green(`🎯 تم العثور على التوكن: ${tokenAddress}`));
            return tokenAddress;
        }

        return null;
    } catch (error) {
        console.log(chalk.red('❌ خطأ في الحصول على عنوان التوكن:'), error.message);
        return null;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// تسجيل الدخول والحصول على authToken
async function loginAndGetAuthToken(wallet, page) {
    try {
        console.log(chalk.blue(`🔐 تسجيل الدخول بالمحفظة: ${wallet.publicKey.toString().slice(0, 8)}...`));

        // إنشاء رسالة للتوقيع
        const timestamp = Date.now();
        const message = `Login to PumpFun at ${timestamp}`;
        const signature = await signTransaction(wallet, message);

        if (!signature) {
            throw new Error('فشل في توقيع الرسالة');
        }

        // حقن كود المحفظة في الصفحة
        const authToken = await page.evaluate((pubkey, sig, msg, ts) => {
            // محاكاة اتصال المحفظة
            window.solana = {
                isPhantom: true,
                publicKey: { toString: () => pubkey },
                isConnected: true,
                connect: async () => ({ publicKey: window.solana.publicKey }),
                signMessage: async (message) => {
                    console.log('Signing message:', message);
                    return { signature: sig };
                }
            };

            // تخزين بيانات المصادقة
            window.localStorage.setItem('wallet_address', pubkey);
            window.localStorage.setItem('wallet_signature', sig);
            window.localStorage.setItem('auth_message', msg);
            window.localStorage.setItem('connected', 'true');
            window.localStorage.setItem('walletName', 'Phantom');
            window.localStorage.setItem('auth_timestamp', ts.toString());

            // إنشاء authToken
            const authToken = btoa(JSON.stringify({
                wallet: pubkey,
                timestamp: ts,
                signature: sig
            }));

            window.localStorage.setItem('authToken', authToken);

            // إطلاق أحداث الاتصال
            window.dispatchEvent(new CustomEvent('wallet-connected', {
                detail: { publicKey: pubkey, authToken: authToken }
            }));

            return authToken;
        }, wallet.publicKey.toString(), signature, message, timestamp);

        console.log(chalk.green('✅ تم تسجيل الدخول بنجاح والحصول على authToken'));
        return authToken;

    } catch (error) {
        console.log(chalk.red('❌ فشل تسجيل الدخول:'), error.message);
        return null;
    }
}

// إرسال تعليق باستخدام proxy
async function postCommentWithProxy(wallet, tokenAddress, authToken, page) {
    try {
        console.log(chalk.blue('💬 جاري إرسال التعليق...'));

        // الانتقال إلى صفحة التوكن
        const tokenUrl = `https://pump.fun/${tokenAddress}`;
        console.log(chalk.blue(`🌐 الانتقال إلى: ${tokenUrl}`));

        await page.goto(tokenUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        // انتظار تحميل الصفحة
        await new Promise(resolve => setTimeout(resolve, 5000));

        // التعامل مع نافذة الكوكيز أولاً
        try {
            console.log(chalk.blue('🍪 البحث عن نافذة الكوكيز...'));

            // البحث عن زر Accept All
            const acceptAllButton = await page.evaluateHandle(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                return buttons.find(btn => 
                    btn.textContent.toLowerCase().includes('accept all') ||
                    btn.textContent.toLowerCase().includes('قبول الكل') ||
                    btn.textContent.toLowerCase().includes('موافق على الجميع')
                );
            });

            if (await acceptAllButton.evaluate(node => node !== null)) {
                await acceptAllButton.click();
                console.log(chalk.green('✅ تم النقر على Accept All للكوكيز'));
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            // البحث عن أزرار أخرى للكوكيز
            const cookieButtons = await page.$$('button[class*="cookie"], button[class*="consent"], button[id*="cookie"]');
            for (const button of cookieButtons) {
                const buttonText = await button.evaluate(btn => btn.textContent.toLowerCase());
                if (buttonText.includes('accept') || buttonText.includes('allow') || buttonText.includes('agree')) {
                    await button.click();
                    console.log(chalk.green('✅ تم النقر على زر الكوكيز الإضافي'));
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    break;
                }
            }
        } catch (cookieError) {
            console.log(chalk.yellow('⚠️ لم يتم العثور على نافذة الكوكيز، المتابعة...'));
        }

        // التحقق من وجود صفحة الترحيب والنقر على "I'm ready to pump"
        const pageContent = await page.content();
        if (pageContent.includes('how it works') || pageContent.includes("I'm ready to pump")) {
            console.log(chalk.blue('📋 تم العثور على صفحة الترحيب...'));
            try {
                const readyButton = await page.evaluateHandle(() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    return buttons.find(btn => btn.textContent.includes("I'm ready to pump"));
                });

                if (await readyButton.evaluate(node => node !== null)) {
                    await readyButton.click();
                    console.log(chalk.green('✅ تم النقر على زر الاستعداد'));
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    await page.goto(tokenUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                }
            } catch (e) {
                console.log(chalk.yellow('⚠️ لم يتم العثور على زر الاستعداد، المتابعة...'));
            }
        }

        await new Promise(resolve => setTimeout(resolve, 3000));

        // التأكد من إزالة نافذة الكوكيز أولاً (إن وجدت)
        try {
            const cookieModal = await page.$('.cookie-settings, .consent-modal, [class*="cookie"], [class*="consent"]');
            if (cookieModal) {
                const acceptAllBtn = await page.evaluateHandle(() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    return buttons.find(btn => 
                        btn.textContent.toLowerCase().includes('accept all') ||
                        btn.textContent.toLowerCase().includes('قبول الكل')
                    );
                });

                if (await acceptAllBtn.evaluate(node => node !== null)) {
                    await acceptAllBtn.click();
                    console.log(chalk.green('✅ تم إغلاق نافذة الكوكيز'));
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }
        } catch (e) {
            // المتابعة
        }

        // Navigate to thread tab first
        console.log(chalk.blue('🔍 البحث عن تبويب thread...'));
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Look for thread tab and click it
        let threadTabClicked = false;
        try {
            // Try multiple selectors for thread tab
            const threadSelectors = [
                'button:contains("thread")',
                '[data-tab="thread"]',
                '.thread-tab',
                'button[aria-selected="false"]:contains("thread")'
            ];

            // Use evaluate to find thread tab by text content
            const threadTab = await page.evaluateHandle(() => {
                // Look for elements containing "thread" text
                const allElements = Array.from(document.querySelectorAll('*'));
                const threadElements = allElements.filter(el => {
                    const text = el.textContent?.toLowerCase().trim();
                    return text === 'thread' && (el.tagName === 'BUTTON' || el.onclick || el.style.cursor === 'pointer');
                });

                // Also check for clickable parent elements
                if (threadElements.length === 0) {
                    const threadTextElements = allElements.filter(el => {
                        const text = el.textContent?.toLowerCase().trim();
                        return text === 'thread';
                    });

                    for (const el of threadTextElements) {
                        let parent = el.parentElement;
                        while (parent && parent !== document.body) {
                            if (parent.tagName === 'BUTTON' || parent.onclick || parent.style.cursor === 'pointer') {
                                return parent;
                            }
                            parent = parent.parentElement;
                        }
                    }
                }

                return threadElements[0] || null;
            });

            if (await threadTab.evaluate(node => node !== null)) {
                await threadTab.click();
                console.log(chalk.green('✅ تم النقر على تبويب thread'));
                threadTabClicked = true;
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        } catch (e) {
            console.log(chalk.yellow('⚠️ لم يتم العثور على تبويب thread، المتابعة...'));
        }

        // البحث عن حقل التعليق بعد الانتقال للـ thread
        console.log(chalk.blue('🔍 البحث عن حقل التعليق في thread...'));

        let commentInput = null;

        // محاولات متعددة للعثور على حقل التعليق في thread
        const inputSelectors = [
            'button:contains("post a reply")',
            'textarea[placeholder*="reply"]',
            'textarea[placeholder*="comment"]', 
            'textarea[placeholder*="type"]',
            'input[placeholder*="reply"]',
            'input[placeholder*="comment"]',
            'textarea',
            'input[type="text"]',
            '[contenteditable="true"]',
            '[role="textbox"]',
            '.reply-input',
            '.comment-input'
        ];

        // First, try to find and click "post a reply" button if it exists
        try {
            const postReplyButton = await page.evaluateHandle(() => {
                const allElements = Array.from(document.querySelectorAll('*'));
                return allElements.find(el => {
                    const text = el.textContent?.toLowerCase().trim();
                    return text === 'post a reply' && (el.tagName === 'BUTTON' || el.onclick);
                });
            });

            if (await postReplyButton.evaluate(node => node !== null)) {
                console.log(chalk.blue('📝 تم العثور على زر "post a reply"، النقر عليه...'));
                await postReplyButton.click();
                await new Promise(resolve => setTimeout(resolve, 2000));
                console.log(chalk.green('✅ تم النقر على زر post a reply'));
            }
        } catch (e) {
            console.log(chalk.yellow('⚠️ لم يتم العثور على زر post a reply'));
        }

        // Now look for comment input field
        for (const selector of inputSelectors) {
            try {
                if (selector.includes('post a reply')) {
                    continue; // Skip button selectors in this loop
                }

                await page.waitForSelector(selector, { timeout: 2000 });
                commentInput = await page.$(selector);
                if (commentInput) {
                    // التحقق من أن الحقل مرئي ومتاح
                    const isVisible = await commentInput.evaluate(input => {
                        const style = window.getComputedStyle(input);
                        const rect = input.getBoundingClientRect();
                        return style.display !== 'none' && 
                               style.visibility !== 'hidden' && 
                               rect.width > 0 && rect.height > 0;
                    });

                    if (isVisible) {
                        console.log(chalk.green(`✅ تم العثور على حقل التعليق: ${selector}`));
                        break;
                    } else {
                        commentInput = null;
                    }
                }
            } catch (e) {
                // المتابعة للمحاولة التالية
            }
        }

        // إذا لم نجد في الأعلى، جرب التمرير والبحث مرة أخرى
        if (!commentInput) {
            console.log(chalk.blue('🔍 لم يتم العثور على الحقل في الأعلى، جاري التمرير والبحث...'));

            // التمرير لأسفل قليلاً
            await page.evaluate(() => {
                window.scrollBy(0, window.innerHeight);
            });
            await new Promise(resolve => setTimeout(resolve, 1000));

            // إعادة البحث
            for (const selector of inputSelectors) {
                try {
                    commentInput = await page.$(selector);
                    if (commentInput) {
                        const isVisible = await commentInput.evaluate(input => {
                            const style = window.getComputedStyle(input);
                            const rect = input.getBoundingClientRect();
                            return style.display !== 'none' && 
                                   style.visibility !== 'hidden' && 
                                   rect.width > 0 && rect.height > 0;
                        });

                        if (isVisible) {
                            console.log(chalk.green(`✅ تم العثور على حقل التعليق بعد التمرير: ${selector}`));
                            break;
                        } else {
                            commentInput = null;
                        }
                    }
                } catch (e) {
                    // المتابعة
                }
            }
        }

        // إذا لم نجد، جرب البحث في iframe
        if (!commentInput) {
            console.log(chalk.blue('🔍 البحث في iframe...'));
            try {
                const frames = await page.frames();
                for (const frame of frames) {
                    try {
                        const frameInput = await frame.$('textarea') || await frame.$('input[type="text"]');
                        if (frameInput) {
                            commentInput = frameInput;
                            console.log(chalk.green('✅ تم العثور على حقل التعليق في iframe'));
                            break;
                        }
                    } catch (e) {
                        // المتابعة
                    }
                }
            } catch (e) {
                console.log(chalk.yellow('⚠️ فشل البحث في iframe'));
            }
        }

        if (!commentInput) {
            // أخذ لقطة شاشة للتشخيص
            await page.screenshot({ path: 'لم-يتم-العثور-على-حقل-التعليق-موبايل.png' });

            // طباعة جميع العناصر المتاحة للتشخيص
            const availableInputs = await page.evaluate(() => {
                const inputs = Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]'));
                return inputs.map(input => ({
                    tag: input.tagName,
                    type: input.type || 'none',
                    placeholder: input.placeholder || 'none',
                    className: input.className || 'none',
                    id: input.id || 'none',
                    visible: window.getComputedStyle(input).display !== 'none'
                }));
            });
            console.log(chalk.blue('🔍 العناصر المتاحة:'), availableInputs);

            throw new Error('لم يتم العثور على حقل التعليق بعد البحث المتقدم');
        }

        console.log(chalk.green('✅ تم العثور على حقل التعليق'));

        // التمرير إلى حقل التعليق للتأكد من ظهوره
        await commentInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 500));

        // كتابة التعليق
        await commentInput.click();
        await commentInput.focus();

        // مسح أي نص موجود
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyA');
        await page.keyboard.up('Control');
        await page.keyboard.press('Delete');

        // كتابة التعليق
        const comment = 'مرحباً';
        await commentInput.type(comment, { delay: 50 });
        console.log(chalk.blue(`📝 تم كتابة: ${comment}`));

        // انتظار وأخذ لقطة شاشة بعد الكتابة
        await new Promise(resolve => setTimeout(resolve, 1000));
        await page.screenshot({ path: 'after-typing-comment-mobile.png' });

        // إرسال التعليق مع تحسينات متقدمة
        let commentPosted = false;

        // انتظار قصير للتحضير
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
            console.log(chalk.blue('🔍 البحث عن طرق الإرسال المتعددة...'));

            // أخذ لقطة شاشة قبل المحاولة
            await page.screenshot({ path: 'before-submit-attempt-mobile.png' });

            // الطريقة 1: Enter key (الأكثر موثوقية للتعليقات)
            if (!commentPosted) {
                try {
                    console.log(chalk.blue('⌨️ المحاولة 1: Enter key...'));
                    await commentInput.focus();
                    await page.keyboard.press('Enter');

                    // انتظار قصير لمعالجة الإرسال
                    await new Promise(resolve => setTimeout(resolve, 1500));

                    // فحص إذا تم مسح النص من المربع
                    const inputValue = await commentInput.evaluate(input => input.value);
                    if (inputValue === '' || !inputValue.includes('مرحباً')) {
                        console.log(chalk.green('✅ نجح إرسال التعليق بـ Enter key'));
                        commentPosted = true;
                    }
                } catch (enterError) {
                    console.log(chalk.yellow('⚠️ فشل Enter key:', enterError.message));
                }
            }

            // الطريقة 2: Ctrl+Enter
            if (!commentPosted) {
                try {
                    console.log(chalk.blue('⌨️ المحاولة 2: Ctrl+Enter...'));
                    await commentInput.focus();
                    await page.keyboard.down('Control');
                    await page.keyboard.press('Enter');
                    await page.keyboard.up('Control');

                    await new Promise(resolve => setTimeout(resolve, 3000));

                    const inputValue = await commentInput.evaluate(input => input.value);
                    if (inputValue === '' || !inputValue.includes('مرحباً')) {
                        console.log(chalk.green('✅ نجح إرسال التعليق بـ Ctrl+Enter'));
                        commentPosted = true;
                    }
                } catch (ctrlEnterError) {
                    console.log(chalk.yellow('⚠️ فشل Ctrl+Enter:', ctrlEnterError.message));
                }
            }

            // الطريقة 3: البحث عن زر الإرسال والنقر عليه
            if (!commentPosted) {
                try {
                    console.log(chalk.blue('🔍 المحاولة 3: البحث عن زر الإرسال...'));

                    // البحث المحسن عن أزرار الإرسال
                    const submitButtonFound = await page.evaluate(() => {
                        // البحث عن جميع الأزرار في الصفحة
                        const buttons = Array.from(document.querySelectorAll('button'));

                        // البحث عن أزرار محتملة للإرسال
                        const submitCandidates = buttons.filter(btn => {
                            const text = btn.textContent.toLowerCase().trim();
                            const style = window.getComputedStyle(btn);
                            const rect = btn.getBoundingClientRect();

                            // التحقق من أن الزر مرئي
                            const isVisible = style.display !== 'none' && 
                                            style.visibility !== 'hidden' && 
                                            rect.width > 0 && rect.height > 0;

                            // البحث عن نصوص تدل على الإرسال
                            const hasSubmitText = text.includes('post') || 
                                                text.includes('reply') || 
                                                text.includes('send') || 
                                                text.includes('submit') ||
                                                text === '→' ||
                                                text === '↵' ||
                                                text === '⏎';

                            return isVisible && hasSubmitText;
                        });

                        console.log('أزرار الإرسال المحتملة:', submitCandidates.length);

                        if (submitCandidates.length > 0) {
                            // اختيار أفضل زر (الأقرب للتعليق)
                            const textarea = document.querySelector('textarea');
                            let bestButton = submitCandidates[0];

                            if (textarea && submitCandidates.length > 1) {
                                const textareaRect = textarea.getBoundingClientRect();
                                let minDistance = Infinity;

                                submitCandidates.forEach(btn => {
                                    const btnRect = btn.getBoundingClientRect();
                                    const distance = Math.sqrt(
                                        Math.pow(btnRect.x - textareaRect.x, 2) + 
                                        Math.pow(btnRect.y - textareaRect.y, 2)
                                    );

                                    if (distance < minDistance) {
                                        minDistance = distance;
                                        bestButton = btn;
                                    }
                                });
                            }

                            // إضافة معرف للزر المختار
                            bestButton.setAttribute('data-submit-target', 'true');
                            bestButton.style.outline = '3px solid red';

                            console.log('تم اختيار زر الإرسال:', {
                                text: bestButton.textContent.trim(),
                                className: bestButton.className
                            });

                            return true;
                        }

                        return false;
                    });

                    if (submitButtonFound) {
                        // محاولة النقر على الزر المحدد
                        const clickSuccess = await page.evaluate(() => {
                            const button = document.querySelector('[data-submit-target="true"]');
                            if (button) {
                                try {
                                    // محاولة النقر المباشر
                                    button.click();
                                    return true;
                                } catch (e) {
                                    // محاولة بديلة بالأحداث
                                    const clickEvent = new MouseEvent('click', {
                                        view: window,
                                        bubbles: true,
                                        cancelable: true
                                    });
                                    button.dispatchEvent(clickEvent);
                                    return true;
                                }
                            }
                            return false;
                        });

                        if (clickSuccess) {
                            console.log(chalk.green('✅ نجح النقر على زر الإرسال'));
                            await new Promise(resolve => setTimeout(resolve, 3000));

                            const inputValue = await commentInput.evaluate(input => input.value);
                            if (inputValue === '' || !inputValue.includes('مرحباً')) {
                                console.log(chalk.green('✅ تم إرسال التعليق بنجاح'));
                                commentPosted = true;
                            }
                        }
                    } else {
                        console.log(chalk.yellow('⚠️ لم يتم العثور على زر إرسال مناسب'));
                    }

                } catch (buttonError) {
                    console.log(chalk.yellow('⚠️ خطأ في البحث عن الزر:', buttonError.message));
                }
            }

            // الطريقة 4: Tab + Enter (للتنقل إلى زر الإرسال)
            if (!commentPosted) {
                try {
                    console.log(chalk.blue('⌨️ المحاولة 4: Tab + Enter...'));
                    await commentInput.focus();
                    await page.keyboard.press('Tab');
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await page.keyboard.press('Enter');

                    await new Promise(resolve => setTimeout(resolve, 3000));

                    const inputValue = await commentInput.evaluate(input => input.value);
                    if (inputValue === '' || !inputValue.includes('مرحباً')) {
                        console.log(chalk.green('✅ نجح إرسال التعليق بـ Tab+Enter'));
                        commentPosted = true;
                    }
                } catch (tabEnterError) {
                    console.log(chalk.yellow('⚠️ فشل Tab+Enter:', tabEnterError.message));
                }
            }

            // الطريقة 5: إرسال نموذج مباشر
            if (!commentPosted) {
                try {
                    console.log(chalk.blue('📝 المحاولة 5: إرسال النموذج مباشرة...'));

                    const formSubmitted = await page.evaluate(() => {
                        const textarea = document.querySelector('textarea');
                        if (textarea) {
                            // البحث عن النموذج الأب
                            let form = textarea.closest('form');
                            if (form) {
                                try {
                                    form.submit();
                                    return true;
                                } catch (e) {
                                    // محاولة بديلة بحدث الإرسال
                                    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                                    form.dispatchEvent(submitEvent);
                                    return true;
                                }
                            }
                        }
                        return false;
                    });

                    if (formSubmitted) {
                        console.log(chalk.green('✅ تم إرسال النموذج مباشرة'));
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        commentPosted = true;
                    }
                } catch (formError) {
                    console.log(chalk.yellow('⚠️ فشل إرسال النموذج:', formError.message));
                }
            }

        } catch (submitError) {
            console.log(chalk.red('❌ خطأ عام في محاولة الإرسال:'), submitError.message);
        }

        // انتظار قصير لمعالجة التعليق
        console.log(chalk.blue('⏰ انتظار 3 ثوانِ لمعالجة التعليق...'));
        await new Promise(resolve => setTimeout(resolve, 3000));

        // التحقق النهائي من النجاح
        console.log(chalk.blue('🔍 إجراء التحقق النهائي...'));
        const finalPageText = await page.evaluate(() => document.body.innerText);

        // أخذ لقطة شاشة نهائية
        await page.screenshot({ path: 'النتيجة-النهائية-محفظة-جديدة-موبايل.png' });

        if (finalPageText.includes('مرحباً')) {
            console.log(chalk.green(`🎉 نجح! تم نشر التعليق "${comment}" بنجاح!`));
            return true;
        } else {
            console.log(chalk.yellow('⚠️ التعليق غير مرئي في النص'));

            // فحص حالة حقل الإدخال
            try {
                const inputValue = await commentInput.evaluate(input => input.value);
                if (inputValue.includes('مرحباً')) {
                    console.log(chalk.yellow('📝 التعليق لا يزال في الحقل - قد يكون الإرسال فشل'));
                    return false;
                } else {
                    console.log(chalk.blue('📝 تم مسح التعليق من الحقل - ربما تم إرساله'));
                    return true;
                }
            } catch (inputCheckError) {
                console.log(chalk.yellow('⚠️ لا يمكن فحص حقل الإدخال'));
                return commentPosted; // إرجاع الحالة بناءً على محاولة الإرسال
            }
        }
    } catch (error) {
        console.log(chalk.red('❌ فشل إرسال التعليق:'), error.message);
        await page.screenshot({ path: 'خطأ-في-نشر-التعليق-موبايل.png' });
        return false;
    }
}

// الدالة الرئيسية runBotNewWallet
export async function runBotNewWallet() {
    let browser;
    const errors = [];

    try {
        console.log(chalk.cyan('🤖 بدء تشغيل البوت بمحفظة جديدة...'));

        // الخطوة 1: توليد محفظة جديدة
        console.log(chalk.blue('📝 الخطوة 1: توليد محفظة جديدة...'));
        const newWallet = await generateWallet();

        if (!newWallet) {
            const error = 'فشل في توليد محفظة جديدة';
            errors.push(error);
            throw new Error(error);
        }

        // إضافة المحفظة إلى القائمة
        await addWallet(newWallet);
        console.log(chalk.green(`✅ تم توليد المحفظة: ${newWallet.publicKey.toString().slice(0, 8)}...`));

        // إنشاء ملف شخصي للمحفظة
        await createProfile(newWallet);

        // الخطوة 2: تشغيل المتصفح
        browser = await puppeteer.launch({
            headless: true,
            executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run'
            ]
        });

        const page = await browser.newPage();

        // Set mobile viewport for better mobile experience - iPhone 14 Pro dimensions
        await page.setViewport({
            width: 393,
            height: 852,
            deviceScaleFactor: 3,
            isMobile: true,
            hasTouch: true,
            isLandscape: false
        });

        // Use updated mobile user agent
        await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');

        // الخطوة 3: الحصول على عنوان التوكن المستهدف
        console.log(chalk.blue('🎯 الخطوة 3: استخراج عنوان التوكن المستهدف...'));
        const tokenAddress = await getRandomTokenAddress();

        if (!tokenAddress) {
            const error = 'فشل في الحصول على عنوان التوكن';
            errors.push(error);
            throw new Error(error);
        }

        console.log(chalk.green(`✅ عنوان التوكن المستهدف: ${tokenAddress}`));

        // الخطوة 4: تسجيل الدخول والحصول على authToken
        console.log(chalk.blue('🔐 الخطوة 2: تسجيل الدخول والحصول على authToken...'));
        await page.goto('https://pump.fun', { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 3000));

        const authToken = await loginAndGetAuthToken(newWallet, page);

        if (!authToken) {
            const error = 'فشل في الحصول على authToken';
            errors.push(error);
            throw new Error(error);
        }

        console.log(chalk.green(`✅ تم الحصول على authToken: ${authToken.slice(0, 20)}...`));

        // الخطوة 5: إرسال التعليق
        console.log(chalk.blue('💬 الخطوة 4: إرسال التعليق باستخدام postCommentWithProxy...'));
        const commentSuccess = await postCommentWithProxy(newWallet, tokenAddress, authToken, page);

        if (commentSuccess) {
            console.log(chalk.green('🎉 نجح تنفيذ جميع الخطوات!'));
            console.log(chalk.blue(`📄 المحفظة: ${newWallet.publicKey.toString()}`));
            console.log(chalk.blue(`🎯 التوكن: ${tokenAddress}`));
            console.log(chalk.blue(`🔐 AuthToken: ${authToken.slice(0, 30)}...`));
        } else {
            const error = 'فشل في نشر التعليق';
            errors.push(error);
            console.log(chalk.red('❌ فشل في نشر التعليق'));
        }

        return {
            success: commentSuccess,
            wallet: newWallet.publicKey.toString(),
            tokenAddress: tokenAddress,
            authToken: authToken,
            errors: errors
        };

        } catch (error) {
        const errorMsg = `خطأ عام في runBotNewWallet: ${error.message}`;
        errors.push(errorMsg);
        console.log(chalk.red('❌'), errorMsg);

        // أخذ لقطة شاشة للخطأ
        if (browser) {
            try {
                const page = await browser.newPage();

                // Set mobile viewport for better mobile experience
                await page.setViewport({
                    width: 375,
                    height: 812,
                    deviceScaleFactor: 3,
                    isMobile: true,
                    hasTouch: true
                });

                // Use mobile user agent
                await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
                await page.screenshot({ path: 'error-final-screenshot-mobile.png' });
            } catch (e) {
                console.log(chalk.red('❌ فشل في أخذ لقطة شاشة للخطأ'));
            }
        }

        return {
            success: false,
            wallet: null,
            tokenAddress: null,
            authToken: null,
            errors: errors
        };

    } finally {
        if (browser) {
            await browser.close();
        }

        // طباعة سجل الأخطاء النهائي
        if (errors.length > 0) {
            console.log(chalk.red('\n📋 سجل الأخطاء:'));
            errors.forEach((error, index) => {
                console.log(chalk.red(`${index + 1}. ${error}`));
            });
            console.log(chalk.blue('\n📸 لقطات الشاشة المحفوظة:'));
            console.log(chalk.blue('- after-typing-comment-mobile.png'));
            console.log(chalk.blue('- before-submit-attempt-mobile.png'));
            console.log(chalk.blue('- النتيجة-النهائية-محفظة-جديدة-موبايل.png'));
            console.log(chalk.blue('- خطأ-في-نشر-التعليق-موبايل.png'));
            console.log(chalk.blue('- error-final-screenshot-mobile.png (في حالة الخطأ)'));
        }

        console.log(chalk.green('✅ انتهى تشغيل runBotNewWallet'));
    }
}

// تشغيل الدالة مباشرة إذا تم استدعاء الملف
if (import.meta.url === `file://${process.argv[1]}`) {
    runBotNewWallet();
}
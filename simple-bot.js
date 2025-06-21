import puppeteer from 'puppeteer';
import chalk from 'chalk';
import { readWallets } from './readWallets.js';

// Simple bot to post one comment on PumpFun
async function simpleBot() {
    let browser;

    try {
        console.log(chalk.blue('🚀 Starting simple bot...'));

        // Load wallets
        const wallets = await readWallets();
        if (!wallets || wallets.length === 0) {
            console.log(chalk.red('❌ No wallets found'));
            return;
        }

        const wallet = wallets[0];
        console.log(chalk.green(`✅ Using wallet: ${wallet.publicKey.toString().slice(0, 8)}...`));

        // Launch browser with mobile emulation
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

        // Set mobile viewport and user agent for iPhone
        await page.setViewport({
            width: 375,
            height: 812,
            deviceScaleFactor: 3,
            isMobile: true,
            hasTouch: true,
            isLandscape: false
        });

        await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1');

        // Go to PumpFun homepage
        console.log(chalk.blue('🌐 الانتقال إلى صفحة PumpFun الرئيسية...'));
        await page.goto('https://pump.fun', { waitUntil: 'domcontentloaded', timeout: 20000 });

        // Wait shorter time and take mobile screenshot
        await new Promise(resolve => setTimeout(resolve, 2000));
        await page.screenshot({ path: 'homepage-mobile.png' });

        // Find token links with faster method
        const tokenLinks = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href*="/"]'));
            return links
                .map(link => link.href)
                .filter(href => {
                    const tokenPart = href.split('/').pop();
                    return tokenPart && tokenPart.length > 30 && /^[A-Za-z0-9]+$/.test(tokenPart);
                })
                .slice(0, 5); // Reduce to 5 for faster processing
        });

        console.log(chalk.blue(`🔍 Found ${tokenLinks.length} token links`));

        if (tokenLinks.length > 0) {
            // Pick random token
            const randomToken = tokenLinks[Math.floor(Math.random() * tokenLinks.length)];
            const tokenAddress = randomToken.split('/').pop();

            console.log(chalk.green(`🎯 Selected token: ${tokenAddress}`));
            console.log(chalk.blue(`🌐 Navigating to token page...`));

            // Go to token page with faster loading
            await page.goto(randomToken, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Check if we're on the "how it works" page and need to proceed
            const pageContent = await page.content();
            if (pageContent.includes('how it works') || pageContent.includes("I'm ready to pump")) {
                console.log(chalk.blue('📋 Found welcome popup, clicking "I\'m ready to pump"'));
                try {
                    const readyButton = await page.evaluateHandle(() => {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        return buttons.find(btn => btn.textContent.includes("I'm ready to pump"));
                    });

                    if (await readyButton.evaluate(node => node !== null)) {
                        await readyButton.click();
                        console.log(chalk.green('✅ Clicked ready button'));
                        await new Promise(resolve => setTimeout(resolve, 3000));

                        // Navigate to token page again after dismissing popup
                        await page.goto(randomToken, { waitUntil: 'networkidle2', timeout: 30000 });
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                } catch (popupError) {
                    console.log(chalk.yellow('⚠️ Could not dismiss popup, continuing...'));
                }
            }

            // Take screenshot of actual token page
            await page.screenshot({ path: 'token-page.png' });

            // Wait for page to fully load
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Look for comment input
            const commentInput = await page.$('textarea') || await page.$('input[type="text"]');

            if (commentInput) {
                console.log(chalk.green('✅ Found comment input'));

                // Type comment optimized for mobile
                console.log(chalk.blue('📱 كتابة التعليق محسنة للهاتف...'));

                // Focus with mobile tap
                await page.tap('textarea');
                await new Promise(resolve => setTimeout(resolve, 500));

                // Clear existing text (mobile way)
                await page.evaluate(() => {
                    const textarea = document.querySelector('textarea');
                    if (textarea) {
                        textarea.value = '';
                        textarea.focus();
                    }
                });

                // Type with faster delay for mobile
                await commentInput.type('مرحباً 🚀', { delay: 30 });
                console.log(chalk.blue('📝📱 تم كتابة: مرحباً 🚀'));

                // Take screenshot immediately after typing
                await page.screenshot({ path: 'screenshot-after-typing-comment.png' });
                console.log(chalk.blue('📸 تم حفظ لقطة شاشة بعد كتابة التعليق'));

                // Shorter wait and mobile screenshot
                await new Promise(resolve => setTimeout(resolve, 1500));
                await page.screenshot({ path: 'after-typing-mobile.png' });

                // CRITICAL: Take screenshot right here before any failure can occur
                console.log(chalk.blue('📸 CRITICAL: Taking screenshot before any submit logic starts...'));
                await page.screenshot({ path: 'critical-before-failure.png' });

                // Take screenshot specifically before trying to click submit button
                console.log(chalk.blue('📸 Taking screenshot before submit attempt...'));
                await page.screenshot({ path: 'before-submit-attempt.png' });

                // Take comprehensive screenshot of the entire page for debugging
                console.log(chalk.blue('📸 Taking full page screenshot for debugging...'));
                await page.screenshot({ path: 'full-page-debug.png', fullPage: true });

                // Also log the page HTML around the comment area for debugging
                const commentAreaHTML = await page.evaluate(() => {
                    const textarea = document.querySelector('textarea');
                    if (textarea && textarea.parentElement) {
                        return textarea.parentElement.outerHTML;
                    }
                    return 'No textarea parent found';
                });
                console.log(chalk.blue('🔍 Comment area HTML:'), commentAreaHTML);

                // Log all buttons with their properties for debugging
                const allButtonsDebug = await page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    return buttons.map((btn, index) => {
                        const style = window.getComputedStyle(btn);
                        const rect = btn.getBoundingClientRect();
                        return {
                            index: index + 1,
                            text: btn.textContent.trim(),
                            className: btn.className,
                            disabled: btn.disabled,
                            visible: style.display !== 'none' && style.visibility !== 'hidden',
                            inViewport: rect.width > 0 && rect.height > 0,
                            backgroundColor: style.backgroundColor,
                            color: style.color,
                            position: { x: Math.round(rect.x), y: Math.round(rect.y) },
                            size: { width: Math.round(rect.width), height: Math.round(rect.height) }
                        };
                    });
                });
                console.log(chalk.blue('🔍 All buttons debug info:'), JSON.stringify(allButtonsDebug, null, 2));

                // البحث المحسن عن زر الإرسال
                try {
                    console.log(chalk.blue('🔍 البحث المحسن عن زر "post a reply"...'));

                    // البحث بطريقة أكثر دقة عن الزر الأخضر
                    const submitButtonFound = await page.evaluate(() => {
                        // البحث عن الزر باستخدام النص والألوان
                        const buttons = Array.from(document.querySelectorAll('button'));

                        for (let i = 0; i < buttons.length; i++) {
                            const btn = buttons[i];
                            const text = btn.textContent.trim().toLowerCase();
                            const style = window.getComputedStyle(btn);
                            const rect = btn.getBoundingClientRect();

                            // التحقق من النص والرؤية
                            const hasReplyText = text.includes('post a reply') || text.includes('reply') || text.includes('post');
                            const isVisible = style.display !== 'none' && rect.width > 0 && rect.height > 0;
                            const isGreenButton = style.backgroundColor.includes('34, 197, 94') || 
                                                style.backgroundColor.includes('rgb(34, 197, 94)') ||
                                                style.backgroundColor.includes('green');

                            if ((hasReplyText || isGreenButton) && isVisible) {
                                // وضع علامة على الزر
                                btn.setAttribute('data-found-reply-btn', 'true');
                                btn.style.border = '3px solid red';
                                console.log('🎯 تم العثور على زر الإرسال:', text, style.backgroundColor);
                                return true;
                            }
                        }
                        return false;
                    });

                    if (submitButtonFound) {
                        console.log(chalk.green('✅ تم العثور على زر post a reply'));

                        // أخذ لقطة شاشة قبل النقر
                        await page.screenshot({ path: 'before-clicking-reply-button.png' });

                        // جرب طرق متعددة للنقر
                        let clickSuccess = false;

                        // الطريقة 1: النقر المباشر بـ page.click()
                        try {
                            console.log(chalk.blue('🖱️ المحاولة 1: النقر المباشر...'));
                            await page.click('[data-found-reply-btn="true"]');
                            clickSuccess = true;
                            console.log(chalk.green('✅ نجح النقر المباشر'));
                        } catch (e1) {
                            console.log(chalk.yellow('⚠️ فشل النقر المباشر'));

                            // الطريقة 2: النقر بالإحداثيات
                            try {
                                console.log(chalk.blue('📍 المحاولة 2: النقر بالإحداثيات...'));
                                const coords = await page.evaluate(() => {
                                    const btn = document.querySelector('[data-found-reply-btn="true"]');
                                    const rect = btn.getBoundingClientRect();
                                    return {
                                        x: rect.left + rect.width / 2,
                                        y: rect.top + rect.height / 2
                                    };
                                });

                                await page.mouse.click(coords.x, coords.y);
                                clickSuccess = true;
                                console.log(chalk.green('✅ نجح النقر بالإحداثيات'));
                            } catch (e2) {
                                console.log(chalk.yellow('⚠️ فشل النقر بالإحداثيات'));

                                // الطريقة 3: النقر بـ JavaScript
                                try {
                                    console.log(chalk.blue('⚡ المحاولة 3: النقر بـ JavaScript...'));
                                    await page.evaluate(() => {
                                        const btn = document.querySelector('[data-found-reply-btn="true"]');
                                        if (btn) {
                                            btn.click();

                                            // إرسال أحداث إضافية للتأكد
                                            const clickEvent = new MouseEvent('click', {
                                                bubbles: true,
                                                cancelable: true,
                                                view: window
                                            });
                                            btn.dispatchEvent(clickEvent);
                                        }
                                    });
                                    clickSuccess = true;
                                    console.log(chalk.green('✅ نجح النقر بـ JavaScript'));
                                } catch (e3) {
                                    console.log(chalk.red('❌ فشل جميع طرق النقر'));
                                }
                            }
                        }

                        if (clickSuccess) {
                            submitted = true;
                            console.log(chalk.green('🎉 تم النقر على زر الإرسال بنجاح!'));

                            // Take screenshot immediately after clicking submit
                            await page.screenshot({ path: 'screenshot-after-clicking-submit.png' });
                            console.log(chalk.blue('📸 تم حفظ لقطة شاشة بعد النقر على زر الإرسال'));
                        }
                    } else {
                        console.log(chalk.yellow('⚠️ لم يتم العثور على زر post a reply'));
                    }
                } catch (e) {
                    console.log(chalk.red('❌ خطأ في البحث عن زر الإرسال:'), e.message);
                }

                // Method 2: النقر بالإحداثيات كبديل
                if (!submitted) {
                    try {
                        console.log(chalk.blue('🎯 جاري النقر بالإحداثيات...'));

                        // البحث عن الزر وتحديد موقعه
                        const buttonPosition = await page.evaluate(() => {
                            const buttons = Array.from(document.querySelectorAll('button'));

                            for (const btn of buttons) {
                                const text = btn.textContent.trim().toLowerCase();
                                const style = window.getComputedStyle(btn);
                                const rect = btn.getBoundingClientRect();

                                if ((text.includes('post') || text.includes('reply') || 
                                     style.backgroundColor.includes('green') || 
                                     style.backgroundColor.includes('34, 197, 94')) &&
                                    rect.width > 0 && rect.height > 0) {

                                    return {
                                        x: rect.x + rect.width / 2,
                                        y: rect.y + rect.height / 2,
                                        found: true
                                    };
                                }
                            }
                            return { found: false };
                        });

                        if (buttonPosition.found) {
                            console.log(chalk.blue(`🎯 النقر على الإحداثيات: (${buttonPosition.x}, ${buttonPosition.y})`));
                            await page.mouse.click(buttonPosition.x, buttonPosition.y);
                            console.log(chalk.green('✅ نجح النقر بالإحداثيات'));
                            submitted = true;
                        } else {
                            console.log(chalk.yellow('⚠️ لم يتم العثور على موقع الزر'));
                        }

                    } catch (e) {
                        console.log(chalk.yellow('⚠️ فشل النقر بالإحداثيات:', e.message));
                    }
                }

                // Method 2: طريقة Enter المحسنة (غالباً الأكثر نجاحاً)
                if (!submitted) {
                    try {
                        console.log(chalk.blue('⌨️ جاري تجربة طريقة Enter المحسنة...'));

                        // التأكد من التركيز على مربع النص
                        await commentInput.focus();
                        await new Promise(resolve => setTimeout(resolve, 500));

                        // التحقق من أن النص موجود
                        const currentValue = await commentInput.evaluate(input => input.value);
                        console.log(chalk.blue(`📝 النص الحالي في المربع: "${currentValue}"`));

                        if (currentValue.includes('مرحباً')) {
                            // الضغط على Enter مرتين للتأكد
                            await page.keyboard.press('Enter');
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            await page.keyboard.press('Enter');
                            console.log(chalk.green('✅ تم الضغط على Enter مرتين'));

                            // انتظار معالجة الإرسال
                            await new Promise(resolve => setTimeout(resolve, 4000));

                            // التحقق من اختفاء النص من مربع الإدخال
                            const afterValue = await commentInput.evaluate(input => input.value);
                            if (afterValue !== currentValue || afterValue === '') {
                                console.log(chalk.green('✅ تم مسح النص من المربع - نجح الإرسال'));
                                submitted = true;

                                // Take screenshot after successful Enter submission
                                await page.screenshot({ path: 'screenshot-after-enter-submission.png' });
                                console.log(chalk.blue('📸 تم حفظ لقطة شاشة بعد الإرسال بـ Enter'));
                            } else {
                                console.log(chalk.yellow('⚠️ النص لا يزال في المربع'));

                                // Take screenshot showing failed submission
                                await page.screenshot({ path: 'screenshot-failed-submission.png' });
                                console.log(chalk.blue('📸 تم حفظ لقطة شاشة للإرسال الفاشل'));
                            }
                        } else {
                            console.log(chalk.yellow('⚠️ النص غير موجود في المربع'));
                        }

                    } catch (e) {
                        console.log(chalk.yellow('⚠️ فشلت طريقة Enter:', e.message));
                    }
                }

                // Method 2: Try finding any clickable element near the textarea
                if (!submitted) {
                    try {
                        const nearbyClickable = await page.evaluate(() => {
                            const textarea = document.querySelector('textarea');
                            if (textarea) {
                                const parent = textarea.parentElement;
                                const siblings = Array.from(parent.children);
                                const clickableElements = siblings.filter(el => 
                                    el.tagName === 'BUTTON' || 
                                    el.onclick || 
                                    el.classList.contains('clickable') ||
                                    window.getComputedStyle(el).cursor === 'pointer'
                                );
                                return clickableElements.length > 0;
                            }
                            return false;
                        });

                        if (nearbyClickable) {
                            await page.evaluate(() => {
                                const textarea = document.querySelector('textarea');
                                const parent = textarea.parentElement;
                                const siblings = Array.from(parent.children);
                                const button = siblings.find(el => el.tagName === 'BUTTON');
                                if (button) button.click();
                            });
                            console.log(chalk.green('✅ Clicked nearby button'));
                            submitted = true;
                        }
                    } catch (e) {
                        console.log(chalk.yellow('⚠️ Nearby button method failed'));
                    }
                }

                // Method 3: Try Tab then Enter (in case focus is needed)
                if (!submitted) {
                    try {
                        await commentInput.focus();
                        await page.keyboard.press('Tab');
                        await page.keyboard.press('Enter');
                        console.log(chalk.blue('📝 Tried Tab+Enter combination'));

                        // Wait longer for this method too
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        submitted = true;
                    } catch (e) {
                        console.log(chalk.yellow('⚠️ Tab+Enter method failed'));
                    }
                }

                // Faster verification for mobile
                console.log(chalk.blue('⏰📱 انتظار سريع للتحقق من النشر...'));
                await new Promise(resolve => setTimeout(resolve, 4000));

                // Quick final check
                console.log(chalk.blue('🔍📱 التحقق السريع من النتيجة...'));
                const finalPageText = await page.evaluate(() => document.body.innerText);

                // Take final mobile screenshot
                await page.screenshot({ path: 'final-result-mobile.png' });

                if (finalPageText.includes('مرحباً')) {
                    console.log(chalk.green('🎉 SUCCESS! Comment "مرحباً 🚀" posted successfully!'));
                    await page.screenshot({ path: 'نجح-النشر-موبايل.png' });
                    console.log(chalk.blue('📸 تم حفظ لقطة شاشة للتعليق المنشور بنجاح'));
                } else {
                    console.log(chalk.yellow('⚠️ Comment not visible in page text'));

                    // Check if comment is in input field (might still be there if not submitted)
                    const inputValue = await commentInput.evaluate(input => input.value);
                    if (inputValue.includes('مرحباً')) {
                        console.log(chalk.yellow('📝 Comment still in input field - submission may have failed'));
                        await page.screenshot({ path: 'screenshot-comment-still-in-input.png' });
                        console.log(chalk.blue('📸 تم حفظ لقطة شاشة للتعليق الباقي في المربع'));
                    } else {
                        console.log(chalk.blue('📝 Comment cleared from input - might have been submitted'));
                        await page.screenshot({ path: 'screenshot-comment-cleared-from-input.png' });
                        console.log(chalk.blue('📸 تم حفظ لقطة شاشة للتعليق المحذوف من المربع'));
                    }
                }

                console.log(chalk.yellow(`📄 Token contract: ${tokenAddress}`));
                console.log(chalk.blue(`🌐 Token URL: ${randomToken}`));

            } else {
                console.log(chalk.yellow('⚠️ Could not find comment input'));

                // Show all inputs for debugging
                const inputs = await page.evaluate(() => {
                    const allInputs = Array.from(document.querySelectorAll('input, textarea'));
                    return allInputs.map(input => ({
                        tag: input.tagName,
                        type: input.type,
                        placeholder: input.placeholder,
                        className: input.className,
                        visible: window.getComputedStyle(input).display !== 'none'
                    }));
                });
                console.log(chalk.blue('🔍 Available inputs:'), inputs);

                // Also show page title and URL for context
                console.log(chalk.blue('📄 Current page:'), await page.title());
                console.log(chalk.blue('🌐 Current URL:'), page.url());
            }

        } else {
            console.log(chalk.yellow('⚠️ No token links found on homepage'));
        }

    } catch (error) {
        console.log(chalk.red('❌ Error:'), error.message);
    } finally {
        if (browser) {
            await browser.close();
        }
    }

    console.log(chalk.green('✅ Simple bot completed!'));
}

simpleBot();
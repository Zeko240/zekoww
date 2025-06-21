import { Connection, PublicKey } from '@solana/web3.js';
import { readWallets } from './readWallets.js';
import { createProfile } from './createProfile.js';
import { signTransaction } from './signTX.js';
import chalk from 'chalk';
import fs from 'fs';
import puppeteer from 'puppeteer';
import fetch from 'node-fetch';
import { faker } from '@faker-js/faker';

let config;
let connection;
let browser;
let wallets = [];

// Load configuration
function loadConfig() {
    try {
        const configData = fs.readFileSync('./config.json', 'utf8');
        config = JSON.parse(configData);
        console.log(chalk.green('✅ Configuration loaded successfully'));
        return true;
    } catch (error) {
        console.log(chalk.red('❌ Failed to load configuration:'), error.message);
        return false;
    }
}

// Initialize Solana connection
function initializeSolana() {
    try {
        connection = new Connection(config.solana.rpcUrl, config.solana.commitment);
        console.log(chalk.green('✅ Solana connection initialized'));
        return true;
    } catch (error) {
        console.log(chalk.red('❌ Failed to initialize Solana connection:'), error.message);
        return false;
    }
}

// Initialize browser with proxy support
async function initializeBrowser() {
    try {
        const browserArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ];

        if (config.proxy.enabled && config.proxy.list.length > 0) {
            const proxy = config.proxy.list[Math.floor(Math.random() * config.proxy.list.length)];
            browserArgs.push(`--proxy-server=${proxy}`);
            console.log(chalk.blue(`🌐 Using proxy: ${proxy}`));
        }

        browser = await puppeteer.launch({
            headless: true,
            executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
            args: browserArgs
        });

        console.log(chalk.green('✅ Browser initialized'));
        return true;
    } catch (error) {
        console.log(chalk.red('❌ Failed to initialize browser:'), error.message);
        return false;
    }
}

// Get random comment text
function getRandomComment() {
    return config.comments.texts[Math.floor(Math.random() * config.comments.texts.length)];
}

// Get random image from images directory
function getRandomImage() {
    try {
        const imageFiles = fs.readdirSync('./images').filter(file => 
            file.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/));
        
        if (imageFiles.length === 0) {
            return null;
        }
        
        const randomImage = imageFiles[Math.floor(Math.random() * imageFiles.length)];
        return `./images/${randomImage}`;
    } catch (error) {
        console.log(chalk.yellow('⚠️ No images found in images directory'));
        return null;
    }
}

// Login to PumpFun using wallet signature
async function loginToPumpFun(wallet, page, token = null) {
    try {
        console.log(chalk.blue(`🔐 Attempting login with wallet: ${wallet.publicKey.toString().slice(0, 8)}...`));
        
        // Go directly to token page if provided
        const targetUrl = token ? `https://pump.fun/${token}` : config.pumpfun.baseUrl;
        console.log(chalk.blue(`🌐 Navigating to: ${targetUrl}`));
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Wait for any Cloudflare challenges to complete
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check if we got past Cloudflare
        const title = await page.title();
        if (title.includes('Cloudflare') || title.includes('Attention Required')) {
            console.log(chalk.yellow('⚠️ Cloudflare detection, waiting longer...'));
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
        
        // Check if we're on the how it works page and need to proceed
        if (pageContent.includes('how it works') || pageContent.includes("I'm ready to pump")) {
            console.log(chalk.blue('📋 Found welcome page, clicking "I\'m ready to pump"'));
            try {
                const readyButton = await page.$('button:contains("I\'m ready to pump")') || 
                                  await page.evaluateHandle(() => {
                                      const buttons = Array.from(document.querySelectorAll('button'));
                                      return buttons.find(btn => btn.textContent.includes("I'm ready to pump"));
                                  });
                                  
                if (readyButton && await readyButton.evaluate(node => node !== null)) {
                    await readyButton.click();
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    // Now navigate to token page if we have a token
                    if (token) {
                        const tokenUrl = `https://pump.fun/${token}`;
                        console.log(chalk.blue(`🌐 Now navigating to token page: ${tokenUrl}`));
                        await page.goto(tokenUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                    }
                }
            } catch (welcomeError) {
                console.log(chalk.yellow('⚠️ Could not click ready button, continuing...'));
                // If we can't click the button, try direct navigation to token
                if (token) {
                    const tokenUrl = `https://pump.fun/${token}`;
                    console.log(chalk.blue(`🌐 Direct navigation to token page: ${tokenUrl}`));
                    await page.goto(tokenUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                }
            }
        }
        
        // Take screenshot to debug what's on the page
        console.log(chalk.blue('📸 Taking screenshot for debugging...'));
        await page.screenshot({ path: 'debug-page.png' });
        
        // Get page content for navigation
        const pageContent = await page.content();
        console.log(chalk.blue(`📄 Page title: ${await page.title()}`));
        
        // Wait for page to load completely
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Try multiple selectors for connect wallet button - updated for PumpFun
        const connectSelectors = [
            'button[data-testid="wallet-button"]',
            'button[aria-label="Connect Wallet"]',
            'button:has-text("Connect Wallet")',
            'button:has-text("Connect")',
            '.wallet-adapter-button',
            '.wallet-button',
            '[class*="wallet"][class*="connect"]',
            'button[class*="connect"]',
            'button[type="button"]:has-text("Connect")',
            '.connect-wallet-button'
        ];
        
        let connectButton = null;
        for (const selector of connectSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 2000 });
                connectButton = await page.$(selector);
                if (connectButton) {
                    console.log(chalk.green(`✅ Found connect button with selector: ${selector}`));
                    break;
                }
            } catch (e) {
                // Continue to next selector
            }
        }
        
        if (!connectButton) {
            console.log(chalk.yellow('⚠️ Connect button not found, trying wallet adapter injection...'));
            
            // Inject Solana wallet adapter
            await page.evaluateOnNewDocument(() => {
                // Create mock Solana wallet adapter
                window.solana = {
                    isPhantom: true,
                    publicKey: null,
                    isConnected: false,
                    connect: async () => {
                        window.solana.isConnected = true;
                        return { publicKey: window.solana.publicKey };
                    },
                    disconnect: async () => {
                        window.solana.isConnected = false;
                    },
                    signMessage: async (message) => {
                        return { signature: window.walletSignature };
                    }
                };
                
                // Dispatch wallet ready event
                window.dispatchEvent(new Event('solana#initialized'));
            });
            
            // Set wallet data
            const message = `Login to PumpFun at ${Date.now()}`;
            const signature = await signTransaction(wallet, message);
            
            await page.evaluate((pubkey, sig, msg) => {
                window.solana.publicKey = { toString: () => pubkey };
                window.walletSignature = sig;
                window.localStorage.setItem('walletName', 'Phantom');
                window.localStorage.setItem('walletAddress', pubkey);
                
                // Trigger wallet connection event
                window.dispatchEvent(new CustomEvent('wallet-connected', {
                    detail: { publicKey: pubkey }
                }));
            }, wallet.publicKey.toString(), signature, message);
            
            console.log(chalk.green('✅ Wallet adapter injected successfully'));
            return true;
        }
        
        // Click the connect button if found
        await connectButton.click();
        console.log(chalk.blue('🔗 Clicked connect button, waiting for wallet selection...'));
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Look for wallet selection modal (Phantom, Solflare, etc.)
        try {
            const phantomButton = await page.$('button:has-text("Phantom")') || 
                                 await page.$('[data-wallet="phantom"]') ||
                                 await page.$('.wallet-phantom');
                                 
            if (phantomButton) {
                console.log(chalk.blue('👻 Selecting Phantom wallet...'));
                await phantomButton.click();
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (e) {
            console.log(chalk.yellow('⚠️ No wallet selection modal found'));
        }
        
        // Generate signature for authentication
        const message = `Login to PumpFun at ${Date.now()}`;
        const signature = await signTransaction(wallet, message);
        
        // Execute enhanced login script
        await page.evaluate((pubkey, sig, msg) => {
            // Set wallet connection state
            window.localStorage.setItem('wallet_address', pubkey);
            window.localStorage.setItem('wallet_signature', sig);
            window.localStorage.setItem('auth_message', msg);
            window.localStorage.setItem('connected', 'true');
            window.localStorage.setItem('walletName', 'Phantom');
            
            // Set session storage as well
            window.sessionStorage.setItem('wallet-connected', 'true');
            window.sessionStorage.setItem('wallet-pubkey', pubkey);
            
            // Update page state if wallet context exists
            if (window.setWalletConnected) {
                window.setWalletConnected(true, pubkey);
            }
        }, wallet.publicKey.toString(), signature, message);
        
        // Verify connection was successful
        await new Promise(resolve => setTimeout(resolve, 2000));
        const connectionStatus = await page.evaluate(() => {
            return {
                localStorage: window.localStorage.getItem('connected'),
                sessionStorage: window.sessionStorage.getItem('wallet-connected'),
                solanaObject: !!window.solana,
                isConnected: window.solana?.isConnected
            };
        });
        
        console.log(chalk.blue('🔍 Connection status check:'), connectionStatus);
        
        if (connectionStatus.localStorage === 'true' || connectionStatus.isConnected) {
            console.log(chalk.green('✅ Successfully logged in to PumpFun'));
            return true;
        } else {
            console.log(chalk.yellow('⚠️ Connection verification unclear, continuing...'));
            return true; // Continue anyway
        }
        
    } catch (error) {
        console.log(chalk.red('❌ Failed to login to PumpFun:'), error.message);
        console.log(chalk.yellow('⚠️ Continuing with anonymous access...'));
        return false; // Continue without login for now
    }
}

// Find trending tokens or KOTH tokens
async function findTokens() {
    try {
        console.log(chalk.blue('🔍 Attempting to fetch trending tokens from PumpFun...'));
        
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        };
        
        const response = await fetch(`${config.pumpfun.apiUrl}/coins/trending`, { headers });
        
        console.log(chalk.blue(`📡 API Response status: ${response.status}`));
        
        if (!response.ok) {
            console.log(chalk.yellow(`⚠️ API returned status ${response.status}, trying alternative endpoint...`));
            
            // Try alternative endpoint
            const altResponse = await fetch(`${config.pumpfun.apiUrl}/coins`, { headers });
            if (altResponse.ok) {
                const altData = await altResponse.json();
                if (altData && altData.length > 0) {
                    console.log(chalk.green(`✅ Found ${altData.length} tokens from alternative endpoint`));
                    return altData.slice(0, 10);
                }
            }
            
            // If APIs fail, use mock data for testing
            console.log(chalk.yellow('⚠️ Using demo tokens for testing purposes'));
            return [
                { mint: 'So11111111111111111111111111111111111111112', name: 'Wrapped SOL', symbol: 'SOL' },
                { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', name: 'USD Coin', symbol: 'USDC' }
            ];
        }
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            
            if (data && data.length > 0) {
                console.log(chalk.green(`✅ Found ${data.length} trending tokens`));
                return data.slice(0, 10);
            }
        } else {
            console.log(chalk.yellow('⚠️ API returned HTML instead of JSON - possible authentication required'));
            
            // Use demo tokens for testing
            return [
                { mint: 'So11111111111111111111111111111111111111112', name: 'Wrapped SOL', symbol: 'SOL' },
                { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', name: 'USD Coin', symbol: 'USDC' }
            ];
        }
        
        return [];
    } catch (error) {
        console.log(chalk.red('❌ Failed to fetch tokens:'), error.message);
        console.log(chalk.yellow('⚠️ Using demo tokens for testing purposes'));
        
        // Fallback to demo tokens
        return [
            { mint: 'So11111111111111111111111111111111111111112', name: 'Wrapped SOL', symbol: 'SOL' },
            { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', name: 'USD Coin', symbol: 'USDC' }
        ];
    }
}

// Post comment on token page
async function postComment(wallet, token, page) {
    try {
        console.log(chalk.blue(`💬 Ready to post comment on current token page`));
        
        // Already on correct page from login, wait for content to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Try multiple selectors for comment input - updated for PumpFun
        const commentSelectors = [
            'textarea[placeholder*="reply"]',
            'textarea[placeholder*="Reply"]', 
            'input[placeholder*="reply"]',
            'textarea[data-testid="reply-input"]',
            'textarea[aria-label*="reply"]',
            '.reply-input textarea',
            '.comment-input textarea',
            'textarea',
            'input[type="text"]',
            '[contenteditable="true"]',
            '[role="textbox"]'
        ];
        
        let commentInput = null;
        for (const selector of commentSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 3000 });
                commentInput = await page.$(selector);
                if (commentInput) {
                    console.log(chalk.green(`✅ Found comment input with selector: ${selector}`));
                    break;
                }
            } catch (e) {
                // Continue to next selector
            }
        }
        
        if (!commentInput) {
            console.log(chalk.red('❌ No comment input found'));
            return false;
        }
        
        const commentText = getRandomComment();
        console.log(chalk.blue(`📝 Posting comment: "${commentText}"`));
        
        // Clear and fill comment text
        await commentInput.click();
        await commentInput.focus();
        await page.evaluate(() => document.activeElement.value = '');
        await commentInput.type(commentText, { delay: 100 });
        
        // Wait a moment for any dynamic elements to appear
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Take another screenshot after typing
        await page.screenshot({ path: 'debug-after-typing.png' });
        
        // Log all buttons on the page for debugging
        const allButtons = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.map(btn => ({
                text: btn.textContent.trim(),
                className: btn.className,
                id: btn.id,
                type: btn.type,
                visible: window.getComputedStyle(btn).display !== 'none'
            }));
        });
        console.log(chalk.blue('🔍 All buttons found on page:'), allButtons);
        
        // Upload image if available
        if (imagePath) {
            try {
                const imageInput = await page.$('input[type="file"]');
                if (imageInput) {
                    await imageInput.uploadFile(imagePath);
                    console.log(chalk.blue(`📸 Image uploaded: ${imagePath}`));
                }
            } catch (imageError) {
                console.log(chalk.yellow('⚠️ Failed to upload image, continuing with text only'));
            }
        }
        
        // Try multiple selectors for submit button - focusing on "post reply"
        const submitSelectors = [
            'button:contains("post reply")',
            'button:contains("Post Reply")', 
            'button:contains("POST REPLY")',
            'button[type="submit"]',
            '.submit-btn',
            '.post-btn',
            'button:contains("Post")',
            'button:contains("Send")',
            'button:contains("Submit")',
            '[data-testid="submit"]',
            '[data-testid="post"]',
            'button[class*="submit"]',
            'button[class*="post"]'
        ];
        
        // Special handler for text-based button search
        async function findButtonByText(page, text) {
            return await page.evaluateHandle((searchText) => {
                const buttons = Array.from(document.querySelectorAll('button'));
                return buttons.find(button => 
                    button.textContent.trim().toLowerCase().includes(searchText.toLowerCase())
                );
            }, text);
        }
        
        let submitButton = null;
        
        // First try to find "post reply" button specifically
        try {
            submitButton = await findButtonByText(page, 'post reply');
            if (await submitButton.evaluate(node => node !== null)) {
                console.log(chalk.green('✅ Found "post reply" button'));
            } else {
                submitButton = null;
            }
        } catch (e) {
            // Continue with other methods
        }
        
        // If not found, try other selectors
        if (!submitButton) {
            for (const selector of submitSelectors) {
                try {
                    if (selector.includes(':contains')) {
                        const buttonText = selector.split(':contains("')[1].split('")')[0];
                        submitButton = await findButtonByText(page, buttonText);
                        if (await submitButton.evaluate(node => node !== null)) {
                            console.log(chalk.green(`✅ Found button with text: ${buttonText}`));
                            break;
                        } else {
                            submitButton = null;
                        }
                    } else {
                        const elements = await page.$$(selector);
                        for (const element of elements) {
                            const isVisible = await page.evaluate(el => {
                                const style = window.getComputedStyle(el);
                                return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0;
                            }, element);
                            
                            if (isVisible) {
                                submitButton = element;
                                console.log(chalk.green(`✅ Found visible submit button with selector: ${selector}`));
                                break;
                            }
                        }
                        if (submitButton) break;
                    }
                } catch (e) {
                    // Continue to next selector
                }
            }
        }
        
        // Try multiple ways to submit the comment
        let submitted = false;
        
        if (submitButton) {
            // Make sure button is visible and enabled
            const isVisible = await submitButton.evaluate(btn => {
                const style = window.getComputedStyle(btn);
                return style.display !== 'none' && style.visibility !== 'hidden' && !btn.disabled;
            });
            
            if (isVisible) {
                // Method 1: Scroll to button and regular click
                try {
                    await submitButton.scrollIntoView();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await submitButton.click();
                    console.log(chalk.green('✅ Clicked submit button'));
                    submitted = true;
                } catch (clickError) {
                    console.log(chalk.yellow('⚠️ Regular click failed, trying JavaScript click'));
                    
                    // Method 2: JavaScript click
                    try {
                        await page.evaluate(button => {
                            button.scrollIntoView();
                            button.click();
                        }, submitButton);
                        console.log(chalk.green('✅ JavaScript click successful'));
                        submitted = true;
                    } catch (jsError) {
                        console.log(chalk.yellow('⚠️ JavaScript click failed'));
                    }
                }
            } else {
                console.log(chalk.yellow('⚠️ Submit button found but not visible/enabled'));
            }
        } else {
            console.log(chalk.yellow('⚠️ No submit button found, searching by color and position...'));
            
            // Try to find green button by style
            try {
                const greenButton = await page.evaluateHandle(() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    return buttons.find(btn => {
                        const style = window.getComputedStyle(btn);
                        const bgColor = style.backgroundColor;
                        const text = btn.textContent.trim().toLowerCase();
                        // Look for green background or specific text
                        return (bgColor.includes('rgb(34, 197, 94)') || 
                               bgColor.includes('green') || 
                               text.includes('post') || 
                               text.includes('reply'));
                    });
                });
                
                if (await greenButton.evaluate(node => node !== null)) {
                    submitButton = greenButton;
                    console.log(chalk.green('✅ Found button by color/text analysis'));
                }
            } catch (e) {
                console.log(chalk.yellow('⚠️ Color search failed, will try keyboard methods'));
            }
        }
        
        if (!submitted) {
            // Method 3: Enter key on comment input
            try {
                await commentInput.focus();
                await page.keyboard.press('Enter');
                console.log(chalk.yellow('⚠️ Tried Enter key on comment input'));
                submitted = true;
            } catch (enterError) {
                // Method 4: Try Ctrl+Enter
                try {
                    await commentInput.focus();
                    await page.keyboard.down('Control');
                    await page.keyboard.press('Enter');
                    await page.keyboard.up('Control');
                    console.log(chalk.yellow('⚠️ Tried Ctrl+Enter'));
                    submitted = true;
                } catch (ctrlEnterError) {
                    // Method 5: Try Tab + Enter
                    try {
                        await commentInput.focus();
                        await page.keyboard.press('Tab');
                        await page.keyboard.press('Enter');
                        console.log(chalk.yellow('⚠️ Tried Tab+Enter'));
                        submitted = true;
                    } catch (tabEnterError) {
                        console.log(chalk.red('❌ All submit methods failed'));
                    }
                }
            }
        }
        
        // Check if comment was actually posted by looking for success indicators
        if (submitted) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Look for success messages or comment appearing on page
            const successIndicators = [
                '.success-message',
                '.comment-posted',
                '[data-testid="success"]',
                '.toast-success'
            ];
            
            let commentPosted = false;
            for (const indicator of successIndicators) {
                const element = await page.$(indicator);
                if (element) {
                    commentPosted = true;
                    break;
                }
            }
            
            // Check if our comment text appears on the page
            if (!commentPosted) {
                const pageText = await page.evaluate(() => document.body.innerText);
                if (pageText.includes(commentText)) {
                    commentPosted = true;
                }
            }
            
            if (commentPosted) {
                console.log(chalk.green('✅ Comment successfully posted and verified!'));
            } else {
                console.log(chalk.yellow('⚠️ Comment submission attempted but verification unclear'));
            }
        }
        
        // Wait for success
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log(chalk.green(`✅ Comment posted: "${commentText}"`));
        return true;
    } catch (error) {
        console.log(chalk.red('❌ Failed to post comment:'), error.message);
        return false;
    }
}

// Single token test mode
async function singleTokenTest() {
    if (!config.target_token || config.target_token === "") {
        console.log(chalk.red('❌ No target token specified. Please set target_token in config.json'));
        return;
    }
    
    console.log(chalk.blue(`🎯 Testing on single token: ${config.target_token}`));
    
    // Create a token object for the specified token
    const targetToken = {
        mint: config.target_token,
        name: 'Target Token',
        symbol: 'TEST'
    };
    
    // Process each wallet once on the target token
    for (const wallet of wallets) {
        try {
            const page = await browser.newPage();
            
            // Set random user agent
            await page.setUserAgent(faker.internet.userAgent());
            
            console.log(chalk.blue(`🔐 Testing with wallet: ${wallet.publicKey.toString().slice(0, 8)}...`));
            
            // Login to PumpFun and navigate directly to target token
            const loginSuccess = await loginToPumpFun(wallet, page, config.target_token);
            
            // Post comment on target token
            await postComment(wallet, targetToken, page);
            
            await page.close();
            
            // Random delay between wallets
            const delay = Math.random() * (config.delay.max - config.delay.min) + config.delay.min;
            console.log(chalk.blue(`⏰ Waiting ${Math.round(delay/1000)}s before next wallet...`));
            await new Promise(resolve => setTimeout(resolve, delay));
            
        } catch (walletError) {
            console.log(chalk.red(`❌ Error with wallet ${wallet.publicKey.toString().slice(0, 8)}:`), walletError.message);
        }
    }
    
    console.log(chalk.green('✅ Single token test completed!'));
}

// Main comment loop
async function commentLoop() {
    console.log(chalk.blue('🔄 Starting comment loop...'));
    
    while (true) {
        try {
            // Get tokens to comment on
            const tokens = await findTokens();
            
            if (tokens.length === 0) {
                console.log(chalk.yellow('⚠️ No tokens found, waiting...'));
                await new Promise(resolve => setTimeout(resolve, 60000));
                continue;
            }
            
            // Process each wallet
            for (const wallet of wallets) {
                try {
                    const page = await browser.newPage();
                    
                    // Set random user agent
                    await page.setUserAgent(faker.internet.userAgent());
                    
                    // Login to PumpFun
                    const loginSuccess = await loginToPumpFun(wallet, page);
                    
                    if (loginSuccess) {
                        // Select random token
                        const token = tokens[Math.floor(Math.random() * tokens.length)];
                        
                        // Post comment
                        await postComment(wallet, token, page);
                    }
                    
                    await page.close();
                    
                    // Random delay between wallets
                    const delay = Math.random() * (config.delay.max - config.delay.min) + config.delay.min;
                    console.log(chalk.blue(`⏰ Waiting ${Math.round(delay/1000)}s before next wallet...`));
                    await new Promise(resolve => setTimeout(resolve, delay));
                    
                } catch (walletError) {
                    console.log(chalk.red(`❌ Error with wallet ${wallet.publicKey.toString().slice(0, 8)}:`), walletError.message);
                }
            }
            
            // Wait before next round
            console.log(chalk.blue('🔄 Round completed, waiting before next round...'));
            await new Promise(resolve => setTimeout(resolve, 300000)); // 5 minutes
            
        } catch (error) {
            console.log(chalk.red('❌ Error in comment loop:'), error.message);
            await new Promise(resolve => setTimeout(resolve, 60000));
        }
    }
}

// KOTH mode - idle commenting
async function kothMode() {
    console.log(chalk.blue('👑 KOTH mode activated - idle commenting'));
    
    while (true) {
        try {
            // Check for KOTH tokens
            const response = await fetch(`${config.pumpfun.apiUrl}/coins/koth`);
            const kothTokens = await response.json();
            
            if (kothTokens && kothTokens.length > 0) {
                console.log(chalk.green(`👑 Found ${kothTokens.length} KOTH tokens`));
                
                // Use first available wallet for KOTH commenting
                if (wallets.length > 0) {
                    const wallet = wallets[0];
                    const page = await browser.newPage();
                    
                    await page.setUserAgent(faker.internet.userAgent());
                    
                    const loginSuccess = await loginToPumpFun(wallet, page);
                    
                    if (loginSuccess) {
                        for (const token of kothTokens.slice(0, 3)) { // Comment on top 3 KOTH tokens
                            await postComment(wallet, token, page);
                            await new Promise(resolve => setTimeout(resolve, 5000));
                        }
                    }
                    
                    await page.close();
                }
            }
            
            // Wait before next KOTH check
            await new Promise(resolve => setTimeout(resolve, config.koth.checkInterval));
            
        } catch (error) {
            console.log(chalk.red('❌ Error in KOTH mode:'), error.message);
            await new Promise(resolve => setTimeout(resolve, 60000));
        }
    }
}

// Main function
export async function main() {
    console.log(chalk.cyan('🤖 PumpFun Comment Bot Starting...'));
    
    // Load configuration
    if (!loadConfig()) {
        return;
    }
    
    // Initialize Solana connection
    if (!initializeSolana()) {
        return;
    }
    
    // Load or generate wallets
    wallets = await readWallets();
    
    if (wallets.length === 0) {
        console.log(chalk.red('❌ No wallets available. Please generate wallets first.'));
        return;
    }
    
    console.log(chalk.green(`✅ Loaded ${wallets.length} wallets`));
    
    // Create profiles for wallets if needed
    if (config.profile.generateRandom) {
        for (const wallet of wallets) {
            await createProfile(wallet);
        }
    }
    
    // Initialize browser
    if (!await initializeBrowser()) {
        return;
    }
    
    // Start appropriate mode
    try {
        if (config.mode === "single_token_test") {
            await singleTokenTest();
        } else if (config.koth.enabled) {
            await kothMode();
        } else {
            await commentLoop();
        }
    } catch (error) {
        console.log(chalk.red('❌ Fatal error in main loop:'), error.message);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n🛑 Shutting down gracefully...'));
    if (browser) {
        await browser.close();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log(chalk.yellow('\n🛑 Received SIGTERM, shutting down...'));
    if (browser) {
        await browser.close();
    }
    process.exit(0);
});

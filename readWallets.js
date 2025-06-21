import { Keypair } from '@solana/web3.js';
import { generateWallet } from './walletGen.js';
import chalk from 'chalk';
import fs from 'fs';
import bs58 from 'bs58';

// Read existing wallets from file
export async function readWallets() {
    try {
        let wallets = [];
        
        // Check if walletsList.json exists
        if (fs.existsSync('./walletsList.json')) {
            const walletsData = fs.readFileSync('./walletsList.json', 'utf8');
            const walletsJson = JSON.parse(walletsData);
            
            console.log(chalk.blue(`📁 Found ${walletsJson.length} wallets in walletsList.json`));
            
            // Convert stored wallet data back to Keypair objects
            for (const walletData of walletsJson) {
                try {
                    let keypair;
                    
                    if (walletData.privateKey) {
                        // If private key is stored as base58
                        const privateKeyBytes = bs58.decode(walletData.privateKey);
                        keypair = Keypair.fromSecretKey(privateKeyBytes);
                    } else if (walletData.secretKey) {
                        // If secret key is stored as array
                        keypair = Keypair.fromSecretKey(new Uint8Array(walletData.secretKey));
                    } else {
                        console.log(chalk.yellow(`⚠️ Invalid wallet data format, skipping...`));
                        continue;
                    }
                    
                    wallets.push(keypair);
                    
                } catch (error) {
                    console.log(chalk.red(`❌ Failed to load wallet: ${error.message}`));
                }
            }
            
            console.log(chalk.green(`✅ Successfully loaded ${wallets.length} wallets`));
        }
        
        // Load configuration to check if we need to generate more wallets
        const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
        
        // Generate additional wallets if needed
        if (wallets.length < config.wallets.generateCount) {
            const needCount = config.wallets.generateCount - wallets.length;
            console.log(chalk.blue(`🔧 Generating ${needCount} additional wallets...`));
            
            for (let i = 0; i < needCount; i++) {
                const newWallet = await generateWallet();
                if (newWallet) {
                    wallets.push(newWallet);
                }
            }
            
            // Save updated wallets list
            await saveWallets(wallets);
        }
        
        return wallets;
        
    } catch (error) {
        console.log(chalk.red('❌ Failed to read wallets:'), error.message);
        
        // If reading fails, try to generate new wallets
        console.log(chalk.blue('🔧 Attempting to generate new wallets...'));
        return await generateNewWallets();
    }
}

// Generate new wallets if none exist
async function generateNewWallets() {
    try {
        const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
        const wallets = [];
        
        console.log(chalk.blue(`🔧 Generating ${config.wallets.generateCount} new wallets...`));
        
        for (let i = 0; i < config.wallets.generateCount; i++) {
            const wallet = await generateWallet();
            if (wallet) {
                wallets.push(wallet);
                console.log(chalk.green(`✅ Generated wallet ${i + 1}/${config.wallets.generateCount}: ${wallet.publicKey.toString().slice(0, 8)}...`));
            }
        }
        
        // Save wallets to file
        await saveWallets(wallets);
        
        return wallets;
        
    } catch (error) {
        console.log(chalk.red('❌ Failed to generate new wallets:'), error.message);
        return [];
    }
}

// Save wallets to file
export async function saveWallets(wallets) {
    try {
        const walletsData = wallets.map(wallet => ({
            publicKey: wallet.publicKey.toString(),
            privateKey: bs58.encode(wallet.secretKey),
            created: new Date().toISOString()
        }));
        
        fs.writeFileSync('./walletsList.json', JSON.stringify(walletsData, null, 2));
        console.log(chalk.green(`✅ Saved ${wallets.length} wallets to walletsList.json`));
        
    } catch (error) {
        console.log(chalk.red('❌ Failed to save wallets:'), error.message);
    }
}

// Add new wallet to existing list
export async function addWallet(wallet) {
    try {
        let existingWallets = [];
        
        if (fs.existsSync('./walletsList.json')) {
            const walletsData = fs.readFileSync('./walletsList.json', 'utf8');
            existingWallets = JSON.parse(walletsData);
        }
        
        const newWalletData = {
            publicKey: wallet.publicKey.toString(),
            privateKey: bs58.encode(wallet.secretKey),
            created: new Date().toISOString()
        };
        
        existingWallets.push(newWalletData);
        
        fs.writeFileSync('./walletsList.json', JSON.stringify(existingWallets, null, 2));
        console.log(chalk.green(`✅ Added new wallet: ${wallet.publicKey.toString().slice(0, 8)}...`));
        
    } catch (error) {
        console.log(chalk.red('❌ Failed to add wallet:'), error.message);
    }
}

// Get wallet info (balance, transactions, etc.)
export async function getWalletInfo(wallet, connection) {
    try {
        const publicKey = wallet.publicKey;
        
        // Get balance
        const balance = await connection.getBalance(publicKey);
        
        // Get recent transactions
        const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 5 });
        
        return {
            publicKey: publicKey.toString(),
            balance: balance / 1e9, // Convert lamports to SOL
            transactionCount: signatures.length,
            recentTransactions: signatures.map(sig => ({
                signature: sig.signature,
                slot: sig.slot,
                blockTime: sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : null
            }))
        };
        
    } catch (error) {
        console.log(chalk.red(`❌ Failed to get wallet info: ${error.message}`));
        return null;
    }
}

// Check if wallet has sufficient balance
export async function checkWalletBalance(wallet, connection, minimumSol = 0.01) {
    try {
        const balance = await connection.getBalance(wallet.publicKey);
        const solBalance = balance / 1e9;
        
        if (solBalance < minimumSol) {
            console.log(chalk.yellow(`⚠️ Wallet ${wallet.publicKey.toString().slice(0, 8)}... has insufficient balance: ${solBalance} SOL`));
            return false;
        }
        
        return true;
        
    } catch (error) {
        console.log(chalk.red(`❌ Failed to check wallet balance: ${error.message}`));
        return false;
    }
}

import { Keypair, Connection } from '@solana/web3.js';
import chalk from 'chalk';
import fs from 'fs';
import bs58 from 'bs58';
import { addWallet } from './readWallets.js';

// Generate a new Solana wallet
export async function generateWallet() {
    try {
        // Generate new keypair
        const keypair = Keypair.generate();
        
        console.log(chalk.green(`✅ Generated new wallet:`));
        console.log(chalk.blue(`   Public Key: ${keypair.publicKey.toString()}`));
        console.log(chalk.blue(`   Address: ${keypair.publicKey.toString().slice(0, 8)}...${keypair.publicKey.toString().slice(-8)}`));
        
        return keypair;
        
    } catch (error) {
        console.log(chalk.red('❌ Failed to generate wallet:'), error.message);
        return null;
    }
}

// Generate multiple wallets
export async function generateMultipleWallets(count = 5) {
    try {
        const wallets = [];
        
        console.log(chalk.blue(`🔧 Generating ${count} wallets...`));
        
        for (let i = 0; i < count; i++) {
            const wallet = await generateWallet();
            if (wallet) {
                wallets.push(wallet);
                
                // Add to wallets list
                await addWallet(wallet);
                
                console.log(chalk.green(`✅ Wallet ${i + 1}/${count} generated and saved`));
            } else {
                console.log(chalk.red(`❌ Failed to generate wallet ${i + 1}/${count}`));
            }
        }
        
        return wallets;
        
    } catch (error) {
        console.log(chalk.red('❌ Failed to generate multiple wallets:'), error.message);
        return [];
    }
}

// Generate wallet from seed phrase (if needed)
export function generateWalletFromSeed(seedPhrase) {
    try {
        // This would require additional dependencies for BIP39
        // For now, we'll just generate a random wallet
        console.log(chalk.yellow('⚠️ Seed phrase generation not implemented, generating random wallet instead'));
        return generateWallet();
        
    } catch (error) {
        console.log(chalk.red('❌ Failed to generate wallet from seed:'), error.message);
        return null;
    }
}

// Import wallet from private key
export function importWalletFromPrivateKey(privateKeyString) {
    try {
        // Decode the private key (assuming it's in base58 format)
        const privateKeyBytes = bs58.decode(privateKeyString);
        
        // Create keypair from private key
        const keypair = Keypair.fromSecretKey(privateKeyBytes);
        
        console.log(chalk.green(`✅ Imported wallet: ${keypair.publicKey.toString().slice(0, 8)}...`));
        
        return keypair;
        
    } catch (error) {
        console.log(chalk.red('❌ Failed to import wallet from private key:'), error.message);
        return null;
    }
}

// Export wallet private key
export function exportWalletPrivateKey(wallet) {
    try {
        const privateKeyBase58 = bs58.encode(wallet.secretKey);
        
        console.log(chalk.yellow('⚠️ Private key exported. Keep this secure!'));
        console.log(chalk.blue(`Private Key: ${privateKeyBase58}`));
        
        return privateKeyBase58;
        
    } catch (error) {
        console.log(chalk.red('❌ Failed to export private key:'), error.message);
        return null;
    }
}

// Check wallet balance
export async function checkWalletBalance(wallet, connection) {
    try {
        const balance = await connection.getBalance(wallet.publicKey);
        const solBalance = balance / 1e9; // Convert lamports to SOL
        
        console.log(chalk.blue(`💰 Wallet ${wallet.publicKey.toString().slice(0, 8)}... balance: ${solBalance} SOL`));
        
        return solBalance;
        
    } catch (error) {
        console.log(chalk.red('❌ Failed to check wallet balance:'), error.message);
        return 0;
    }
}

// Request SOL airdrop (for devnet/testnet)
export async function requestAirdrop(wallet, connection, amount = 1) {
    try {
        console.log(chalk.blue(`💧 Requesting ${amount} SOL airdrop for wallet: ${wallet.publicKey.toString().slice(0, 8)}...`));
        
        const signature = await connection.requestAirdrop(wallet.publicKey, amount * 1e9);
        
        // Wait for confirmation
        await connection.confirmTransaction(signature);
        
        console.log(chalk.green(`✅ Airdrop successful! Transaction: ${signature}`));
        
        return signature;
        
    } catch (error) {
        console.log(chalk.red('❌ Airdrop failed:'), error.message);
        return null;
    }
}

// Batch generate and save wallets
export async function batchGenerateWallets() {
    try {
        // Load config to get generation count
        const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
        const count = config.wallets.generateCount || 5;
        
        console.log(chalk.blue(`🚀 Starting batch generation of ${count} wallets...`));
        
        const wallets = await generateMultipleWallets(count);
        
        console.log(chalk.green(`✅ Batch generation complete! Generated ${wallets.length} wallets`));
        
        return wallets;
        
    } catch (error) {
        console.log(chalk.red('❌ Batch generation failed:'), error.message);
        return [];
    }
}

// Validate wallet format
export function validateWalletFormat(walletData) {
    try {
        // Check if it has required fields
        if (!walletData.publicKey || !walletData.privateKey) {
            return false;
        }
        
        // Try to create keypair from the data
        const privateKeyBytes = bs58.decode(walletData.privateKey);
        const keypair = Keypair.fromSecretKey(privateKeyBytes);
        
        // Check if public key matches
        const isValid = keypair.publicKey.toString() === walletData.publicKey;
        
        return isValid;
        
    } catch (error) {
        return false;
    }
}

// Create wallet backup
export function createWalletBackup(wallets) {
    try {
        const backupData = {
            created: new Date().toISOString(),
            count: wallets.length,
            wallets: wallets.map(wallet => ({
                publicKey: wallet.publicKey.toString(),
                privateKey: bs58.encode(wallet.secretKey)
            }))
        };
        
        const backupFilename = `wallet-backup-${Date.now()}.json`;
        fs.writeFileSync(backupFilename, JSON.stringify(backupData, null, 2));
        
        console.log(chalk.green(`✅ Wallet backup created: ${backupFilename}`));
        
        return backupFilename;
        
    } catch (error) {
        console.log(chalk.red('❌ Failed to create wallet backup:'), error.message);
        return null;
    }
}

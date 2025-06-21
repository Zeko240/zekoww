import { Keypair, Transaction, SystemProgram, PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import chalk from 'chalk';

// Sign a message for authentication
export async function signTransaction(wallet, message) {
    try {
        // Convert message to bytes
        const messageBytes = new TextEncoder().encode(message);
        
        // Sign the message
        const signature = nacl.sign.detached(messageBytes, wallet.secretKey);
        
        // Convert signature to base58
        const signatureBase58 = bs58.encode(signature);
        
        console.log(chalk.green(`✅ Message signed successfully`));
        
        return signatureBase58;
        
    } catch (error) {
        console.log(chalk.red('❌ Failed to sign message:'), error.message);
        return null;
    }
}

// Verify a signature
export function verifySignature(publicKey, message, signature) {
    try {
        const messageBytes = new TextEncoder().encode(message);
        const signatureBytes = bs58.decode(signature);
        const publicKeyBytes = publicKey.toBytes();
        
        const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
        
        return isValid;
        
    } catch (error) {
        console.log(chalk.red('❌ Failed to verify signature:'), error.message);
        return false;
    }
}

// Create and sign a Solana transaction
export async function createAndSignTransaction(wallet, connection, instructions) {
    try {
        // Get recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        
        // Create transaction
        const transaction = new Transaction({
            recentBlockhash: blockhash,
            feePayer: wallet.publicKey
        });
        
        // Add instructions
        transaction.add(...instructions);
        
        // Sign transaction
        transaction.sign(wallet);
        
        console.log(chalk.green(`✅ Transaction signed successfully`));
        
        return transaction;
        
    } catch (error) {
        console.log(chalk.red('❌ Failed to create and sign transaction:'), error.message);
        return null;
    }
}

// Sign transfer transaction
export async function signTransferTransaction(wallet, connection, toPublicKey, lamports) {
    try {
        const transferInstruction = SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: new PublicKey(toPublicKey),
            lamports: lamports
        });
        
        const transaction = await createAndSignTransaction(wallet, connection, [transferInstruction]);
        
        return transaction;
        
    } catch (error) {
        console.log(chalk.red('❌ Failed to sign transfer transaction:'), error.message);
        return null;
    }
}

// Create authentication signature for PumpFun
export function createAuthSignature(wallet, timestamp) {
    try {
        const message = `PumpFun Authentication ${timestamp}`;
        const messageBytes = new TextEncoder().encode(message);
        
        // Sign with wallet private key
        const signature = nacl.sign.detached(messageBytes, wallet.secretKey);
        
        return {
            message: message,
            signature: bs58.encode(signature),
            publicKey: wallet.publicKey.toString(),
            timestamp: timestamp
        };
        
    } catch (error) {
        console.log(chalk.red('❌ Failed to create auth signature:'), error.message);
        return null;
    }
}

// Sign arbitrary data
export function signData(wallet, data) {
    try {
        let dataBytes;
        
        if (typeof data === 'string') {
            dataBytes = new TextEncoder().encode(data);
        } else if (data instanceof Uint8Array) {
            dataBytes = data;
        } else {
            // Convert object to JSON string then to bytes
            dataBytes = new TextEncoder().encode(JSON.stringify(data));
        }
        
        const signature = nacl.sign.detached(dataBytes, wallet.secretKey);
        
        return {
            data: data,
            signature: bs58.encode(signature),
            publicKey: wallet.publicKey.toString()
        };
        
    } catch (error) {
        console.log(chalk.red('❌ Failed to sign data:'), error.message);
        return null;
    }
}

// Create PumpFun API signature
export function createPumpFunSignature(wallet, endpoint, params = {}) {
    try {
        const timestamp = Date.now();
        const nonce = Math.random().toString(36).substring(7);
        
        // Create message to sign
        const message = JSON.stringify({
            endpoint: endpoint,
            params: params,
            timestamp: timestamp,
            nonce: nonce,
            wallet: wallet.publicKey.toString()
        });
        
        const signature = signData(wallet, message);
        
        return {
            ...signature,
            timestamp: timestamp,
            nonce: nonce
        };
        
    } catch (error) {
        console.log(chalk.red('❌ Failed to create PumpFun signature:'), error.message);
        return null;
    }
}

// Validate wallet keypair
export function validateWallet(wallet) {
    try {
        if (!wallet || !wallet.publicKey || !wallet.secretKey) {
            return false;
        }
        
        // Test signing capability
        const testMessage = "test";
        const signature = signTransaction(wallet, testMessage);
        
        if (!signature) {
            return false;
        }
        
        // Test verification
        const isValid = verifySignature(wallet.publicKey, testMessage, signature);
        
        return isValid;
        
    } catch (error) {
        console.log(chalk.red('❌ Wallet validation failed:'), error.message);
        return false;
    }
}

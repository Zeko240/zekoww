import { faker } from '@faker-js/faker';
import chalk from 'chalk';
import fs from 'fs';

// Generate random profile data
function generateProfileData() {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const username = faker.internet.username({ firstName, lastName });
    
    return {
        username: username.toLowerCase(),
        displayName: `${firstName} ${lastName}`,
        bio: faker.person.bio(),
        location: faker.location.city(),
        website: Math.random() > 0.7 ? faker.internet.url() : null,
        avatar: null, // Will be generated separately
        created: new Date().toISOString(),
        interests: faker.helpers.arrayElements([
            'DeFi', 'NFTs', 'Gaming', 'Metaverse', 'Web3', 'Crypto', 
            'Trading', 'Blockchain', 'Smart Contracts', 'DAOs'
        ], { min: 2, max: 4 }),
        socialLinks: {
            twitter: Math.random() > 0.6 ? `https://twitter.com/${username}` : null,
            discord: Math.random() > 0.8 ? `${username}#${faker.string.numeric(4)}` : null
        }
    };
}

// Generate avatar URL
function generateAvatarUrl(seed) {
    const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
    const avatarService = config.profile.avatarService;
    
    // Use wallet address as seed for consistent avatar
    return `${avatarService}?seed=${seed}&size=200`;
}

// Create and save profile for wallet
export async function createProfile(wallet) {
    try {
        const walletAddress = wallet.publicKey.toString();
        const profilesDir = './profiles';
        
        // Create profiles directory if it doesn't exist
        if (!fs.existsSync(profilesDir)) {
            fs.mkdirSync(profilesDir);
        }
        
        const profilePath = `${profilesDir}/${walletAddress}.json`;
        
        // Check if profile already exists
        if (fs.existsSync(profilePath)) {
            console.log(chalk.blue(`📋 Profile already exists for wallet: ${walletAddress.slice(0, 8)}...`));
            return JSON.parse(fs.readFileSync(profilePath, 'utf8'));
        }
        
        // Generate new profile
        const profileData = generateProfileData();
        profileData.walletAddress = walletAddress;
        profileData.avatar = generateAvatarUrl(walletAddress);
        
        // Save profile to file
        fs.writeFileSync(profilePath, JSON.stringify(profileData, null, 2));
        
        console.log(chalk.green(`✅ Profile created for wallet: ${walletAddress.slice(0, 8)}... (${profileData.displayName})`));
        
        return profileData;
        
    } catch (error) {
        console.log(chalk.red('❌ Failed to create profile:'), error.message);
        return null;
    }
}

// Get profile for wallet
export function getProfile(wallet) {
    try {
        const walletAddress = wallet.publicKey.toString();
        const profilePath = `./profiles/${walletAddress}.json`;
        
        if (fs.existsSync(profilePath)) {
            return JSON.parse(fs.readFileSync(profilePath, 'utf8'));
        }
        
        return null;
    } catch (error) {
        console.log(chalk.red('❌ Failed to get profile:'), error.message);
        return null;
    }
}

// Update profile data
export function updateProfile(wallet, updates) {
    try {
        const walletAddress = wallet.publicKey.toString();
        const profilePath = `./profiles/${walletAddress}.json`;
        
        if (fs.existsSync(profilePath)) {
            const currentProfile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
            const updatedProfile = { ...currentProfile, ...updates, updated: new Date().toISOString() };
            
            fs.writeFileSync(profilePath, JSON.stringify(updatedProfile, null, 2));
            
            console.log(chalk.green(`✅ Profile updated for wallet: ${walletAddress.slice(0, 8)}...`));
            return updatedProfile;
        }
        
        console.log(chalk.yellow(`⚠️ Profile not found for wallet: ${walletAddress.slice(0, 8)}...`));
        return null;
        
    } catch (error) {
        console.log(chalk.red('❌ Failed to update profile:'), error.message);
        return null;
    }
}

// Generate bio based on crypto interests
export function generateCryptoBio() {
    const templates = [
        "🚀 DeFi enthusiast | Building the future of finance",
        "💎 Diamond hands since 2021 | HODL forever",
        "🌙 To the moon and beyond | Crypto maximalist",
        "🔥 Web3 builder | NFT collector | DeFi farmer",
        "⚡ Lightning fast trades | Smart contract wizard",
        "🎯 Always DYOR | Never financial advice",
        "🌊 Riding the crypto waves | Surf's up!",
        "🎮 GameFi player | Metaverse explorer",
        "🏗️ Building on Solana | Fast & cheap transactions",
        "💰 Yield farming | Liquidity providing | Staking rewards"
    ];
    
    return faker.helpers.arrayElement(templates);
}

// Generate realistic crypto username
export function generateCryptoUsername() {
    const prefixes = ['crypto', 'defi', 'moon', 'degen', 'ape', 'diamond', 'laser', 'rocket'];
    const suffixes = ['hodler', 'trader', 'builder', 'maxi', 'degen', 'chad', 'guru', 'wizard'];
    const numbers = faker.string.numeric({ length: { min: 2, max: 4 } });
    
    const prefix = faker.helpers.arrayElement(prefixes);
    const suffix = faker.helpers.arrayElement(suffixes);
    
    return `${prefix}${suffix}${Math.random() > 0.5 ? numbers : ''}`;
}

# PumpFun Comment Bot

## Overview

This is a Node.js-based automated commenting bot for the PumpFun platform, a Solana-based token launch platform. The bot can generate multiple Solana wallets, create realistic user profiles, and automatically post comments on token projects to simulate organic community engagement.

## System Architecture

### Core Architecture
- **Runtime**: Node.js 20 with ES modules
- **Blockchain**: Solana mainnet integration via @solana/web3.js
- **Web Automation**: Puppeteer for browser automation and web scraping
- **Profile Generation**: Faker.js for realistic user data generation
- **Authentication**: Ed25519 cryptographic signatures using tweetnacl

### File Structure
```
├── index.js              # Main entry point and initialization
├── comments.js           # Core commenting logic and automation
├── readWallets.js        # Wallet management and loading
├── walletGen.js          # Wallet generation utilities
├── createProfile.js      # User profile creation
├── signTX.js            # Transaction and message signing
├── config.json          # Configuration settings
├── walletsList.json     # Wallet storage (auto-generated)
├── profiles/            # Generated user profiles (auto-generated)
└── images/              # Images for comment attachments
```

## Key Components

### 1. Wallet Management System
- **Multi-wallet support**: Generates and manages multiple Solana keypairs
- **Persistent storage**: Wallets stored in JSON format with base58-encoded private keys
- **Automatic generation**: Creates new wallets when count falls below configured threshold
- **Secure handling**: Uses industry-standard cryptographic libraries

### 2. Profile Generation Engine
- **Realistic profiles**: Uses Faker.js to generate authentic-looking user data
- **Avatar generation**: Integrates with external avatar services (DiceBear)
- **Social metadata**: Creates believable social media links and interests
- **Crypto-focused**: Tailored interests for DeFi/crypto community

### 3. Browser Automation
- **Headless operation**: Puppeteer-based web automation
- **Proxy support**: Built-in proxy rotation capabilities
- **Anti-detection**: Browser fingerprint randomization
- **Error handling**: Robust retry mechanisms and error recovery

### 4. Comment System
- **Template-based**: Predefined comment templates with crypto-focused language
- **Image attachment**: Random image selection and upload
- **Timing randomization**: Configurable delays to appear organic
- **Signature verification**: Cryptographic proof of wallet ownership

## Data Flow

1. **Initialization Phase**
   - Load configuration from `config.json`
   - Initialize Solana RPC connection
   - Launch Puppeteer browser instance
   - Load or generate wallet keypairs

2. **Profile Creation**
   - Generate realistic user profiles for each wallet
   - Create avatar URLs with wallet-specific seeds
   - Store profiles in `profiles/` directory

3. **Comment Execution**
   - Navigate to PumpFun platform
   - Select random comment from template pool
   - Optionally attach random image
   - Sign authentication challenges
   - Submit comment with randomized timing

4. **Persistence**
   - Save new wallets to `walletsList.json`
   - Cache user profiles for consistency
   - Log all operations for debugging

## External Dependencies

### Blockchain Infrastructure
- **Solana RPC**: Mainnet connection for wallet operations
- **@solana/web3.js**: Official Solana JavaScript SDK

### Web Automation
- **Puppeteer**: Chromium-based browser automation
- **node-fetch**: HTTP client for API interactions

### Cryptography
- **tweetnacl**: Ed25519 signing for Solana compatibility
- **bs58**: Base58 encoding for Solana addresses

### Data Generation
- **@faker-js/faker**: Realistic fake data generation
- **DiceBear API**: Avatar generation service

### Platform Integration
- **PumpFun Frontend API**: Target platform for commenting
- **PumpFun Web Interface**: Browser-based interaction

## Deployment Strategy

### Development Environment
- **Replit Integration**: Configured for one-click deployment
- **Automatic Dependencies**: npm packages auto-installed on startup
- **Workflow Automation**: Parallel task execution for efficiency

### Production Considerations
- **Proxy Rotation**: Support for multiple proxy providers
- **Rate Limiting**: Configurable delays to avoid detection
- **Error Recovery**: Graceful handling of network failures
- **Resource Management**: Browser instance cleanup and memory optimization

### Security Measures
- **Private Key Protection**: Secure storage and handling of wallet keys
- **Signature Verification**: Cryptographic proof of authenticity
- **Browser Fingerprinting**: Randomized browser characteristics
- **IP Rotation**: Proxy support for geographic distribution

## Recent Changes

```
- June 19, 2025: Bot setup and testing in progress
  - Fixed ES modules configuration in package.json
  - Installed all required dependencies (Solana, Puppeteer, etc.)
  - Generated 5 Solana wallets automatically
  - Created fake user profiles for all wallets
  - Configured Chromium browser for automation
  - Added single token testing mode for user-specified targets
  - Bot successfully finds comment inputs and types text
  - User provided screenshot showing "post reply" green button - fixing button detection
  - Currently testing on token: 2VAUSDG63bc6YSoaVx7KEJvb3rL8ubpHMn2ug5ox9vrv
  - Testing comment: "welcome"
```

## Current Status
- Bot initialization: ✅ Complete
- Wallet generation: ✅ Complete (5 wallets)
- Profile creation: ✅ Complete
- Browser setup: ✅ Complete
- Arabic dashboard: ✅ Complete and working
- Random token discovery: ✅ Working perfectly
- Token contract extraction: ✅ Working with copy function
- Comment input detection: ✅ Working
- Submit button interaction: ⚠️ Needs improvement

## User Preferences

```
Preferred communication style: Arabic, simple everyday language.
Deployment: Do not deploy unless explicitly requested.
Comments: Changed to "مرحباً" only, no images.
Testing: User wants simple bot that finds random tokens and posts one comment.
Timing: User advised to wait longer after clicking submit button.
```
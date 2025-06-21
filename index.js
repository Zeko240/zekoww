import { main } from './comments.js';
import chalk from 'chalk';
import fs from 'fs';

async function startBot() {
    console.log(chalk.green('🚀 Starting PumpFun Comment Bot...'));

    // Check if config file exists
    if (!fs.existsSync('./config.json')) {
        console.log(chalk.red('❌ Config file not found. Please create config.json'));
        process.exit(1);
    }

    // Check if wallets file exists, create if not
    if (!fs.existsSync('./walletsList.json')) {
        console.log(chalk.yellow('⚠️ Wallets file not found. Creating empty walletsList.json'));
        fs.writeFileSync('./walletsList.json', JSON.stringify([], null, 2));
    }

    // Check if images directory exists
    if (!fs.existsSync('./images')) {
        console.log(chalk.yellow('⚠️ Images directory not found. Creating images directory'));
        fs.mkdirSync('./images');
    }

    try {
        await main();
    } catch (error) {
        console.log(chalk.red('❌ Fatal error:'), error.message);
        process.exit(1);
    }
}

startBot();

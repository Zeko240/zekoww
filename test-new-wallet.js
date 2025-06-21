
import { runBotNewWallet } from './botNewWallet.js';
import chalk from 'chalk';

console.log(chalk.cyan('🧪 بدء اختبار البوت بمحفظة جديدة...'));

runBotNewWallet()
    .then(result => {
        console.log(chalk.green('\n📊 نتيجة الاختبار:'));
        console.log(chalk.blue('النجاح:'), result.success);
        console.log(chalk.blue('المحفظة:'), result.wallet);
        console.log(chalk.blue('التوكن:'), result.tokenAddress);
        console.log(chalk.blue('AuthToken:'), result.authToken?.slice(0, 30) + '...');
        
        if (result.errors.length > 0) {
            console.log(chalk.red('\n❌ الأخطاء:'));
            result.errors.forEach((error, index) => {
                console.log(chalk.red(`${index + 1}. ${error}`));
            });
        }
    })
    .catch(error => {
        console.log(chalk.red('❌ فشل الاختبار:'), error.message);
    });

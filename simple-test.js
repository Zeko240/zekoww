import { main } from './comments.js';

// Simple test to post one comment on a random token
async function simpleTest() {
    console.log('🚀 Starting simple test...');
    
    try {
        // This will run the bot in single token test mode
        await main();
        console.log('✅ Test completed');
    } catch (error) {
        console.log('❌ Test failed:', error.message);
    }
}

simpleTest();
import { createRestaurantIndex } from '../services/restaurants/data/restaurant-loader.js';

async function main() {
    try {
        console.log('🔄 Recreating restaurant search index...');
        
        await createRestaurantIndex(true); // Force recreate
        
        console.log('✅ Restaurant search index recreated successfully!');
        console.log('💡 You can now run: npm run load-restaurants');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to recreate index:', error);
        process.exit(1);
    }
}

main();

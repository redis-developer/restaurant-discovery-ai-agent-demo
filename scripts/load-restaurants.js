/**
 * Restaurant Loader Script
 *
 * Usage:
 *   npm run load-restaurants                                    # Load with defaults
 *   npm run load-restaurants <csvFile> <batchSize> <maxCount>   # Custom parameters
 *   npm run load-restaurants --recreate-index                   # Recreate search index
 *   npm run load-restaurants --flush                            # Alias for --recreate-index
 *
 * Examples:
 *   npm run load-restaurants                                    # Load from phase2_working.csv
 *   npm run load-restaurants data.csv 50 5000                   # Custom file, batch size, limit
 *   npm run load-restaurants --recreate-index                   # Rebuild index and reload
 */

import { loadRestaurantsFromCSV, checkRedisMemory } from '../services/restaurants/data/restaurant-loader.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
    try {
        console.log('🍽️ Starting restaurant loading process...');
        
        // Check Redis memory first
        await checkRedisMemory();
        
        // Get command line arguments
        const recreateIndex = process.argv.includes('--recreate-index') || process.argv.includes('--flush');

        // Filter out flags from arguments
        const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));

        const csvFilePath = args[0] || join(__dirname, '../services/restaurants/data/restaurants_phase2_working.csv');
        const batchSize = parseInt(args[1]) || 100;
        const maxRestaurants = parseInt(args[2]) || 4000; // All restaurants from our dataset

        console.log(`📂 Loading from: ${csvFilePath}`);
        console.log(`⚙️ Batch size: ${batchSize}, Max restaurants: ${maxRestaurants}`);
        if (recreateIndex) {
            console.log('🔄 Will recreate search index (flush and rebuild)');
        }

        const result = await loadRestaurantsFromCSV(csvFilePath, batchSize, maxRestaurants, recreateIndex);
        
        console.log('✅ Restaurant loading completed successfully!');
        console.log(`📊 Summary: ${result.restaurantsLoaded} restaurants, ${result.cuisines} cuisines, ${result.cities} cities, ${result.localities} localities`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to load restaurants:', error);
        console.log('\n💡 Usage:');
        console.log('  npm run load-restaurants [csvFile] [batchSize] [maxRestaurants] [--recreate-index]');
        console.log('  npm run load-restaurants --flush  # Recreate index and reload data');
        console.log('\n💡 Troubleshooting:');
        console.log('1. Increase Redis memory limit');
        console.log('2. Reduce batch size: npm run load-restaurants <file> 50 3000');
        console.log('3. Use Redis with more memory or Redis Cloud');
        console.log('4. Check if the CSV file path is correct');
        console.log('5. Use --recreate-index to rebuild search index');
        process.exit(1);
    }
}

main();

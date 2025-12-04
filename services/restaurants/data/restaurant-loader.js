import { createClient, SCHEMA_FIELD_TYPE, SCHEMA_VECTOR_FIELD_ALGORITHM } from 'redis';

import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import CONFIG from '../../../config.js';

import { generateEmbeddings } from '../../ai/helpers/embeddings.js';

const client = await createClient({
    url: CONFIG.redisUrl,
}).on('error', (err) => console.log('Redis Client Error', err))
  .connect();

// Index creation is now handled in the loadRestaurantsFromCSV function

/**
 * Create or recreate the restaurant search index
 * @param {boolean} forceRecreate - Whether to drop and recreate the index
 */
export async function createRestaurantIndex(forceRecreate = false) {
    try {
        if (forceRecreate) {
            console.log('🗑️ Dropping existing restaurant index...');
            try {
                await client.ft.dropIndex('restaurants:search');
                console.log('✅ Existing index dropped successfully');
            } catch (e) {
                if (e.message.includes('Unknown index name')) {
                    console.log('📋 No existing index to drop');
                } else {
                    console.log('⚠️ Error dropping index:', e.message);
                }
            }
        }

        await client.ft.create('restaurants:search', {
            '$.name': {
                type: SCHEMA_FIELD_TYPE.TEXT,
                SORTABLE: true,
                AS: 'name',
            },
            '$.about': {
                type: SCHEMA_FIELD_TYPE.TEXT,
                AS: 'about',
            },
            '$.cuisine': {
                type: SCHEMA_FIELD_TYPE.TAG,
                AS: 'cuisine',
                SEPARATOR: ',',
            },
            '$.city': {
                type: SCHEMA_FIELD_TYPE.TAG,
                AS: 'city',
            },
            '$.locality': {
                type: SCHEMA_FIELD_TYPE.TAG,
                AS: 'locality',
            },
            '$.type': {
                type: SCHEMA_FIELD_TYPE.TAG,
                AS: 'type',
            },
            '$.priceFor2': {
                type: SCHEMA_FIELD_TYPE.NUMERIC,
                AS: 'priceFor2',
            },
            '$.rating': {
                type: SCHEMA_FIELD_TYPE.NUMERIC,
                AS: 'rating',
            },
            '$.lngLat': {
                type: SCHEMA_FIELD_TYPE.GEO,
                AS: 'lngLat',
            },
            '$.restaurantInfoEmbeddings': {
                type: SCHEMA_FIELD_TYPE.VECTOR,
                TYPE: 'FLOAT32',
                AS: 'embedding',
                ALGORITHM: SCHEMA_VECTOR_FIELD_ALGORITHM.HNSW,
                DISTANCE_METRIC: 'L2',
                DIM: 1536,
            }
        }, {
            ON: 'JSON',
            PREFIX: 'restaurants:',
        });
        console.log('✅ Restaurant search index with geospatial support created successfully');
    } catch (e) {
        if (e.message === 'Index already exists') {
            console.log('📋 Restaurant search index exists already, skipped creation.');
        } else {
            console.error('❌ Error creating restaurant search index:', e);
            throw e;
        }
    }
}

/**
 * Memory-optimized restaurant loader that processes data in smaller batches
 * @param {string} csvFilePath - Path to the CSV file
 * @param {number} batchSize - Number of restaurants to process at once (default: 50)
 * @param {number} maxRestaurants - Maximum number of restaurants to load (default: 7000)
 * @param {boolean} recreateIndex - Whether to recreate the search index (default: false)
 */
export async function loadRestaurantsFromCSV(csvFilePath, batchSize = 50, maxRestaurants = 4000, recreateIndex = false) {
    try {
        console.log('📋 Reading restaurant CSV file:', csvFilePath);

        // Create or recreate the search index
        await createRestaurantIndex(recreateIndex);
        
        // Read and parse CSV file
        const csvData = readFileSync(csvFilePath, 'utf-8');
        const records = parse(csvData, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });

        console.log(`🍽️ Found ${records.length} total restaurants in CSV`);

        // Clean and process restaurants
        const restaurants = records
            .filter(record => {
                // Filter out empty restaurants
                if (!record.Name || !record.Name.trim()) {
                    return false;
                }

                // Filter out restaurants without cuisine (essential for categorization)
                if (!record.Cuisine || !record.Cuisine.trim()) {
                    return false;
                }

                // Filter out restaurants without valid coordinates
                const lat = parseFloat(record.Latitude);
                const lng = parseFloat(record.Longitude);
                if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
                    return false;
                }

                return true;
            })
            .slice(0, maxRestaurants) // Limit number of restaurants
            .map(record => ({
                id: record.id?.trim() || generateId(),
                name: record.Name?.trim(),
                cuisine: cleanCuisineData(record.Cuisine) || 'Multi-Cuisine',
                city: record.City?.trim() || '',
                locality: record.Locality?.trim() || '',
                address: record.Address?.trim() || '',
                latitude: parseFloat(record.Latitude) || 0,  // Keep for processing only
                longitude: parseFloat(record.Longitude) || 0, // Keep for processing only
                rating: parseFloat(record.Rating) || 0,
                priceFor2: parseFloat(record.Price_for_2) || 0,
                type: record.Type?.trim() || 'Restaurant',
                about: record.About?.trim() || '',
                facilities: record.Facilities?.trim() || '',
                knownFor: record.Known_For?.trim() || '',
                contact: record.Contact?.trim() || '',
                website: record.Website?.trim() || '',
                voteCount: parseInt(record.Vote_Count) || 0,
                diningReviewCount: parseInt(record.Dining_Review_Count) || 0,
                deliveryRating: parseFloat(record.Delivery_Rating) || 0,
                deliveryRatingCount: parseInt(record.Delivery_Rating_Count) || 0,
            }));

        console.log(`✅ Processing ${restaurants.length} restaurants in batches...`);

        // Clear existing data first (optional)
        console.log('🧹 Clearing existing restaurant data...');
        const existingKeys = await client.keys('restaurants:*');
        if (existingKeys.length > 0) {
            // Delete in chunks to avoid memory issues
            for (let i = 0; i < existingKeys.length; i += 1000) {
                const chunk = existingKeys.slice(i, i + 1000);
                await client.del(...chunk);
            }
        }

        // Process restaurants in batches
        let totalProcessed = 0;
        const cuisines = new Set();
        const cities = new Set();
        const localities = new Set();
        
        for (let i = 0; i < restaurants.length; i += batchSize) {
            const batch = restaurants.slice(i, i + batchSize);
            console.log(`📤 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(restaurants.length/batchSize)} (${batch.length} items)`);
            
            // Generate embeddings for the batch - combining key semantic fields with fallbacks
            const textsForEmbedding = batch.map(restaurant => {
                // Primary fields (always present)
                const primary = `${restaurant.name} ${restaurant.cuisine} ${restaurant.knownFor}`;

                // Secondary fields (with fallbacks for missing data)
                const about = restaurant.about || `${restaurant.cuisine} restaurant serving ${restaurant.knownFor}`;
                const facilities = restaurant.facilities || 'dining restaurant with standard amenities';
                const city = restaurant.city || 'Delhi';
                const locality = restaurant.locality || 'restaurant location';
                const type = restaurant.type || 'restaurant';

                // Combine all fields for rich semantic context
                return `${primary} ${type} ${about} ${facilities} ${city} ${locality}`.replace(/\s+/g, ' ').trim();
            });
            
            const embeddings = await generateEmbeddings(textsForEmbedding);
            
            const pipeline = client.multi();

            for (let j = 0; j < batch.length; j++) {
                const restaurant = batch[j];
                const embedding = embeddings[j];

                // Store restaurant with embeddings and geospatial data
                const restaurantData = {
                    id: restaurant.id,
                    name: restaurant.name,
                    cuisine: restaurant.cuisine,
                    city: restaurant.city,
                    locality: restaurant.locality,
                    address: restaurant.address,
                    // Store location in Redis Search GEO format (longitude,latitude string)
                    lngLat: `${restaurant.longitude},${restaurant.latitude}`,
                    rating: restaurant.rating,
                    priceFor2: restaurant.priceFor2,
                    type: restaurant.type,
                    about: restaurant.about,
                    facilities: restaurant.facilities,
                    knownFor: restaurant.knownFor,
                    contact: restaurant.contact,
                    website: restaurant.website,
                    voteCount: restaurant.voteCount,
                    diningReviewCount: restaurant.diningReviewCount,
                    deliveryRating: restaurant.deliveryRating,
                    deliveryRatingCount: restaurant.deliveryRatingCount,
                    restaurantInfoEmbeddings: embedding,
                };

                // Use HSET instead of JSON.SET for compatibility
                const flatData = {
                    ...restaurantData,
                    restaurantInfoEmbeddings: JSON.stringify(embedding),
                };
                pipeline.hset(`restaurants:${restaurant.id}`, flatData);

                cuisines.add(restaurant.cuisine);
                if (restaurant.city) cities.add(restaurant.city);
                if (restaurant.locality) localities.add(restaurant.locality);
            }

            try {
                const results = await pipeline.exec();
                console.log(`📊 Pipeline executed with ${results.length} operations`);

                totalProcessed += batch.length;
                console.log(`✅ Batch completed. Total processed: ${totalProcessed}`);

                // Add small delay to prevent overwhelming Redis
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error) {
                console.error(`❌ Error processing batch starting at index ${i}:`, error);
                console.error('Error details:', error.stack);
                // Continue with next batch instead of failing completely
                continue;
            }
        }

        console.log('🎉 Restaurants successfully loaded into Redis!');
        console.log(`📊 Final Statistics:`);
        console.log(`   - Restaurants loaded: ${totalProcessed}`);
        console.log(`   - Cuisines: ${cuisines.size}`);
        console.log(`   - Cities: ${cities.size}`);
        console.log(`   - Localities: ${localities.size}`);

        return {
            success: true,
            restaurantsLoaded: totalProcessed,
            cuisines: cuisines.size,
            cities: cities.size,
            localities: localities.size,
        };

    } catch (error) {
        console.error('❌ Error loading restaurants:', error);
        throw error;
    }
}

/**
 * Check Redis memory usage and provide recommendations
 */
export async function checkRedisMemory() {
    try {
        const info = await client.info('memory');
        const memoryLines = info.split('\r\n');

        let usedMemory = 0;
        let maxMemory = 0;

        memoryLines.forEach(line => {
            if (line.startsWith('used_memory:')) {
                usedMemory = parseInt(line.split(':')[1]);
            }
            if (line.startsWith('maxmemory:')) {
                maxMemory = parseInt(line.split(':')[1]);
            }
        });

        const usedMemoryMB = Math.round(usedMemory / 1024 / 1024);
        const maxMemoryMB = maxMemory > 0 ? Math.round(maxMemory / 1024 / 1024) : 'unlimited';

        console.log(`📊 Redis Memory Usage:`);
        console.log(`   - Used: ${usedMemoryMB} MB`);
        console.log(`   - Max: ${maxMemoryMB} MB`);

        if (maxMemory > 0 && usedMemory > maxMemory * 0.8) {
            console.log('⚠️  Warning: Redis memory usage is high. Consider increasing memory limit.');
        }

    } catch (error) {
        console.log('ℹ️  Could not check Redis memory usage:', error.message);
    }
}

// Helper function to generate unique IDs
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Clean and normalize cuisine data for TAG field
 * Handles comma-separated values and removes extra whitespace
 * @param {string} cuisineString - Raw cuisine string from CSV
 * @returns {string} Cleaned cuisine string
 */
function cleanCuisineData(cuisineString) {
    if (!cuisineString || typeof cuisineString !== 'string') {
        return '';
    }

    // Split by comma, trim each cuisine, filter out empty values, then rejoin
    return cuisineString
        .split(',')
        .map(cuisine => cuisine.trim())
        .filter(cuisine => cuisine.length > 0)
        .join(', '); // Use consistent spacing: comma + space
}

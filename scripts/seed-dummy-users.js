#!/usr/bin/env node

/**
 * Seed script to create 5 dummy users with enhanced profile data
 * Creates users: ashwin, hariharan, iyer, kyle, banker
 */

import { createClient } from 'redis';
import CONFIG from '../config.js';

const client = await createClient({
    url: CONFIG.redisUrl,
}).on('error', (err) => console.log('Redis Client Error', err))
  .connect();

async function seedDummyUsers() {
    console.log('🌱 SEEDING DUMMY USERS WITH ENHANCED PROFILES');
    console.log('=' * 50);

    try {
        // Clear existing user data first
        console.log('\n🧹 Clearing existing user data...');
        const existingUserKeys = await client.keys('users:*');
        if (existingUserKeys.length > 0) {
            await client.del(...existingUserKeys);
            console.log(`✅ Cleared ${existingUserKeys.length} existing user sessions`);
        }

        // Define the 5 dummy users with realistic data
        const users = [
            {
                sessionId: "ashwin",
                chat: {
                    "main_chat": []
                },
                profile: {
                    name: "Ashwin",
                    email: "ashwin@example.com",
                    phone: "+91-9876543210",
                    locality: "Khan Market",
                    latitude: 28.5906,
                    longitude: 77.2276,
                    preferences: [
                        "prefers vegetarian food",
                        "likes to not travel too far from home",
                        "prefers mostly north indian cuisine"
                    ]
                },
                createdAt: "2025-11-13T11:34:41.771Z",
                updatedAt: "2025-11-13T11:34:44.725Z"
            },
            {
                sessionId: "hariharan",
                chat: {
                    "main_chat": []
                },
                profile: {
                    name: "Hariharan",
                    email: "hariharan@example.com",
                    phone: "+91-9876543211",
                    locality: "Indiranagar",
                    latitude: 12.9719,
                    longitude: 77.6412,
                    preferences: [
                        "loves south indian cuisine",
                        "prefers authentic traditional food",
                        "enjoys spicy food",
                        "vegetarian only"
                    ]
                },
                createdAt: "2025-11-13T11:34:41.771Z",
                updatedAt: "2025-11-13T11:34:44.725Z"
            },
            {
                sessionId: "iyer",
                chat: {
                    "main_chat": []
                },
                profile: {
                    name: "Iyer",
                    email: "iyer@example.com",
                    phone: "+91-9876543212",
                    locality: "Cyber City, Gurugram",
                    latitude: 28.4949,
                    longitude: 77.0869,
                    preferences: [
                        "strictly vegetarian",
                        "prefers traditional tamil food",
                        "likes filter coffee with meals",
                        "avoids onion and garlic"
                    ]
                },
                createdAt: "2025-11-13T11:34:41.771Z",
                updatedAt: "2025-11-13T11:34:44.725Z"
            },
            {
                sessionId: "kyle",
                chat: {
                    "main_chat": []
                },
                profile: {
                    name: "Kyle",
                    email: "kyle@example.com",
                    phone: "+1-555-123-4567",
                    locality: "Bandra West",
                    latitude: 19.0596,
                    longitude: 72.8295,
                    preferences: [
                        "loves trying new cuisines",
                        "enjoys continental and italian food",
                        "prefers non-vegetarian options",
                        "likes craft beer with meals"
                    ]
                },
                createdAt: "2025-11-13T11:34:41.771Z",
                updatedAt: "2025-11-13T11:34:44.725Z"
            },
            {
                sessionId: "banker",
                chat: {
                    "main_chat": []
                },
                profile: {
                    name: "Banker",
                    email: "banker@example.com",
                    phone: "+91-9876543213",
                    locality: "Connaught Place",
                    latitude: 28.6315,
                    longitude: 77.2167,
                    preferences: [
                        "prefers fine dining experiences",
                        "enjoys business lunch venues",
                        "likes both vegetarian and non-vegetarian",
                        "prefers restaurants with good ambiance"
                    ]
                },
                createdAt: "2025-11-13T11:34:41.771Z",
                updatedAt: "2025-11-13T11:34:44.725Z"
            }
        ];

        console.log('\n Creating dummy users...');

        // Store each user session
        for (const user of users) {
            const userKey = `users:${user.sessionId}`;
            await client.json.set(userKey, '$', user);
            console.log(`✅ Created user: ${user.profile.name} (${user.sessionId})`);
        }

        console.log('\n🎉 DUMMY USERS SEEDED SUCCESSFULLY!');
        console.log('\nYou can now visit:');
        console.log('• http://localhost:3000/?name=ashwin');
        console.log('• http://localhost:3000/?name=hariharan');
        console.log('• http://localhost:3000/?name=iyer');
        console.log('• http://localhost:3000/?name=kyle');
        console.log('• http://localhost:3000/?name=banker');

    } catch (error) {
        console.error('❌ Error seeding dummy users:', error);
    }
}

// Export for potential reuse and run if called directly
export { seedDummyUsers };

if (import.meta.url === `file://${process.argv[1]}`) {
    await seedDummyUsers();
    await client.quit();
}

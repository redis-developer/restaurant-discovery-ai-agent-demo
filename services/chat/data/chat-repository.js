import { createClient } from 'redis';
import { LangCache } from "@redis-ai/langcache";
import { SearchStrategy } from '@redis-ai/langcache/models/searchstrategy.js';

import CONFIG from '../../../config.js';

const client = await createClient({
    url: CONFIG.redisUrl,
}).on('error', (err) => console.log('Redis Client Error', err))
  .connect();

// Initialize LangCache client
const langCache = new LangCache({
    serverURL: CONFIG.langcacheApiBaseUrl,
    cacheId: CONFIG.langcacheCacheId,
    apiKey: CONFIG.langcacheApiKey,
});

/**
 * @typedef {Object} ChatMessage
 * @property {'user' | 'assistant'} role
 * @property {string} content
 */

export default class ChatRepository {

    /**
     * Retrieve chat history for a session and chat
     * @param {string} sessionId
     * @param {string} chatId
     * @returns {Promise<ChatMessage[]>}
     */
    async getOrCreateChatHistory(sessionId, chatId) {
        const userKey = `users:${sessionId}`;
        const chatHistory = await client.json.get(userKey, {
            path: `$.chat.${chatId}`,
        });

        if (!chatHistory) { // if user session itself does not exist
            // Create a new session with enhanced profile structure
            const capitalizedName = sessionId.charAt(0).toUpperCase() + sessionId.slice(1);
            await client.json.set(userKey, '$', {
                sessionId: sessionId,
                chat: {
                    [chatId]: [],
                },
                profile: {
                    name: capitalizedName,
                    email: `${sessionId}@example.com`,
                    phone: "+91-0000000000",
                    locality: "Unknown",
                    latitude: 0,
                    longitude: 0,
                    preferences: []
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            return [];
        } else if (chatHistory.length === 0) { // if user session exists but chatId does not
            await client.json.set(userKey, `$.chat.${chatId}`, []);
            return [];
        } else {
            return chatHistory[0];
        }
    }

    /**
     * Save a chat message to the conversation history
     * @param {string} sessionId
     * @param {string} chatId
     * @param {ChatMessage} message
     */
    async saveChatMessage(sessionId, chatId, message) {
        const userKey = `users:${sessionId}`;

        // Add timestamp to message
        const messageWithTimestamp = {
            ...message,
            timestamp: new Date().toISOString(),
        };

        await client.json.arrAppend(userKey, `$.chat.${chatId}`, messageWithTimestamp);

        // Update session timestamp
        await client.json.set(userKey, '$.updatedAt', new Date().toISOString());
    }

    /**
     * Search user query in semantic cache
     * @param {string} query
     * @param {string} [sessionId] - Optional session identifier to scope the search
     */
    async findFromSemanticCache(query, sessionId) {
        const searchParams = {
            prompt: query,
            searchStrategies: [SearchStrategy.Exact, SearchStrategy.Semantic],
        };

        // Only add sessionId to attributes if it's provided
        if (sessionId) {
            searchParams.attributes = {
                "sessionId": sessionId,
            };
        }

        const result = await langCache.search(searchParams);
        return result.data?.[0]?.response || null;
    }

    /**
     * Save results in Redis LangCache
     * @param {string} query - The original user query to store as the semantic prompt
     * @param {string} aiReplyMessage - The AI-generated response to be cached
     * @param {number} ttlMillis - Time-to-live in milliseconds for the cached entry
     * @param {string} [sessionId] - Optional unique identifier for the user session
     */
    async saveResponseInSemanticCache(query, aiReplyMessage, ttlMillis, sessionId) {
        const cacheParams = {
            prompt: query,
            response: aiReplyMessage,
            ttlMillis,
        };

        // Only add sessionId to attributes if it's provided
        if (sessionId) {
            cacheParams.attributes = {
                "sessionId": sessionId,
            };
        }

        const result = await langCache.set(cacheParams);
        return result;
    }

    /**
     * Delete all chats for a user session
     * @param {string} sessionId
     */
    async deleteChats(sessionId) {
        const userKey = `users:${sessionId}`;
        
        try {
            const exists = await client.exists(userKey);
            if (exists) {
                await client.del(userKey);
                return { success: true, message: 'Session data deleted successfully' };
            } else {
                return { success: true, message: 'No session data found to delete' };
            }
        } catch (error) {
            console.error('Error deleting session:', error);
            return { success: false, error: error.message };
        }
    }
}

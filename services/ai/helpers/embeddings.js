import OpenAI from 'openai';
import CONFIG from '../../../config.js';

let openai = null;

// Only initialize OpenAI if API key is available
if (CONFIG.openAiApiKey) {
    openai = new OpenAI({
        apiKey: CONFIG.openAiApiKey,
    });
}

/**
 * Generate embeddings for restaurant descriptions
 * @param {Array<string>} texts - Array of text descriptions
 * @returns {Promise<Array<number[]>>} Array of embedding vectors
 */
export async function generateEmbeddings(texts) {
    if (!CONFIG.openAiApiKey || !openai) {
        console.warn('⚠️  OpenAI API key not configured. Using mock embeddings for development.');
        // Return mock embeddings for development
        return texts.map(() => Array(1536).fill(0).map(() => Math.random() - 0.5));
    }

    const response = await openai.embeddings.create({
        model: "text-embedding-3-small", // More cost-effective
        input: texts,
    });

    return response.data.map(item => item.embedding);
}

/**
 * Generate embedding for a single text query
 * @param {string} text - Text to generate embedding for
 * @returns {Promise<number[]>} Embedding vector
 */
export async function generateEmbedding(text) {
    const embeddings = await generateEmbeddings([text]);
    return embeddings[0];
}

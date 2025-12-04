import { Router } from 'express';
import {
    processRestaurantInquiry,
    endUserSession,
    getChatHistory,
    checkSemanticCache,
    saveToSemanticCache,
} from '../domain/chat-service.js';

const router = Router();

// POST /chat - Main chat endpoint
router.post('/chat', async (req, res, next) => {
    try {
        const { message, sessionId, chatId, useSmartRecall } = req.body;

        // Validate required fields
        if (!message || !sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: message and sessionId are required',
            });
        }

        // Use default chatId if not provided
        const effectiveChatId = chatId || 'default';

        // Process the restaurant inquiry
        const reply = await processRestaurantInquiry(
            sessionId,
            effectiveChatId,
            message,
            useSmartRecall || false,
        );

        res.json({
            success: true,
            content: reply.content,
            isCachedResponse: reply.isCachedResponse,
        });

    } catch (error) {
        next(error);
    }
});

// POST /chat/end-session - End user session
router.post('/chat/end-session', async (req, res, next) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: sessionId',
            });
        }

        const result = await endUserSession(sessionId);
        res.json(result);

    } catch (error) {
        next(error);
    }
});

// GET /chat/history - Get chat history
router.get('/chat/history', async (req, res, next) => {
    try {
        const { sessionId, chatId } = req.query;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameter: sessionId',
            });
        }

        const effectiveChatId = chatId || 'default';
        const history = await getChatHistory(sessionId, effectiveChatId);

        res.json({
            success: true,
            history: history,
        });

    } catch (error) {
        next(error);
    }
});

// GET /chat/cache-check - Check semantic cache
router.get('/chat/cache-check', async (req, res, next) => {
    try {
        const { query, sessionId } = req.query;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameter: query',
            });
        }

        const cachedResponse = await checkSemanticCache(query, sessionId);

        res.json({
            success: true,
            cached: !!cachedResponse,
            response: cachedResponse,
        });

    } catch (error) {
        next(error);
    }
});

export default router;

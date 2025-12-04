import * as fs from "node:fs/promises";

import { StateGraph, START, END } from "@langchain/langgraph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

import { RestaurantAgentState } from "./state.js";
import { queryCacheCheck, restaurantDiscoveryAgent, processWorkOutputWithCaching } from "./nodes.js";

import ChatRepository from "../../chat/data/chat-repository.js";

const chatRepository = new ChatRepository();

/**
 * Create Agentic AI Restaurant Discovery Workflow
 *
 * This creates a multi-agent workflow system for intelligent restaurant discovery and reservations with:
 * 1. Smart caching for restaurant searches (long TTL) vs reservations (no cache)
 * 2. Specialized restaurant tools with location and preference support
 * 3. Restaurant search, discovery, and reservation management
 * 4. LLM-powered dining recommendations + real restaurant database
 */
export const createAgenticAIRestaurantWorkflow = () => {
    const graph = new StateGraph(RestaurantAgentState)
        .addNode("query_cache_check", queryCacheCheck)
        .addNode("restaurant_discovery_agent", restaurantDiscoveryAgent)
        .addNode("process_work_output_with_caching", processWorkOutputWithCaching)

        .addEdge(START, "query_cache_check")
        .addConditionalEdges("query_cache_check", (state) => {
            return state.cacheStatus === "hit" ? END : "restaurant_discovery_agent";
        })
        .addEdge("restaurant_discovery_agent", "process_work_output_with_caching")
        .addEdge("process_work_output_with_caching", END)

        .compile();

    visualizeGraph(graph);
    
    return graph;
};

// Lazy initialization to avoid circular imports
let _restaurantWorkflowGraph = null;
export const getRestaurantWorkflowGraph = () => {
    if (!_restaurantWorkflowGraph) {
        _restaurantWorkflowGraph = createAgenticAIRestaurantWorkflow();
    }
    return _restaurantWorkflowGraph;
};

export function getWorkflowExecutionSummary(graphResult) {
    const summary = {
        toolsUsed: graphResult.toolsUsed || ["none"],
        cacheStatus: graphResult.cacheStatus || "miss",
        finalResult: graphResult.result,
        sessionId: graphResult.sessionId,
        restaurantsFound: graphResult.foundRestaurants?.length || 0
    };
    
    console.log("\n🍽️ RESTAURANT DISCOVERY EXECUTION SUMMARY:");
    console.log(`Session: ${summary.sessionId}`);
    console.log(`Cache: ${summary.cacheStatus === "hit" ? "🎯 HIT" : "❌ MISS"}`);
    
    // Display all tools used
    if (summary.toolsUsed.length === 1 && summary.toolsUsed[0] === "none") {
        console.log(`Tools Used: 🧠 Direct Response (no tools)`);
    } else {
        const toolIcons = summary.toolsUsed.map(tool => {
            switch(tool) {
                case "direct_response": return "🧠 Direct Knowledge";
                case "search_restaurants": return "🔍 Restaurant Search";
                case "get_restaurant_details": return "🏪 Restaurant Details";
                case "get_popular_restaurants": return "⭐ Popular Restaurants";
                case "find_nearby_restaurants": return "📍 Nearby Search";
                case "make_reservation": return "📅 Make Reservation";
                case "direct_answer": return "🧠 Direct Answer";
                case "error": return "❌ Error";
                default: return `🔧 ${tool}`;
            }
        });
        console.log(`Tools Used: ${toolIcons.join(" → ")}`);
        console.log(`Tool Count: ${summary.toolsUsed.length}`);
    }
    
    if (summary.restaurantsFound > 0) {
        console.log(`Restaurants Found: ${summary.restaurantsFound}`);
    }
    console.log("─".repeat(50));
    
    return summary;
}

/**
 * Main function to execute the restaurant discovery workflow
 */
export async function runRestaurantAgentWorkflow(sessionId, chatId, message, useSmartRecall) {
    try {
        const rawHistory = await chatRepository.getOrCreateChatHistory(sessionId, chatId);

        // Convert raw history to LangChain message format
        const messages = rawHistory.map((msg) => {
            return msg.role === "user"
                ? new HumanMessage(msg.content)
                : new AIMessage(msg.content);
        });

        // Add the new user message
        const userMessage = new HumanMessage(message);
        messages.push(userMessage);

        // Run the restaurant discovery workflow graph
        const workflowGraph = getRestaurantWorkflowGraph();
        const result = await workflowGraph.invoke({
            sessionId,
            messages,
        });

        // Get execution summary for logging
        const executionSummary = getWorkflowExecutionSummary(result);

        const finalReply = result.result || result.output;

        const queryResult = {
            isCachedResponse: result.cacheStatus === "hit",
            content: finalReply,
        };

        // Save messages back to storage
        await chatRepository.saveChatMessage(sessionId, chatId, {
            role: "user",
            content: message,
        });

        await chatRepository.saveChatMessage(sessionId, chatId, {
            role: "assistant",
            content: finalReply,
        });

        return queryResult;
        
    } catch (error) {
        console.error("❌ Error in restaurant discovery reply:", error);
        
        // Return fallback response
        return {
            isCachedResponse: false,
            content: "I apologize, but I'm having trouble processing your restaurant request right now. Please try asking about restaurant recommendations, making reservations, or general dining questions."
        };
    }
}

async function visualizeGraph(graph) {
    try {
        const drawableGraph = await graph.getGraphAsync();
        const image = await drawableGraph.drawMermaidPng();
        const imageBuffer = new Uint8Array(await image.arrayBuffer());

        await fs.writeFile("technical-diagrams/ai-agent-graph.png", imageBuffer);
        console.log("📊 Workflow graph visualization saved to technical-diagrams/ai-agent-graph.png");
    } catch (error) {
        console.warn("⚠️ Could not generate workflow visualization:", error.message);
    }
}

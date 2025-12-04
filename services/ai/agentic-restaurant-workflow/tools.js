import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

import { z } from "zod";

// Import service functions
import { RestaurantService } from '../../restaurants/domain/restaurant-service.js';
import { ReservationService } from '../../reservations/domain/reservation-service.js';
import { UserService } from '../../users/domain/user-service.js';

// Import helper functions
import { AppError, HttpStatusCode } from '../../../lib/errors.js';
import { generateEmbedding } from '../helpers/embeddings.js';
import CONFIG from '../../../config.js';

const restaurantService = new RestaurantService();
const reservationService = new ReservationService();
const userService = new UserService();

/**
 * Tool: Unified Restaurant Search
 * Primary search tool that handles semantic search, location-based search, and all filters
 */
export const semanticSearchRestaurantsTool = tool(
    async ({ query, latitude, longitude, radius, cuisine, city, locality, type, maxPrice, minRating, limit, useSemanticSearch = true }) => {
        console.log(`🔍 Searching restaurants: "${query}"`);

        try {
            const maxResults = limit ? parseInt(limit) : 15;

            let result;

            // Primary search with all filters
            if (query && useSemanticSearch) {
                console.log(`Using semantic search with filters...`);
                const embedding = await generateEmbedding(query);

                result = await restaurantService.vectorSearchRestaurants(embedding, {
                    latitude: latitude ? parseFloat(latitude) : undefined,
                    longitude: longitude ? parseFloat(longitude) : undefined,
                    radius: radius ? parseFloat(radius) : 15,
                    cuisine,
                    city,
                    locality,
                    type,
                    maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
                    minRating: minRating ? parseFloat(minRating) : undefined,
                    limit: maxResults * 2, // Get more results for filtering
                });
            } else if (latitude && longitude) {
                console.log(`📍 Using location-based search...`);
                result = await restaurantService.findNearbyRestaurants({
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude),
                    radius: radius ? parseFloat(radius) : 15,
                    cuisine,
                    city,
                    maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
                    minRating: minRating ? parseFloat(minRating) : undefined,
                    limit: maxResults,
                });
            } else {
                console.log(`🌟 Fallback to popular restaurants...`);
                result = await restaurantService.getPopularRestaurants({ city, limit: maxResults, cuisine });
            }

            // Retry logic - remove cuisine filter if no results
            if (result.restaurants.length === 0 && cuisine) {
                console.log(`🔄 No results with cuisine "${cuisine}", retrying without cuisine filter...`);

                if (query && useSemanticSearch) {
                    const embedding = await generateEmbedding(query);
                    result = await restaurantService.vectorSearchRestaurants(embedding, {
                        latitude: latitude ? parseFloat(latitude) : undefined,
                        longitude: longitude ? parseFloat(longitude) : undefined,
                        radius: radius ? parseFloat(radius) : 15,
                        city,
                        locality,
                        type,
                        maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
                        minRating: minRating ? parseFloat(minRating) : undefined,
                        limit: maxResults * 2,
                    });
                } else if (latitude && longitude) {
                    result = await restaurantService.findNearbyRestaurants({
                        latitude: parseFloat(latitude),
                        longitude: parseFloat(longitude),
                        radius: radius ? parseFloat(radius) : 15,
                        city,
                        maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
                        minRating: minRating ? parseFloat(minRating) : undefined,
                        limit: maxResults,
                    });
                }
            }

            // Final fallback to popular restaurants
            if (result.restaurants.length === 0) {
                console.log(`🔄 No specific results found, showing popular restaurants, limit is...`, maxResults);
                result = await restaurantService.getPopularRestaurants({ city, limit: maxResults });
            }

            // Limit final results
            const finalRestaurants = result.restaurants;

            return JSON.stringify({
                type: "restaurant_search",
                success: finalRestaurants.length > 0,
                query: query,
                searchStrategy: query && useSemanticSearch ? "semantic" : (latitude && longitude ? "location" : "popular"),
                totalFound: finalRestaurants.length,
                restaurants: finalRestaurants,
                searchParams: { query, location: !!(latitude && longitude), filters: { cuisine, city, locality, type, maxPrice, minRating } },
                message: finalRestaurants.length > 0
                    ? `Found ${finalRestaurants.length} restaurants matching your preferences.`
                    : `No restaurants found matching your criteria. Try different keywords or filters.`,
            });

        } catch (error) {
            console.error('Error in restaurant search:', error);
            return JSON.stringify({
                type: "restaurant_search",
                success: false,
                error: `Sorry, I had trouble searching for restaurants. Please try rephrasing your request.`,
            });
        }
    },
    {
        name: "semantic_search_restaurants",
        description: "🍽️ UNIFIED RESTAURANT SEARCH - Primary search tool for all restaurant queries! Handles semantic search, location-based search, and filters. Use for ANY restaurant search query.",
        schema: z.object({
            query: z.string().describe("Search query (e.g., 'romantic dinner with live music', 'Italian restaurant', 'good food')"),
            latitude: z.string().optional().describe("Latitude coordinate for location-based search"),
            longitude: z.string().optional().describe("Longitude coordinate for location-based search"),
            radius: z.string().optional().describe("Search radius in kilometers (default: 5)"),
            cuisine: z.string().optional().describe("Cuisine filter (e.g., 'Italian', 'Chinese', 'Indian')"),
            city: z.string().optional().describe("City filter (e.g., 'Delhi', 'Mumbai')"),
            locality: z.string().optional().describe("Locality filter (e.g., 'Khan Market', 'Connaught Place')"),
            type: z.string().optional().describe("Restaurant type filter (e.g., 'Fine Dining', 'Casual Dining', 'Quick Bites')"),
            maxPrice: z.string().optional().describe("Maximum price for 2 people"),
            minRating: z.string().optional().describe("Minimum rating filter (e.g., '4.0')"),
            limit: z.string().optional().describe("Maximum number of results (default: 5, max: 10)"),
            useSemanticSearch: z.boolean().optional().describe("Use semantic search for descriptive queries (default: true)"),
        })
    }
);

/**
 * Tool: Find Nearby Restaurants
 * Find restaurants near user's location from their profile
 */
export const findNearbyRestaurantsTool = tool(
    async ({ sessionId, radius, limit }) => {
        console.log(`📍 Finding restaurants near user's location for session: ${sessionId}`);

        try {
            // Get user location from profile
            const userLocation = await userService.getUserLocation(sessionId);

            if (!userLocation) {
                return JSON.stringify({
                    type: "nearby_restaurants",
                    success: false,
                    error: "Sorry, I don't have your location information. Please make sure your profile is set up correctly.",
                });
            }

            const radiusKm = radius ? parseFloat(radius) : 5;
            const maxResults = limit ? parseInt(limit) : 10;

            const result = await restaurantService.getRestaurantsByLocation(
                userLocation.latitude,
                userLocation.longitude,
                radiusKm,
                maxResults,
            );

            return JSON.stringify({
                type: "nearby_restaurants",
                success: true,
                restaurants: result.restaurants,
                searchCenter: {
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                    locality: userLocation.locality,
                },
                radiusKm: radiusKm,
                message: `Found ${result.restaurants.length} restaurants within ${radiusKm}km of your location in ${userLocation.locality}.`,
            });

        } catch (error) {
            console.error('Error finding nearby restaurants:', error);
            return JSON.stringify({
                type: "nearby_restaurants",
                success: false,
                error: `Sorry, I had trouble finding restaurants near your location. Please try again.`,
            });
        }
    },
    {
        name: "find_nearby_restaurants",
        description: "📍 LOCATION-BASED SEARCH - Find restaurants near the user's location from their profile. Use when user asks 'restaurants near me' or wants location-based recommendations. Automatically uses their saved location.",
        schema: z.object({
            sessionId: z.string().describe("User session ID to fetch location from profile"),
            radius: z.string().optional().describe("Search radius in kilometers (default: 5, max: 20)"),
            limit: z.string().optional().describe("Maximum number of results (default: 10, max: 20)"),
        })
    }
);

/**
 * Tool: Get Popular Restaurants
 * Get popular restaurants with optional filters
 */
export const getPopularRestaurantsTool = tool(
    async ({ limit, city, cuisine }) => {
        console.log(`⭐ Getting popular restaurants`);

        try {
            const options = {
                limit: limit ? parseInt(limit) : 10,
                city,
                cuisine,
            };
            const result = await restaurantService.getPopularRestaurants(options);

            return JSON.stringify({
                type: "popular_restaurants",
                success: true,
                restaurants: result.restaurants,
                message: `Here are the most popular restaurants${city ? ` in ${city}` : ''}${cuisine ? ` for ${cuisine} cuisine` : ''}.`,
            });

        } catch (error) {
            console.error('Error getting popular restaurants:', error);
            return JSON.stringify({
                type: "popular_restaurants",
                success: false,
                error: `Sorry, I had trouble getting popular restaurants. Please try again.`,
            });
        }
    },
    {
        name: "get_popular_restaurants",
        description: "🌟 POPULAR RESTAURANTS - Get trending and top-rated restaurants. Use when user asks for 'popular', 'best', 'top-rated', 'trending', or 'what's hot'. Perfect for general recommendations without specific criteria.",
        schema: z.object({
            limit: z.string().optional().describe("Maximum number of results (default: 10, max: 20)"),
            city: z.string().optional().describe("City filter (e.g., 'Delhi', 'Mumbai')"),
            cuisine: z.string().optional().describe("Cuisine filter (e.g., 'Italian', 'Chinese')"),
        }),
    }
);

/**
 * Tool: Get Restaurant Details
 * Get detailed information about a specific restaurant
 */
export const getRestaurantDetailsTool = tool(
    async ({ restaurantId }) => {
        console.log(`🏪 Getting details for restaurant: ${restaurantId}`);

        try {
            const restaurant = await restaurantService.getRestaurantById(restaurantId);

            return JSON.stringify({
                type: "restaurant_details",
                success: true,
                restaurant: restaurant,
                message: `Here are the details for ${restaurant.name}.`,
            });

        } catch (error) {
            console.error('Error getting restaurant details:', error);
            return JSON.stringify({
                type: "restaurant_details",
                success: false,
                error: `Sorry, I couldn't find details for that restaurant. Please check the restaurant ID.`,
            });
        }
    },
    {
        name: "get_restaurant_details",
        description: "🔍 RESTAURANT DETAILS - Get comprehensive information about a specific restaurant. Use when user asks 'tell me more about [restaurant]' or wants details about a restaurant from previous search results. Returns full restaurant profile.",
        schema: z.object({
            restaurantId: z.string().describe("The unique restaurant ID (e.g., 'tonino-6fbacd23') from previous search results"),
        })
    }
);

/**
 * Tool: Make Reservation
 * Create a restaurant reservation using customer details from user profile
 */
export const makeReservationTool = tool(
    async ({ sessionId, restaurantId, date, time, guests, specialRequests }) => {
        console.log(`📅 Making reservation for restaurant: ${restaurantId}`);

        try {
            const result = await reservationService.createReservation({
                sessionId,
                restaurantId,
                date,
                time,
                guests: parseInt(guests),
                specialRequests,
            });

            return JSON.stringify({
                type: "reservation",
                success: true,
                reservation: result.reservation,
                restaurant: result.restaurant,
                message: `✅ Reservation confirmed at **${result.restaurant.name}** on ${date} at ${time} for ${guests} guests (ID: ${result.restaurant.id})`,
            });

        } catch (error) {
            console.error('Error making reservation:', error);
            return JSON.stringify({
                type: "reservation",
                success: false,
                error: `Sorry, I couldn't make the reservation. ${error.message || 'Please try again.'}`,
            });
        }
    },
    {
        name: "make_reservation",
        description: "📅 MAKE RESERVATION - Book a table at a restaurant using customer details from user profile. Use when user says 'book', 'reserve', 'make reservation'. Automatically uses their saved contact information.",
        schema: z.object({
            sessionId: z.string().describe("User session ID to fetch customer details from profile"),
            restaurantId: z.string().describe("Restaurant ID from previous search (e.g., 'tonino-6fbacd23')"),
            date: z.string().describe("Reservation date in YYYY-MM-DD format (e.g., '2024-11-15')"),
            time: z.string().describe("Reservation time in HH:MM format (e.g., '19:00')"),
            guests: z.string().describe("Number of guests (e.g., '2', '4')"),
            specialRequests: z.string().optional().describe("Special requests, dietary requirements, or occasion notes"),
        })
    }
);

/**
 * Tool: Get User Reservations
 * Fetch all reservations for a user session
 */
export const getUserReservationsTool = tool(
    async ({ sessionId }) => {
        console.log(`📋 Getting reservations for session: ${sessionId}`);

        try {
            const result = await reservationService.getSessionReservations(sessionId);

            // Format reservations with restaurant IDs
            const formattedReservations = result.reservations.map(reservation => {
                const restaurantName = reservation.restaurant ? reservation.restaurant.name : 'Unknown Restaurant';
                return `**${restaurantName}** - ${reservation.date} at ${reservation.time} for ${reservation.guests} guests (ID: ${reservation.restaurantId})`;
            }).join('\n');

            const message = result.summary.totalReservations > 0
                ? `📋 **Your Reservations:**\n\n${formattedReservations}`
                : "You don't have any reservations yet.";

            return JSON.stringify({
                type: "user_reservations",
                success: true,
                reservations: result.reservations,
                summary: result.summary,
                message: message
            });

        } catch (error) {
            console.error('Error getting user reservations:', error);
            return JSON.stringify({
                type: "user_reservations",
                success: false,
                error: `Sorry, I couldn't retrieve your reservations. ${error.message || 'Please try again.'}`
            });
        }
    },
    {
        name: "get_user_reservations",
        description: "📋 GET RESERVATIONS - Fetch all reservations for the current user. Use when user asks 'show my reservations', 'my bookings', 'what reservations do I have', or wants to see their reservation history.",
        schema: z.object({
            sessionId: z.string().describe("User session ID to fetch reservations for")
        })
    }
);

/**
 * Tool: Cancel Reservation
 * Cancel an existing reservation for the user
 */
export const cancelReservationTool = tool(
    async ({ reservationId }) => {
        console.log(`❌ Canceling reservation: ${reservationId}`);

        try {
            const result = await reservationService.cancelReservation(reservationId);

            return JSON.stringify({
                type: "reservation_cancellation",
                success: true,
                reservation: result.reservation,
                restaurant: result.restaurant,
                message: `Your reservation at ${result.restaurant.name} on ${result.reservation.date} at ${result.reservation.time} has been successfully canceled.`
            });

        } catch (error) {
            console.error('Error canceling reservation:', error);
            return JSON.stringify({
                type: "reservation_cancellation",
                success: false,
                error: `Sorry, I couldn't cancel your reservation. ${error.message || 'Please try again.'}`
            });
        }
    },
    {
        name: "cancel_reservation",
        description: "❌ CANCEL RESERVATION - Cancel an existing reservation. Use ONLY with a valid reservation ID from a previous reservation list. ALWAYS call get_user_reservations first to get valid reservation IDs.",
        schema: z.object({
            reservationId: z.string().describe("Exact reservation ID from previous reservation list (e.g., 'reservation_abc123')")
        })
    }
);

/**
 * Tool: Direct Answer
 * Returns structured data with the answer content for general restaurant questions
 */
export const directAnswerTool = tool(
    async ({ question }) => {
        console.log(`🧠 Direct answer for: "${question}"`);

        try {
            // Direct LLM call for general questions
            const model = new ChatOpenAI({
                temperature: 0.2,
                model: CONFIG.modelName,
                apiKey: CONFIG.openAiApiKey
            });

            const systemPrompt = `You are a knowledgeable restaurant and dining assistant. Answer questions about:
- Restaurant recommendations and cuisine types
- Dining etiquette and customs
- Food preparation and cooking methods
- Restaurant industry insights
- Local dining culture and trends

Keep responses helpful, informative, and concise. If the question requires specific restaurant data, suggest using restaurant search tools instead.`;

            const response = await model.invoke([
                { role: "system", content: systemPrompt },
                new HumanMessage(question)
            ]);

            return JSON.stringify({
                type: "direct_answer",
                success: true,
                answer: response.content,
                message: response.content
            });

        } catch (error) {
            console.error('Error in direct answer:', error);
            return JSON.stringify({
                type: "direct_answer",
                success: false,
                error: "I'm having trouble answering that question right now. Please try rephrasing or ask about specific restaurants."
            });
        }
    },
    {
        name: "direct_answer",
        description: "🧠 GENERAL DINING KNOWLEDGE - Answer general questions about dining, cuisine, etiquette, cooking tips. Use for questions that don't need specific restaurant searches. NOT for finding restaurants!",
        schema: z.object({
            question: z.string().describe("General dining/food question (e.g., 'What is authentic Italian cuisine?', 'Dining etiquette tips')")
        })
    }
);


// Export all tools as an array
export const restaurantTools = [
    semanticSearchRestaurantsTool,
    getRestaurantDetailsTool,
    getPopularRestaurantsTool,
    makeReservationTool,
    getUserReservationsTool,
    cancelReservationTool,
    directAnswerTool,
];

import { RestaurantRepository } from '../data/restaurant-repository.js';
import { AppError, HttpStatusCode } from '../../../lib/errors.js';

/**
 * Restaurant Service - Business logic layer for restaurant operations
 * Handles all restaurant-related business rules and validation
 */
export class RestaurantService {
    constructor() {
        this.restaurantRepository = new RestaurantRepository();
    }

    /**
     * Get restaurant by ID with validation
     * @param {string} restaurantId - Restaurant ID
     * @returns {Promise<Object>} Restaurant data
     * @throws {AppError} If restaurant not found
     */
    async getRestaurantById(restaurantId) {
        if (!restaurantId) {
            throw new AppError(
                'INVALID_RESTAURANT_ID',
                'Restaurant ID is required',
                HttpStatusCode.BAD_REQUEST,
            );
        }

        const restaurant = await this.restaurantRepository.getRestaurantById(restaurantId);

        if (!restaurant) {
            throw new AppError(
                'RESTAURANT_NOT_FOUND',
                `Restaurant with ID ${restaurantId} not found`,
                HttpStatusCode.NOT_FOUND,
            );
        }

        return restaurant;
    }

    /**
     * Search restaurants with validation and business logic
     * @param {Object} searchParams - Search parameters
     * @returns {Promise<Object>} Search results with metadata
     */
    async searchRestaurants(searchParams = {}) {
        const {
            query = '',
            cuisine,
            city,
            locality,
            type,
            maxPrice,
            minRating,
            limit = 10,
        } = searchParams;

        // Validate and sanitize inputs
        const validatedParams = this._validateSearchParams({
            query,
            cuisine,
            city,
            locality,
            type,
            maxPrice,
            minRating,
            limit,
        });

        const restaurants = await this.restaurantRepository.searchRestaurants(validatedParams);

        return {
            restaurants,
            totalResults: restaurants.length,
            searchParams: validatedParams,
            hasMore: restaurants.length === validatedParams.limit,
        };
    }

    /**
     * Get restaurants by location with validation
     * @param {number} latitude - Latitude
     * @param {number} longitude - Longitude
     * @param {number} radiusKm - Radius in kilometers (default: 5, max: 50)
     * @param {number} limit - Maximum results (default: 10, max: 50)
     * @returns {Promise<Object>} Nearby restaurants with metadata
     */
    async getRestaurantsByLocation(latitude, longitude, radiusKm = 5, limit = 10) {
        // Validate coordinates
        if (!this._isValidLatitude(latitude) || !this._isValidLongitude(longitude)) {
            throw new AppError(
                'INVALID_COORDINATES',
                'Invalid latitude or longitude provided',
                HttpStatusCode.BAD_REQUEST,
            );
        }

        // Validate radius
        const validRadius = Math.min(Math.max(radiusKm, 0.1), 50); // Between 0.1km and 50km
        const validLimit = Math.min(Math.max(limit, 1), 50); // Between 1 and 50

        const restaurants = await this.restaurantRepository.getRestaurantsByLocation(
            latitude,
            longitude,
            validRadius,
            validLimit,
        );

        return {
            restaurants,
            totalResults: restaurants.length,
            searchCenter: { latitude, longitude },
            radiusKm: validRadius,
            hasMore: restaurants.length === validLimit,
        };
    }

    /**
     * Find nearby restaurants with filters (alias for getRestaurantsByLocation with filters)
     * @param {Object} options - Search options
     * @param {number} options.latitude - Latitude
     * @param {number} options.longitude - Longitude
     * @param {number} options.radius - Radius in kilometers (default: 5)
     * @param {string} options.cuisine - Cuisine filter
     * @param {string} options.city - City filter
     * @param {number} options.maxPrice - Maximum price filter
     * @param {number} options.minRating - Minimum rating filter
     * @param {number} options.limit - Maximum results (default: 10)
     * @returns {Promise<Object>} Nearby restaurants with metadata
     */
    async findNearbyRestaurants(options = {}) {
        const {
            latitude,
            longitude,
            radius = 5,
            cuisine,
            city,
            maxPrice,
            minRating,
            limit = 10,
        } = options;

        // For now, use the existing location method and apply filters
        // TODO: Enhance repository to handle filters in location search
        const result = await this.getRestaurantsByLocation(latitude, longitude, radius, limit * 2);

        // Apply additional filters
        let filteredRestaurants = result.restaurants.filter(restaurant => {
            if (cuisine && !restaurant.cuisine.toLowerCase().includes(cuisine.toLowerCase())) {
                return false;
            }
            if (city && restaurant.city.toLowerCase() !== city.toLowerCase()) {
                return false;
            }
            if (maxPrice && restaurant.priceFor2 > maxPrice) {
                return false;
            }
            if (minRating && restaurant.rating < minRating) {
                return false;
            }
            return true;
        });

        // Limit results
        filteredRestaurants = filteredRestaurants.slice(0, limit);

        return {
            restaurants: filteredRestaurants,
            totalFound: filteredRestaurants.length,
            searchType: 'location',
            filters: { cuisine, city, maxPrice, minRating },
            searchCenter: { latitude, longitude },
            radiusKm: radius,
        };
    }

    /**
     * Get popular restaurants based on rating and other factors
     * @param {Object} options - Search options
     * @param {string} options.city - Optional city filter
     * @param {number} options.limit - Maximum results (default: 10, max: 50)
     * @param {string} options.cuisine - Optional cuisine filter
     * @returns {Promise<Object>} Popular restaurants
     */
    async getPopularRestaurants(options = {}) {
        const { city, limit = 10, cuisine } = options;
        const validLimit = Math.min(Math.max(limit, 1), 50);

        const searchParams = {
            query: '*',
            minRating: 4.0, // Only highly rated restaurants
            limit: validLimit,
            city,
            cuisine,
        };

        const restaurants = await this.restaurantRepository.searchRestaurants(searchParams);

        // Sort by rating descending, then by review count if available
        const sortedRestaurants = restaurants.sort((a, b) => {
            if (b.rating !== a.rating) {
                return b.rating - a.rating;
            }
            // Secondary sort by review count if available
            return (b.reviewCount || 0) - (a.reviewCount || 0);
        });

        return {
            restaurants: sortedRestaurants,
            totalResults: sortedRestaurants.length,
            criteria: 'Popular restaurants (rating >= 4.0)',
            filters: { city, cuisine },
        };
    }

    /**
     * Get restaurant filter options for UI
     * @returns {Promise<Object>} Available filter options
     */
    async getFilterOptions() {
        const stats = await this.restaurantRepository.getRestaurantStats();

        return {
            cuisines: stats.cuisines,
            cities: stats.cities,
            types: stats.types,
            priceRanges: [
                { label: 'Budget (Under ₹500)', min: 0, max: 500 },
                { label: 'Mid-range (₹500-₹1000)', min: 500, max: 1000 },
                { label: 'Premium (₹1000-₹2000)', min: 1000, max: 2000 },
                { label: 'Luxury (Above ₹2000)', min: 2000, max: 10000 }
            ],
            ratingRanges: [
                { label: '4.5+ Stars', min: 4.5 },
                { label: '4.0+ Stars', min: 4.0 },
                { label: '3.5+ Stars', min: 3.5 },
                { label: '3.0+ Stars', min: 3.0 }
            ],
        };
    }

    /**
     * Validate search parameters
     * @private
     */
    _validateSearchParams(params) {
        const {
            query,
            cuisine,
            city,
            locality,
            type,
            maxPrice,
            minRating,
            limit,
        } = params;

        // Validate limit
        const validLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 50);

        // Validate price
        const validMaxPrice = maxPrice ? Math.max(parseInt(maxPrice), 0) : undefined;

        // Validate rating
        const validMinRating = minRating ? Math.min(Math.max(parseFloat(minRating), 0), 5) : undefined;

        // Sanitize string inputs
        const sanitizedQuery = query ? query.trim() : '';
        const sanitizedCuisine = cuisine ? cuisine.trim() : undefined;
        const sanitizedCity = city ? city.trim() : undefined;
        const sanitizedLocality = locality ? locality.trim() : undefined;
        const sanitizedType = type ? type.trim() : undefined;

        return {
            query: sanitizedQuery,
            cuisine: sanitizedCuisine,
            city: sanitizedCity,
            locality: sanitizedLocality,
            type: sanitizedType,
            maxPrice: validMaxPrice,
            minRating: validMinRating,
            limit: validLimit,
        };
    }

    /**
     * Validate latitude
     * @private
     */
    _isValidLatitude(lat) {
        return typeof lat === 'number' && lat >= -90 && lat <= 90;
    }

    /**
     * Validate longitude
     * @private
     */
    _isValidLongitude(lng) {
        return typeof lng === 'number' && lng >= -180 && lng <= 180;
    }

    /**
     * Get restaurant statistics
     * @returns {Promise<Object>} Restaurant statistics
     */
    async getRestaurantStats() {
        return await this.restaurantRepository.getRestaurantStats();
    }

    /**
     * Search restaurants using vector similarity with optional filters
     * @param {Array<number>} queryVector - Query embedding vector
     * @param {Object} options - Search options and filters
     * @param {number} options.limit - Maximum results (default: 10)
     * @param {number} options.latitude - Latitude for location filter
     * @param {number} options.longitude - Longitude for location filter
     * @param {number} options.radius - Search radius in km (default: 5)
     * @param {string} options.cuisine - Cuisine filter
     * @param {string} options.city - City filter
     * @param {string} options.locality - Locality filter
     * @param {string} options.type - Restaurant type filter
     * @param {number} options.maxPrice - Maximum price filter
     * @param {number} options.minRating - Minimum rating filter
     * @returns {Promise<Object>} Search results with metadata
     */
    async vectorSearchRestaurants(queryVector, options = {}) {
        if (!queryVector || !Array.isArray(queryVector)) {
            throw new AppError(
                'INVALID_QUERY_VECTOR',
                'Query vector is required and must be an array',
                HttpStatusCode.BAD_REQUEST,
            );
        }

        const {
            limit = 10,
            latitude,
            longitude,
            radius = 5,
            cuisine,
            city,
            locality,
            type,
            maxPrice,
            minRating,
        } = options;

        // Validate location coordinates if provided
        if ((latitude && !longitude) || (!latitude && longitude)) {
            throw new AppError(
                'INVALID_COORDINATES',
                'Both latitude and longitude must be provided for location filtering',
                HttpStatusCode.BAD_REQUEST,
            );
        }

        if (latitude && longitude) {
            if (!this._isValidLatitude(latitude) || !this._isValidLongitude(longitude)) {
                throw new AppError(
                    'INVALID_COORDINATES',
                    'Invalid latitude or longitude provided',
                    HttpStatusCode.BAD_REQUEST,
                );
            }
        }

        const restaurants = await this.restaurantRepository.vectorSearchRestaurants(
            queryVector,
            options
        );

        return {
            restaurants,
            totalFound: restaurants.length,
            searchType: 'semantic',
            filters: { latitude, longitude, radius, cuisine, city, locality, type, maxPrice, minRating },
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Check if restaurant exists
     * @param {string} restaurantId - Restaurant ID
     * @returns {Promise<boolean>} True if restaurant exists
     */
    async restaurantExists(restaurantId) {
        if (!restaurantId) {
            return false;
        }
        return await this.restaurantRepository.restaurantExists(restaurantId);
    }
}

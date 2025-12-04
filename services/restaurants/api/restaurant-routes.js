import { Router } from 'express';
import { RestaurantService } from '../domain/restaurant-service.js';

import { AppError, HttpStatusCode } from '../../../lib/errors.js';

const router = Router();
const restaurantService = new RestaurantService();

/**
 * GET /api/restaurants - Search restaurants
 * Query parameters:
 * - q: search query
 * - cuisine: cuisine filter
 * - city: city filter
 * - locality: locality filter
 * - type: restaurant type filter
 * - maxPrice: maximum price filter
 * - minRating: minimum rating filter
 * - limit: maximum results (default: 10, max: 50)
 */
router.get('/', async (req, res, next) => {
    try {
        const {
            q: query,
            cuisine,
            city,
            locality,
            type,
            maxPrice,
            minRating,
            limit,
        } = req.query;

        const searchParams = {
            query,
            cuisine,
            city,
            locality,
            type,
            maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
            minRating: minRating ? parseFloat(minRating) : undefined,
            limit: limit ? parseInt(limit) : undefined
        };

        const result = await restaurantService.searchRestaurants(searchParams);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/restaurants/:id - Get restaurant by ID
 */
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        const restaurant = await restaurantService.getRestaurantById(id);

        res.json({
            success: true,
            data: restaurant,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/restaurants/popular - Get popular restaurants
 * Query parameters:
 * - limit: maximum results (default: 10, max: 50)
 * - city: optional city filter
 * - cuisine: optional cuisine filter
 */
router.get('/popular', async (req, res, next) => {
    try {
        const { limit, city, cuisine } = req.query;

        const options = {
            limit: limit ? parseInt(limit) : 10,
            city,
            cuisine,
        };

        const result = await restaurantService.getPopularRestaurants(options);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/restaurants/filters - Get available filter options
 */
router.get('/filters', async (req, res, next) => {
    try {
        const filterOptions = await restaurantService.getFilterOptions();
    
        res.json({
            success: true,
            data: filterOptions,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/restaurants/stats - Get restaurant statistics
 */
router.get('/stats', async (req, res, next) => {
    try {
        const stats = await restaurantService.getRestaurantStats();
    
        res.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        next(error);
    }
});

// ===== GEOSPATIAL ENDPOINTS =====

/**
 * GET /api/restaurants/location/nearby - Get restaurants by location using service
 * Query parameters:
 * - lat: latitude (required)
 * - lng: longitude (required)
 * - radius: radius in kilometers (default: 5, max: 50)
 * - limit: maximum results (default: 10, max: 50)
 */
router.get('/location/nearby', async (req, res, next) => {
    try {
        const { lat, lng, radius, limit } = req.query;

        if (!lat || !lng) {
            throw new AppError(
                'MISSING_COORDINATES',
                'Latitude and longitude are required',
                HttpStatusCode.BAD_REQUEST,
            );
        }

        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);
        const radiusKm = radius ? parseFloat(radius) : 5;
        const maxResults = limit ? parseInt(limit) : 10;

        const result = await restaurantService.getRestaurantsByLocation(
            latitude,
            longitude,
            radiusKm,
            maxResults,
        );

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
});



export default router;

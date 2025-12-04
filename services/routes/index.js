import { Router } from 'express';
import CONFIG from '../../config.js';
import { RestaurantService } from '../restaurants/domain/restaurant-service.js';
import { UserService } from '../users/domain/user-service.js';

const router = Router();
const restaurantService = new RestaurantService();
const userService = new UserService();

/* GET home page - directly serve the chat interface */
router.get('/', async function(req, res, next) {
	try {
		// Get sessionId from URL params (same as client-side SessionService)
		const sessionId = req.query.sessionId || req.query.name || 'foodie';

		// Get user profile including locality
		const userProfile = await userService.getUserProfile(sessionId.toLowerCase());
		console.log(userProfile);
		res.render('chat', {
			app_name: CONFIG.appName || 'Relish',
			user: userProfile || { name: sessionId.charAt(0).toUpperCase() + sessionId.slice(1), locality: 'Unknown Location' }
		});
	} catch (error) {
		console.error('Error loading user profile:', error);
		res.render('chat', {
			app_name: CONFIG.appName || 'Relish',
			user: { name: 'Guest', locality: 'Unknown Location' }
		});
	}
});

/* GET restaurant details page */
router.get('/restaurant/:restaurantId', async function(req, res, next) {
	const { restaurantId } = req.params;

	try {
		const restaurant = await restaurantService.getRestaurantById(restaurantId);
		
		if (!restaurant) {
			return res.status(404).render('error', { 
				message: 'Restaurant not found',
				error: { status: 404 },
			});
		}

		res.render('restaurant', { 
			app_name: CONFIG.appName || 'Relish',
			restaurant: restaurant,
		});
	} catch (error) {
		console.error('Error loading restaurant page:', error);
		res.status(500).render('error', {
			message: 'Failed to load restaurant',
			error: { status: 500 },
		});
	}
});

export default router;

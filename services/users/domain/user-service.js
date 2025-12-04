import { createClient } from 'redis';
import CONFIG from '../../../config.js';

const client = await createClient({
    url: CONFIG.redisUrl,
}).on('error', (err) => console.log('Redis Client Error', err))
  .connect();

/**
 * User Service - Simple service to fetch user profile data
 */
export class UserService {

    /**
     * Get user profile data from Redis
     * @param {string} sessionId - User session ID
     * @returns {Promise<Object|null>} User profile or null if not found
     */
    async getUserProfile(sessionId) {
        try {
            const userKey = `users:${sessionId}`;
            const profile = await client.json.get(userKey, { path: '$.profile' });
            
            if (profile && profile.length > 0) {
                return profile[0];
            }
            
            return null;
        } catch (error) {
            console.error('Error fetching user profile:', error);
            return null;
        }
    }

    /**
     * Get user location (latitude, longitude) from profile
     * @param {string} sessionId - User session ID
     * @returns {Promise<Object|null>} Location object {latitude, longitude} or null
     */
    async getUserLocation(sessionId) {
        const profile = await this.getUserProfile(sessionId);
        
        if (profile && profile.latitude && profile.longitude) {
            return {
                latitude: profile.latitude,
                longitude: profile.longitude,
                locality: profile.locality || 'Unknown',
            };
        }
        
        return null;
    }

    /**
     * Get user contact details from profile
     * @param {string} sessionId - User session ID
     * @returns {Promise<Object|null>} Contact details {name, email, phone} or null
     */
    async getUserContactDetails(sessionId) {
        const profile = await this.getUserProfile(sessionId);
        
        if (profile) {
            return {
                name: profile.name || 'Guest',
                email: profile.email || '',
                phone: profile.phone || '',
            };
        }
        
        return null;
    }
}

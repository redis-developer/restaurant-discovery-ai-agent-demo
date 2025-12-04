import { createClient } from 'redis';
import { AppError, HttpStatusCode } from '../../../lib/errors.js';
import CONFIG from '../../../config.js';

const client = await createClient({
    url: CONFIG.redisUrl,
}).on('error', (err) => console.log('Redis Client Error', err))
  .connect();

/**
 * Reservation Repository - Data access layer for reservation operations
 * Handles all Redis operations for reservation data
 */
export class ReservationRepository {
    constructor() {
        this.keyPrefix = 'reservations:';
        this.sessionPrefix = 'users:';
    }

    /**
     * Create a new reservation
     * @param {Object} reservationData - Reservation data
     * @returns {Promise<Object>} Created reservation
     */
    async createReservation(reservationData) {
        try {
            const reservationId = this._generateReservationId();
            const reservation = {
                id: reservationId,
                ...reservationData,
                status: 'confirmed',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            // Store reservation using HSET - ensure all values are strings
            const flatReservation = {};
            for (const [key, value] of Object.entries(reservation)) {
                // Convert all values to strings for Redis HSET
                flatReservation[key] = typeof value === 'object' && value !== null
                    ? JSON.stringify(value)
                    : String(value);
            }
            await client.hSet(`${this.keyPrefix}${reservationId}`, flatReservation);

            // Add to session reservations
            await client.sAdd(`${this.sessionPrefix}${reservationData.sessionId}:reservations`, reservationId);

            return reservation;

        } catch (error) {
            console.error('Error creating reservation:', error);
            throw new AppError(
                'RESERVATION_CREATE_ERROR',
                'Failed to create reservation',
                HttpStatusCode.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Get reservation by ID
     * @param {string} reservationId - Reservation ID
     * @returns {Promise<Object|null>} Reservation data or null
     */
    async getReservationById(reservationId) {
        try {
            const reservation = await client.hGetAll(`${this.keyPrefix}${reservationId}`);
            return Object.keys(reservation).length > 0 ? reservation : null;
        } catch (error) {
            console.error('Error getting reservation:', error);
            throw new AppError(
                'RESERVATION_FETCH_ERROR',
                `Failed to fetch reservation: ${reservationId}`,
                HttpStatusCode.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Update a reservation
     * @param {string} reservationId - Reservation ID
     * @param {Object} reservationData - Updated reservation data
     * @returns {Promise<Object>} Updated reservation
     */
    async updateReservation(reservationId, reservationData) {
        try {
            const flatData = {
                ...reservationData,
                updatedAt: new Date().toISOString()
            };
            await client.hSet(`${this.keyPrefix}${reservationId}`, flatData);
            return flatData;
        } catch (error) {
            console.error('Error updating reservation:', error);
            throw new AppError(
                'RESERVATION_UPDATE_ERROR',
                'Failed to update reservation',
                HttpStatusCode.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Get reservations by session ID
     * @param {string} sessionId - Session ID
     * @returns {Promise<Array>} Array of reservations
     */
    async getReservationsBySession(sessionId) {
        try {
            const reservationIds = await client.sMembers(`${this.sessionPrefix}${sessionId}:reservations`);

            if (reservationIds.length === 0) {
                return [];
            }

            const reservations = [];
            for (const id of reservationIds) {
                const reservation = await client.hGetAll(`${this.keyPrefix}${id}`);
                if (reservation && Object.keys(reservation).length > 0) {
                    // Parse any JSON-stringified fields back to proper types
                    const parsedReservation = { ...reservation };

                    // Convert string numbers back to numbers
                    if (parsedReservation.guests) {
                        parsedReservation.guests = parseInt(parsedReservation.guests);
                    }

                    reservations.push(parsedReservation);
                }
            }

            return reservations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        } catch (error) {
            console.error('Error getting session reservations:', error);
            throw new AppError(
                'SESSION_RESERVATIONS_FETCH_ERROR',
                'Failed to fetch session reservations',
                HttpStatusCode.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Update reservation status
     * @param {string} reservationId - Reservation ID
     * @param {string} status - New status (confirmed, cancelled, completed)
     * @returns {Promise<Object>} Updated reservation
     */
    async updateReservationStatus(reservationId, status) {
        try {
            const reservation = await this.getReservationById(reservationId);

            if (!reservation) {
                throw new AppError(
                    'RESERVATION_NOT_FOUND',
                    `Reservation with ID ${reservationId} not found`,
                    HttpStatusCode.NOT_FOUND,
                );
            }

            // Update the status and updatedAt timestamp
            const updatedReservation = {
                ...reservation,
                status: status,
                updatedAt: new Date().toISOString()
            };

            // Store updated reservation using HSET - ensure all values are strings
            const flatReservation = {};
            for (const [key, value] of Object.entries(updatedReservation)) {
                flatReservation[key] = typeof value === 'object' && value !== null
                    ? JSON.stringify(value)
                    : String(value);
            }
            await client.hSet(`${this.keyPrefix}${reservationId}`, flatReservation);

            return updatedReservation;

        } catch (error) {
            console.error('Error updating reservation status:', error);
            throw new AppError(
                'RESERVATION_UPDATE_ERROR',
                'Failed to update reservation status',
                HttpStatusCode.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Delete reservation (admin function)
     * @param {string} reservationId - Reservation ID
     * @returns {Promise<boolean>} True if deleted
     */
    async deleteReservation(reservationId) {
        try {
            const reservation = await this.getReservationById(reservationId);

            if (!reservation) {
                return false;
            }

            // Remove from session reservations
            await client.sRem(`${this.sessionPrefix}${reservation.sessionId}:reservations`, reservationId);

            // Delete reservation
            await client.del(`${this.keyPrefix}${reservationId}`);

            return true;

        } catch (error) {
            console.error('Error deleting reservation:', error);
            throw new AppError(
                'RESERVATION_DELETE_ERROR',
                'Failed to delete reservation',
                HttpStatusCode.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Generate unique reservation ID
     * @private
     */
    _generateReservationId() {
        return `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

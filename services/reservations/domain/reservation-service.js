import { ReservationRepository } from '../data/reservation-repository.js';
import { UserService } from '../../users/domain/user-service.js';
import { RestaurantService } from '../../restaurants/domain/restaurant-service.js';
import { AppError, HttpStatusCode } from '../../../lib/errors.js';

/**
 * Reservation Service - Business logic layer for reservation operations
 * Handles all reservation-related business rules and validation
 */
export class ReservationService {
    constructor() {
        this.reservationRepository = new ReservationRepository();
        this.userService = new UserService();
        this.restaurantService = new RestaurantService();
    }

    /**
     * Create a new reservation with validation
     * @param {Object} reservationData - Reservation data
     * @param {string} reservationData.sessionId - User session ID
     * @param {string} reservationData.restaurantId - Restaurant ID
     * @param {string} reservationData.date - Reservation date (YYYY-MM-DD)
     * @param {string} reservationData.time - Reservation time (HH:MM)
     * @param {number} reservationData.guests - Number of guests
     * @param {string} reservationData.customerName - Customer name
     * @param {string} reservationData.customerPhone - Customer phone
     * @param {string} reservationData.customerEmail - Customer email (optional)
     * @param {string} reservationData.specialRequests - Special requests (optional)
     * @returns {Promise<Object>} Created reservation with restaurant details
     */
    async createReservation(reservationData) {
        const {
            sessionId,
            restaurantId,
            date,
            time,
            guests,
            specialRequests,
        } = reservationData;

        // Get customer details from user profile
        const customerDetails = await this.userService.getUserContactDetails(sessionId);



        // Create reservation
        const reservation = await this.reservationRepository.createReservation({
            sessionId,
            restaurantId,
            date,
            time,
            guests,
            customerName: customerDetails.name.trim(),
            customerPhone: customerDetails.phone.trim(),
            customerEmail: customerDetails.email ? customerDetails.email.trim() : null,
            specialRequests: specialRequests ? specialRequests.trim() : null,
        });

        // Get restaurant details for response
        const restaurant = await this.restaurantService.getRestaurantById(restaurantId);

        return {
            reservation,
            restaurant: {
                id: restaurant.id,
                name: restaurant.name,
                cuisine: restaurant.cuisine,
                address: restaurant.address,
                city: restaurant.city,
                locality: restaurant.locality,
            }
        };
    }

    /**
     * Get reservation by ID with validation
     * @param {string} reservationId - Reservation ID
     * @returns {Promise<Object>} Reservation with restaurant details
     */
    async getReservationById(reservationId) {
        if (!reservationId) {
            throw new AppError(
                'INVALID_RESERVATION_ID',
                'Reservation ID is required',
                HttpStatusCode.BAD_REQUEST,
            );
        }

        const reservation = await this.reservationRepository.getReservationById(reservationId);
        
        if (!reservation) {
            throw new AppError(
                'RESERVATION_NOT_FOUND',
                `Reservation with ID ${reservationId} not found`,
                HttpStatusCode.NOT_FOUND,
            );
        }

        // Get restaurant details
        const restaurant = await this.restaurantService.getRestaurantById(reservation.restaurantId);

        return {
            reservation,
            restaurant: {
                id: restaurant.id,
                name: restaurant.name,
                cuisine: restaurant.cuisine,
                address: restaurant.address,
                city: restaurant.city,
                locality: restaurant.locality,
            }
        };
    }

    /**
     * Get reservations for a session
     * @param {string} sessionId - Session ID
     * @returns {Promise<Object>} Session reservations with summary
     */
    async getSessionReservations(sessionId) {
        if (!sessionId) {
            throw new AppError(
                'INVALID_SESSION_ID',
                'Session ID is required',
                HttpStatusCode.BAD_REQUEST,
            );
        }

        const reservations = await this.reservationRepository.getReservationsBySession(sessionId);

        // Enhance reservations with restaurant details
        const enhancedReservations = [];
        for (const reservation of reservations) {
            try {
                const restaurant = await this.restaurantService.getRestaurantById(reservation.restaurantId);
                enhancedReservations.push({
                    ...reservation,
                    restaurant: {
                        name: restaurant.name,
                        cuisine: restaurant.cuisine,
                        city: restaurant.city,
                        locality: restaurant.locality,
                    }
                });
            } catch (error) {
                // If restaurant not found, include reservation without restaurant details
                enhancedReservations.push({
                    ...reservation,
                    restaurant: null,
                });
            }
        }

        // Calculate summary
        const summary = this._calculateReservationSummary(enhancedReservations);

        return {
            reservations: enhancedReservations,
            summary,
        };
    }

    /**
     * Cancel a reservation
     * @param {string} reservationId - Reservation ID
     * @param {string} sessionId - Session ID (for authorization)
     * @returns {Promise<Object>} Cancelled reservation
     */
    async cancelReservation(reservationId, sessionId) {
        if (!reservationId || !sessionId) {
            throw new AppError(
                'INVALID_PARAMETERS',
                'Reservation ID and Session ID are required',
                HttpStatusCode.BAD_REQUEST,
            );
        }

        const reservation = await this.reservationRepository.getReservationById(reservationId);

        if (!reservation) {
            throw new AppError(
                'RESERVATION_NOT_FOUND',
                `Reservation with ID ${reservationId} not found`,
                HttpStatusCode.NOT_FOUND,
            );
        }

        // Check if reservation belongs to session
        if (reservation.sessionId !== sessionId) {
            throw new AppError(
                'UNAUTHORIZED_CANCELLATION',
                'You can only cancel your own reservations',
                HttpStatusCode.FORBIDDEN,
            );
        }

        // Check if reservation can be cancelled
        if (reservation.status === 'cancelled') {
            throw new AppError(
                'ALREADY_CANCELLED',
                'Reservation is already cancelled',
                HttpStatusCode.CONFLICT,
            );
        }

        if (reservation.status === 'completed') {
            throw new AppError(
                'CANNOT_CANCEL_COMPLETED',
                'Cannot cancel a completed reservation',
                HttpStatusCode.CONFLICT,
            );
        }

        // Check cancellation time policy (e.g., must cancel at least 2 hours before)
        const reservationDateTime = new Date(`${reservation.date} ${reservation.time}`);
        const now = new Date();
        const hoursUntilReservation = (reservationDateTime - now) / (1000 * 60 * 60);

        if (hoursUntilReservation < 2) {
            throw new AppError(
                'CANCELLATION_TOO_LATE',
                'Reservations must be cancelled at least 2 hours in advance',
                HttpStatusCode.CONFLICT,
            );
        }

        // Cancel the reservation by updating status directly
        const cancelledReservation = {
            ...reservation,
            status: 'cancelled',
            cancelledAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        // Update the reservation in Redis directly
        await this.reservationRepository.updateReservation(reservationId, cancelledReservation);

        return cancelledReservation;
    }

    /**
     * Cancel a reservation
     * @param {string} reservationId - Reservation ID to cancel
     * @returns {Promise<Object>} Cancelled reservation details
     */
    async cancelReservation(reservationId) {
        // Get the reservation first to verify it exists
        const reservationData = await this.getReservationById(reservationId);

        // Check if reservation is already cancelled
        if (reservationData.reservation.status === 'cancelled') {
            throw new AppError(
                'ALREADY_CANCELLED',
                'This reservation has already been cancelled',
                HttpStatusCode.BAD_REQUEST,
            );
        }

        // Cancel the reservation
        const cancelledReservation = await this.reservationRepository.updateReservationStatus(
            reservationId,
            'cancelled',
        );

        return {
            reservation: cancelledReservation,
            restaurant: reservationData.restaurant,
        };
    }

    /**
     * Calculate reservation summary
     * @private
     */
    _calculateReservationSummary(reservations) {
        const summary = {
            totalReservations: reservations.length,
            confirmed: 0,
            cancelled: 0,
            completed: 0,
            totalGuests: 0,
        };

        reservations.forEach(reservation => {
            summary[reservation.status]++;
            summary.totalGuests += reservation.guests;
        });

        return summary;
    }
}

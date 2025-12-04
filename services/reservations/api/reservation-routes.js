import { Router } from 'express';
import { ReservationService } from '../domain/reservation-service.js';
import { AppError, HttpStatusCode } from '../../../lib/errors.js';
const router = Router();
const reservationService = new ReservationService();

/**
 * POST /api/reservations/book - Create a new reservation
 * Body parameters:
 * - sessionId: User session ID (required) - used to fetch customer details from profile
 * - restaurantId: Restaurant ID (required)
 * - date: Reservation date YYYY-MM-DD (required)
 * - time: Reservation time HH:MM (required)
 * - guests: Number of guests (required, 1-20)
 * - specialRequests: Special requests (optional)
 * Note: Customer details (name, phone, email) are automatically fetched from user profile
 */
router.post('/book', async (req, res, next) => {
    try {
        const {
            sessionId,
            restaurantId,
            date,
            time,
            guests,
            specialRequests,
        } = req.body;

        const result = await reservationService.createReservation({
            sessionId,
            restaurantId,
            date,
            time,
            guests: parseInt(guests),
            specialRequests,
        });

        res.status(HttpStatusCode.CREATED).json({
            success: true,
            data: result,
            message: `Reservation confirmed for ${guests} guests on ${date} at ${time}`,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/reservations/:sessionId - Get reservations for a session
 */
router.get('/:sessionId', async (req, res, next) => {
    try {
        const { sessionId } = req.params;

        const result = await reservationService.getSessionReservations(sessionId);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/reservations/reservation/:reservationId - Get specific reservation
 */
router.get('/reservation/:reservationId', async (req, res, next) => {
    try {
        const { reservationId } = req.params;

        const result = await reservationService.getReservationById(reservationId);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/reservations/:reservationId/cancel - Cancel a reservation
 * Body parameters:
 * - sessionId: User session ID (required for authorization)
 */
router.put('/:reservationId/cancel', async (req, res, next) => {
    try {
        const { reservationId } = req.params;
        const { sessionId } = req.body;

        if (!sessionId) {
            throw new AppError(
                'MISSING_SESSION_ID',
                'Session ID is required for authorization',
                HttpStatusCode.BAD_REQUEST,
            );
        }

        const result = await reservationService.cancelReservation(reservationId, sessionId);

        res.json({
            success: true,
            data: result,
            message: 'Reservation cancelled successfully',
        });
    } catch (error) {
        next(error);
    }
});

export default router;

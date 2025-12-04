import { loadReservationCount } from '../../services/reservationService.js';

export class ReservationCount {
    constructor(selector = '.brutal-reservation-count') {
        this.element = document.querySelector(selector);
    }

    update(count) {
        if (this.element) {
            this.element.textContent = count || 0;
            this.element.style.transform = 'scale(1.3)';
            setTimeout(() => {
                this.element.style.transform = 'scale(1)';
            }, 200);
        }
    }

    async load(sessionId) {
        if (!sessionId) {
            console.log('No session ID yet, skipping reservation count load');
            return;
        }

        await loadReservationCount(sessionId, {
            onSuccess: (reservations) => {
                if (reservations.success && reservations.summary) {
                    this.update(reservations.summary.totalReservations);
                }
            },
            onError: (error) => {
                console.error('Error loading reservation count:', error);
            }
        });
    }
}

import { bookTable } from '../../services/reservationService.js';

export class ReservationButton {
    constructor(onSuccess = null, onError = null) {
        this.onSuccess = onSuccess;
        this.onError = onError;
    }

    async makeReservationFromChat(sessionId, restaurantId, buttonElement, guests = 2) {
        const originalContent = buttonElement.innerHTML;

        await bookTable(sessionId, restaurantId, guests, {
            onLoad: () => {
                buttonElement.innerHTML = '⏳';
                buttonElement.disabled = true;
            },
            onSuccess: (result) => {
                buttonElement.innerHTML = '✅';

                if (this.onSuccess) {
                    this.onSuccess(result);
                }

                setTimeout(() => {
                    buttonElement.innerHTML = originalContent;
                    buttonElement.disabled = false;
                }, 2000);
            },
            onError: (error) => {
                console.error('Error booking table:', error);
                buttonElement.innerHTML = '❌';

                if (this.onError) {
                    this.onError(error);
                }

                setTimeout(() => {
                    buttonElement.innerHTML = originalContent;
                    buttonElement.disabled = false;
                }, 2000);
            }
        });
    }
}

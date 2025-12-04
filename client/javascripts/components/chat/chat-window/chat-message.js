import { MessageFormatter } from './message-formatter.js';

export class ChatMessage {
    constructor(message, sender, isCached = false, responseTime = null, onRestaurantAction = null) {
        this.message = message;
        this.sender = sender;
        this.isCached = isCached;
        this.responseTime = responseTime;
        this.onRestaurantAction = onRestaurantAction;
    }

    createElement() {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${this.sender}-message`;

        const timestamp = MessageFormatter.formatTimestamp(new Date());

        if (this.sender === 'user') {
            messageDiv.innerHTML = `
                <div class="message-content user-content">
                    ${MessageFormatter.formatMessage(this.message)}
                    <div class="message-time">${timestamp}</div>
                </div>
                <div class="user-avatar">👤</div>
            `;
        } else {
            const cacheIndicator = this.isCached ? `
                <div class="cache-notice">
                    <i class="fas fa-clock"></i>
                    <span>${this.responseTime?.toFixed(3) || '0.000'}s</span>
                    This seems familiar - we've pulled in an earlier response. No waiting in line!
                </div>
            ` : '';

            messageDiv.innerHTML = `
                <div class="brutal-assistant-avatar">🍽️</div>
                <div class="brutal-message-content assistant-content">
                    ${MessageFormatter.formatMessage(this.message)}
                    ${cacheIndicator}
                    <div class="message-time">${timestamp}</div>
                </div>
            `;
        }

        if (this.sender === 'assistant') {
            this.attachRestaurantInteractions(messageDiv);
        }

        return messageDiv;
    }

    attachRestaurantInteractions(messageElement) {
        const reservationBtns = messageElement.querySelectorAll('.reservation-icon-btn');
        if (reservationBtns.length === 0) {
            return;
        }

        reservationBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const restaurantId = btn.dataset.restaurantId;
                if (restaurantId && this.onRestaurantAction) {
                    await this.onRestaurantAction(restaurantId, btn);
                }
            });
        });
    }
}

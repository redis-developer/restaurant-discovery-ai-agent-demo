export class MessageFormatter {
    static formatMessage(message) {
        let formatted = message
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>')
            .replace(/₹(\d+)/g, '<span class="price">₹$1</span>');

        const restaurantIdPattern = /\(ID: ([^)]+)\)/g;
        const hasRestaurantIds = restaurantIdPattern.test(formatted);

        if (hasRestaurantIds) {
            const restaurantIdPatternReset = /\(ID: ([^)]+)\)/g;
            formatted = formatted.replace(restaurantIdPatternReset, (match, restaurantId) => {
                return `
                    <span class="restaurant-actions">
                        <button class="reservation-icon-btn" data-restaurant-id="${restaurantId}" title="Make Reservation">
                            📅
                        </button>
                        <a href="/restaurant/${restaurantId}" class="restaurant-link" title="View Details" target="_blank">
                            ℹ️
                        </a>
                    </span>
                `;
            });
        }

        return formatted;
    }

    static formatTimestamp(date) {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }
}

import { ChatMessage } from './chat-message.js';
import { TypingIndicator } from './typing-indicator.js';

export class ChatWindow {
    constructor(messagesContainerId, onRestaurantAction = null) {
        this.messagesContainer = document.getElementById(messagesContainerId);
        this.typingIndicator = new TypingIndicator(this.messagesContainer);
        this.onRestaurantAction = onRestaurantAction;
    }

    addMessage(message, sender, isCached = false, responseTime = null) {
        if (!this.messagesContainer) return;

        const chatMessage = new ChatMessage(
            message,
            sender,
            isCached,
            responseTime,
            this.onRestaurantAction
        );

        const messageElement = chatMessage.createElement();
        this.messagesContainer.appendChild(messageElement);
        this.scrollToBottom();
    }

    showTypingIndicator() {
        this.typingIndicator.show();
    }

    hideTypingIndicator() {
        this.typingIndicator.hide();
    }

    scrollToBottom() {
        if (this.messagesContainer) {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }
    }

    clear() {
        if (this.messagesContainer) {
            this.messagesContainer.innerHTML = '';
        }
    }

    showWelcomeMessage() {
        if (this.messagesContainer) {
            this.messagesContainer.innerHTML = `
                <div class="brutal-welcome-message">
                    <div class="brutal-assistant-avatar">🍽️</div>
                    <div class="brutal-message-content">
                        <p>Session ended! 👋 Starting fresh...</p>
                        <p>Where would you like to dine today?</p>
                    </div>
                </div>
            `;
        }
    }

    showNewChatMessage() {
        if (this.messagesContainer) {
            this.messagesContainer.innerHTML = `
                <div class="brutal-welcome-message">
                    <div class="brutal-assistant-avatar">🍽️</div>
                    <div class="brutal-message-content">
                        <p>New chat started! 🎉</p>
                        <p>I can help you with:</p>
                        <ul>
                            <li>🔍 Finding restaurants</li>
                            <li>🍽️ Restaurant recommendations</li>
                            <li>📅 Making reservations</li>
                            <li>🌟 Popular dining spots</li>
                            <li>📍 Nearby restaurants</li>
                        </ul>
                        <p>Where would you like to dine today?</p>
                    </div>
                </div>
            `;
        }
    }
}

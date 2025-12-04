import { sendChatMessage } from './chatService.js';
import { DOM_IDS, CSS_SELECTORS } from './utils/constants.js';

import { ChatWindow } from './components/chat/chat-window/chat-window.js';
import { ChatInput } from './components/chat/chat-input/chat-input.js';
import { SuggestionButtons } from './components/chat/chat-input/suggestion-buttons.js';
import { ChatToggle } from './components/chat/chat-toggle.js';

import { ReservationCount } from './components/reservations/reservation-count.js';
import { ReservationButton } from './components/reservations/reservation-button.js';

import { SearchBar } from './components/search/search-bar.js';
import { RestaurantCard } from './components/restaurants/restaurant-card.js';
import { NotificationSystem } from './components/notifications/notification-system.js';
import { SessionManager } from './components/session/session-manager.js';

export class RestaurantApp {
    constructor() {
        this.isLoading = false;
        this.reservationCountLoaded = false;
        this.init();
    }

    init() {
        this.sessionManager = new SessionManager(
            (newSession) => this.handleSessionEnd(newSession),
            () => this.handleNewChat()
        );

        const session = this.sessionManager.initializeSession();
        this.sessionId = session.sessionId;
        this.currentChatId = session.currentChatId;

        this.reservationCount = new ReservationCount(CSS_SELECTORS.BRUTAL_RESERVATION_COUNT);
        this.reservationButton = new ReservationButton(
            (result) => this.handleReservationSuccess(result),
            (error) => this.handleReservationError(error)
        );

        this.chatWindow = new ChatWindow(
            DOM_IDS.CHAT_MESSAGES,
            (restaurantId, buttonElement) => this.handleRestaurantAction(restaurantId, buttonElement)
        );

        this.chatInput = new ChatInput(
            DOM_IDS.CHAT_FORM,
            DOM_IDS.CHAT_INPUT,
            (message) => this.sendMessage(message)
        );

        this.suggestionButtons = new SuggestionButtons((text) => {
            this.chatInput.setValue(text);
            this.sendMessage(text);
        });

        this.chatToggle = new ChatToggle(
            DOM_IDS.CHAT_TOGGLE,
            DOM_IDS.CHAT_WINDOW,
            DOM_IDS.MINIMIZE_CHAT
        );

        this.searchBar = new SearchBar(
            CSS_SELECTORS.BRUTAL_SEARCH_BAR,
            CSS_SELECTORS.BRUTAL_MAIN_SEARCH,
            (query) => this.handleMainSearch(query)
        );

        this.restaurantCard = new RestaurantCard(
            (restaurantName, cuisineType) => this.handleRestaurantCardAction(restaurantName, cuisineType)
        );
    }

    async sendMessage(message) {
        if (this.isLoading) return;

        this.isLoading = true;
        this.chatWindow.addMessage(message, 'user');
        this.chatWindow.showTypingIndicator();

        const useSmartRecall = document.getElementById(DOM_IDS.MEMORY_TOGGLE)?.checked || false;

        await sendChatMessage(this.sessionId, this.currentChatId, message, {
            useSmartRecall,
            onSuccess: (chatMessage) => {
                this.chatWindow.hideTypingIndicator();
                this.chatWindow.addMessage(
                    chatMessage.content,
                    'assistant',
                    chatMessage.isCachedResponse,
                    chatMessage.responseTime
                );

                if (chatMessage.content && chatMessage.content.includes('reservation') && !this.reservationCountLoaded) {
                    this.reservationCount.load(this.sessionId);
                    this.reservationCountLoaded = true;
                }
            },
            onError: (error) => {
                console.error('Error sending message:', error);
                this.chatWindow.hideTypingIndicator();
                this.chatWindow.addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
            }
        });

        this.isLoading = false;
    }

    async handleRestaurantAction(restaurantId, buttonElement) {
        await this.reservationButton.makeReservationFromChat(this.sessionId, restaurantId, buttonElement);
    }

    handleReservationSuccess(result) {
        NotificationSystem.success(`${result.message}`);
        this.reservationCount.update(result.reservationSummary?.totalReservations || 0);
    }

    handleReservationError(error) {
        NotificationSystem.error('Failed to make reservation. Please try again.');
    }

    handleSessionEnd(newSession) {
        this.chatWindow.showWelcomeMessage();
        this.reservationCount.update(0);
        this.sessionId = newSession.sessionId;
    }

    handleNewChat() {
        this.chatWindow.showNewChatMessage();
    }

    handleMainSearch(query) {
        this.chatToggle.open();
        this.chatInput.setValue(`Find ${query} restaurants`);
        this.sendMessage(`Find ${query} restaurants`);
    }

    handleRestaurantCardAction(restaurantName, cuisineType) {
        if (cuisineType) {
            this.chatToggle.open();
            this.chatInput.setValue(`Show me ${cuisineType} restaurants`);
            this.chatInput.focus();
        } else if (restaurantName) {
            NotificationSystem.show(`Exploring ${restaurantName}! 🍽️`);
        }
    }
}

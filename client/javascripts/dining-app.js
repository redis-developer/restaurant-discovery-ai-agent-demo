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

export class DiningApp {
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

        this.reservationCount = new ReservationCount(CSS_SELECTORS.BRUTAL_RESERVATIONS_COUNT);
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

        this.suggestionButtons = new SuggestionButtons(
            CSS_SELECTORS.BRUTAL_SUGGESTION_BTN,
            (message) => this.sendMessage(message)
        );

        this.chatToggle = new ChatToggle(
            DOM_IDS.CHAT_TOGGLE,
            DOM_IDS.CHAT_WINDOW,
            () => this.handleChatOpen()
        );

        this.searchBar = new SearchBar(
            DOM_IDS.MAIN_SEARCH,
            (query) => this.handleSearch(query)
        );

        this.restaurantCard = new RestaurantCard();

        this.loadInitialData();
    }

    async loadInitialData() {
        if (!this.reservationCountLoaded) {
            await this.reservationCount.load(this.sessionId);
            this.reservationCountLoaded = true;
        }
    }

    async sendMessage(message) {
        if (this.isLoading) return;

        this.isLoading = true;
        this.chatWindow.addUserMessage(message);

        await sendChatMessage(this.sessionId, this.currentChatId, message, {
            onLoad: () => {
                this.chatWindow.showTypingIndicator();
            },
            onSuccess: (assistantMessage) => {
                this.chatWindow.hideTypingIndicator();
                this.chatWindow.addAssistantMessage(assistantMessage);
                this.isLoading = false;
            },
            onError: (error) => {
                this.chatWindow.hideTypingIndicator();
                this.chatWindow.addErrorMessage('Sorry, I encountered an error. Please try again.');
                this.isLoading = false;
                console.error('Chat error:', error);
            }
        });
    }

    async handleRestaurantAction(restaurantId, buttonElement) {
        await this.reservationButton.bookTableFromChat(this.sessionId, restaurantId, 2, buttonElement);
    }

    handleReservationSuccess(result) {
        NotificationSystem.success(`✅ ${result.message}`);
        this.reservationCount.update(result.reservationSummary.summary.totalReservations);
    }

    handleReservationError(error) {
        NotificationSystem.error('❌ Failed to book table. Please try again.');
    }

    handleSearch(query) {
        if (query.trim()) {
            this.sendMessage(`Find restaurants: ${query}`);
            this.chatToggle.openChat();
        }
    }

    handleChatOpen() {
        this.loadInitialData();
    }

    handleSessionEnd(newSession) {
        this.sessionId = newSession.sessionId;
        this.currentChatId = newSession.currentChatId;
        this.reservationCountLoaded = false;
        this.chatWindow.clearMessages();
        this.loadInitialData();
        NotificationSystem.success('New dining session started!');
    }

    handleNewChat() {
        this.currentChatId = `chat_${Date.now()}`;
        this.chatWindow.clearMessages();
        NotificationSystem.success('New conversation started!');
    }
}

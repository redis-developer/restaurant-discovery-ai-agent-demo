import { endSession as endChatSession } from '../chatService.js';

export class SessionService {
    constructor() {
        this.sessionId = null;
        this.currentChatId = null;
    }

    initialize() {
        const urlParams = new URLSearchParams(window.location.search);
        const userName = urlParams.get('sessionId') || urlParams.get('name') || 'Foodie';

        // Note: Username display is now handled server-side in the template
        // No need to update it here since we're doing server-side rendering

        // Use clean username as session ID (no timestamp)
        this.sessionId = userName.toLowerCase();
        this.currentChatId = 'main_chat';

        return {
            sessionId: this.sessionId,
            currentChatId: this.currentChatId,
            userName
        };
    }

    async end(onSuccess = null, onError = null) {
        if (!confirm('Are you sure you want to end this dining session? This will clear all chat history and reservations.')) {
            return;
        }

        await endChatSession(this.sessionId, {
            onSuccess: () => {
                this.sessionId = null;
                const newSession = this.initialize();

                if (onSuccess) {
                    onSuccess(newSession);
                }
            },
            onError: (error) => {
                console.error('Error ending dining session:', error);

                if (onError) {
                    onError(error);
                } else {
                    alert('Failed to end dining session. Please try again.');
                }
            }
        });
    }

    getSessionId() {
        return this.sessionId;
    }

    getCurrentChatId() {
        return this.currentChatId;
    }
}

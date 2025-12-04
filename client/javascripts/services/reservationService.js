export async function bookTable(sessionId, restaurantId, guests = 2, options = {}) {
    const { onLoad, onSuccess, onError } = options;

    try {
        onLoad?.();

        // Generate default reservation details
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const defaultDate = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD
        const defaultTime = '19:00'; // 7 PM

        const res = await fetch('/api/reservations/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                restaurantId,
                guests,
                date: defaultDate,
                time: defaultTime,
                specialRequests: 'Quick reservation via chat'
                // Customer details will be auto-populated from user profile on the backend
            }),
        });

        const result = await res.json();

        if (!result.success) {
            throw new Error(result.error || 'Failed to book table');
        }

        onSuccess?.(result);

    } catch (err) {
        console.error('Failed to book table:', err);
        onError?.(err);
    }
}

export async function loadReservationCount(sessionId, options = {}) {
    const { onLoad, onSuccess, onError } = options;

    try {
        onLoad?.();

        const res = await fetch(`/api/reservations/${sessionId}`);

        if (!res.ok) {
            onSuccess?.({ success: true, summary: { totalReservations: 0 } });
            return;
        }

        const reservations = await res.json();
        onSuccess?.(reservations);

    } catch (err) {
        console.error('Failed to load reservation count:', err);
        onError?.(err);
    }
}

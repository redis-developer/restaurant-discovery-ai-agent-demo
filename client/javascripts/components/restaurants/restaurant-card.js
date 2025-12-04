export class RestaurantCard {
    constructor(onRestaurantAction = null) {
        this.onRestaurantAction = onRestaurantAction;
        this.init();
    }

    init() {
        const bookBtns = document.querySelectorAll('.brutal-book-btn');
        bookBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleRestaurantBook(e));
        });

        const categoryCards = document.querySelectorAll('.brutal-category-card');
        categoryCards.forEach(card => {
            card.addEventListener('click', (e) => this.handleCuisineClick(e));
        });
    }

    handleRestaurantBook(e) {
        e.preventDefault();
        const restaurantCard = e.target.closest('.brutal-restaurant-card');
        const restaurantName = restaurantCard.querySelector('h4').textContent;

        if (this.onRestaurantAction) {
            this.onRestaurantAction(restaurantName);
        }

        e.target.style.transform = 'scale(0.95)';
        setTimeout(() => {
            e.target.style.transform = 'scale(1)';
        }, 150);
    }

    handleCuisineClick(e) {
        const cuisineName = e.currentTarget.querySelector('span').textContent;

        if (this.onRestaurantAction) {
            this.onRestaurantAction(null, cuisineName);
        }
    }
}

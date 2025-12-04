import { RestaurantApp } from './restaurant-app.js';

document.addEventListener('DOMContentLoaded', () => {
    // Extract restaurant info from page
    const restaurantId = document.querySelector('[data-restaurant-id]')?.dataset.restaurantId ||
                        new URLSearchParams(window.location.search).get('restaurantId') ||
                        window.location.pathname.split('/').pop();

    const restaurantCuisine = document.querySelector('[data-restaurant-cuisine]')?.dataset.restaurantCuisine;

    // Initialize the restaurant app
    const restaurantApp = new RestaurantApp(restaurantId, restaurantCuisine);

    // Make app globally accessible for debugging
    window.restaurantApp = restaurantApp;
});

# Query examples and caching guide

This document outlines the kinds of queries one can ask the AI agent, and some caching strategies  to optimize performance and reduce API costs.

## Conversational Query Patterns

These are examples of the types of natural, conversational queries users might ask when looking for restaurants. Understanding these patterns helps us design effective semantic caching strategies:

### Occasion-Based Vibes

- "A restaurant for impressing my boss without bankrupting myself"
- "Where to take someone on a first date that's not trying too hard"
- "A place to celebrate getting fired (in a good way)"
- "Restaurant for breaking up with someone gently"
- "Where to take parents who think anything spicier than mayo is 'ethnic food'"

### Quirky Discovery

- "What's the weirdest thing on a menu in Delhi?"
- "Restaurant with the most confusing name"
- "Place that looks sketchy but has amazing food"
- "Restaurant where the waiters definitely judge your order"
- "What's the most over-engineered dish I can order?"

### Budget Shenanigans

- "Fancy restaurant where I can look rich on a ₹500 budget"
- "Most expensive single dish that's technically just vegetables"
- "Restaurant where ₹2000 gets me the most ridiculous amount of food"
- "Place where the ambiance costs more than the food"

### Specific Challenges

- "Restaurant where I can eat with my hands without judgment"
- "Loudest restaurant where I can have a private conversation"
- "Quietest place where whispering feels normal"
- "Restaurant with the most Instagram-worthy disaster potential"
- "Place that serves food I can't pronounce but pretend to know"

### Philosophical Food Questions

- "What's technically a meal but feels like a snack?"
- "Restaurant that serves 'fusion' but it's just confused"
- "Most authentic 'authentic' cuisine that's definitely not authentic"
- "Place where the presentation is more important than taste"

### Social Experiments

- "Restaurant where bringing 10 people won't cause chaos"
- "Place perfect for people who hate making decisions"
- "Restaurant where being underdressed is impossible"
- "Where to take someone who 'doesn't like Indian food' in India"

### Emotional State Matching

- "I'm feeling melancholy and want a place that matches"
- "I need somewhere that feels like a warm hug"
- "I want to feel mysterious and sophisticated tonight"
- "Give me 'main character energy' restaurant vibes"

### Aesthetic/Atmosphere Vibes

- "Dark academia but make it dinner"
- "Cottagecore dining experience"
- "Industrial chic with good pasta"
- "Old Bollywood movie romance vibes"
- "Feels like eating in a secret garden"

### Sensory/Mood Experiences

- "Somewhere that sounds like jazz and tastes like comfort"
- "I want to feel like I'm dining in the 1920s"
- "Give me 'cozy bookshop café' energy"
- "Somewhere that feels like Sunday afternoon"
- "I want to feel like I'm in a Wes Anderson film"

### Social Energy Matching

- "Intimate conversation vibes, not networking energy"
- "Somewhere I can be loud and celebratory"
- "First date nervous energy - need a confidence boost"
- "Introvert recharge station with good food"


## High-Value Semantic Cache Candidates

Semantic caching is crucial for restaurant discovery because dining queries often have similar intent even with different wording. With semantic caching, we can provide lightning-fast results while significantly reducing operational costs.

### 1. Restaurant Recommendations by Cuisine

These queries represent similar semantic intent and can be tested for cache clustering:

```bash
"Show me Italian restaurants"
"Find Italian food places"
"I want to eat Italian cuisine"
"Where can I get good pasta and pizza?"
"Recommend Italian dining spots"
"Looking for authentic Italian restaurants"
```

### 2. Location-Based Queries

These queries have similar semantic meaning and can be tested for cache effectiveness:

```bash
"Restaurants near Khan Market"
"Food places around Khan Market area"
"Dining options close to Khan Market"
"What restaurants are in Khan Market?"
"Khan Market restaurant recommendations"
```

### 3. Occasion-Based Dining

**Romantic dining test cluster:**

```bash
"Romantic restaurants for date night"
"Best places for a romantic dinner"
"Intimate dining spots for couples"
"Where to take someone on a romantic date"
"Cozy restaurants for anniversary dinner"
```

**Family dining test cluster:**

```bash
"Family-friendly restaurants"
"Good places to eat with kids"
"Restaurants suitable for families"
"Kid-friendly dining spots"
```

### 4. Price Range Queries

**Budget dining test cluster:**

```bash
"Cheap restaurants under 500 rupees"
"Affordable dining options"
"Budget-friendly restaurants"
"Inexpensive places to eat"
"Good food under 500 for two"
```

**Fine dining test cluster:**

```bash
"Expensive fine dining restaurants"
"Luxury dining experiences"
"High-end restaurants"
"Premium dining spots"
```

### 5. Specific Dish Recommendations

```bash
"Best chole bhature in Delhi"
"Where to get good chole bhature in Delhi?"
"Authentic chole bhature places in Delhi"
"Top chole bhature spots in Delhi"
"Punjabi chole bhature restaurants in Delhi"
```

```bash
"Best butter chicken places"
"Good butter chicken restaurants"
"Where to get authentic butter chicken?"
"Top butter chicken spots in Delhi"
```

### 6. Ambiance/Features Queries

**Outdoor seating test cluster:**

```bash
"Restaurants with outdoor seating"
"Places with terrace dining"
"Rooftop restaurants"
"Open-air dining spots"
```

**Live music test cluster:**

```bash
"Restaurants with live music"
"Dining places with entertainment"
"Restaurants with live bands"
"Musical dining experiences"
```

## Cache Hit Scenarios

### High Cache Hit Scenarios (80-90% hit rate)

1. **Popular Cuisines**: "Italian", "Chinese", "North Indian" queries
2. **Common Locations**: "Khan Market", "Connaught Place", "Karol Bagh"
3. **Frequent Occasions**: "Date night", "Family dinner", "Business lunch"
4. **Standard Requests**: "Best restaurants", "Cheap eats", "Fine dining"

### Medium Cache Hit Scenarios (50-70% hit rate)

1. **Specific Dishes**: "Best biryani", "Good pizza", "Authentic momos"
2. **Ambiance Features**: "Outdoor seating", "Live music", "Rooftop dining"
3. **Dietary Preferences**: "Vegetarian restaurants", "Vegan options"

### Low Cache Hit Scenarios (10-30% hit rate)

1. **Very Specific**: "Jain food with no onion garlic in South Delhi"
2. **Time-Sensitive**: "Restaurants open right now at 2 AM"
3. **Personal Preferences**: "Restaurants my diabetic friend can eat at"
4. **Real-time**: "Table availability for 8 people in 30 minutes"

## 📊 Expected Cache Performance

```javascript
// Estimated cache hit rates for Relish:
const EXPECTED_CACHE_HITS = {
    CUISINE_QUERIES: 85,        // Very common patterns
    LOCATION_QUERIES: 75,       // Popular areas get repeated
    PRICE_QUERIES: 70,          // Standard price ranges
    OCCASION_QUERIES: 65,       // Common dining occasions
    SPECIFIC_DISHES: 60,        // Popular dishes get repeated
    COMPLEX_QUERIES: 30         // Unique combinations
};
```

## Implementation Benefits

### Cost Reduction

- **60-70% cache hit rate** expected overall
- **Significant reduction** in OpenAI API calls
- **Faster response times** for cached queries

### User Experience

- **Instant responses** for common queries
- **Consistent recommendations** for similar requests
- **Reduced latency** during peak usage

### Scalability
- **Handle more users** with same infrastructure
- **Graceful degradation** during high traffic
- **Efficient resource utilization**


## 📈 Monitoring & Analytics

### Key Metrics to Track
- Cache hit/miss ratios by category
- Average response time improvement
- API cost reduction percentage
- User satisfaction with cached responses

### Cache Performance Dashboard
- Real-time cache hit rates
- Most frequently cached queries
- Cache invalidation patterns
- Cost savings analytics

---

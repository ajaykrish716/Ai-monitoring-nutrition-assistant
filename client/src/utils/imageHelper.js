/**
 * Utility for resolving scalable food imagery based on meal names and foods.
 * Provides curated, reliable Unsplash CDN image URLs with fallback handling.
 */

const MEAL_IMAGE_MAP = {
  breakfast: [
    "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=600&auto=format&fit=crop&q=80",
  ],
  lunch: [
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80",
  ],
  dinner: [
    "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80",
  ],
  snack: [
    "https://images.unsplash.com/photo-1490818387583-1baba5e638af?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80",
  ],
  salad: [
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80",
  ],
  egg: [
    "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&auto=format&fit=crop&q=80",
  ],
  oat: [
    "https://images.unsplash.com/photo-1584776296944-ab6fb57b0bdd?w=600&auto=format&fit=crop&q=80",
  ],
  fish: [
    "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&auto=format&fit=crop&q=80",
  ],
  chicken: [
    "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&auto=format&fit=crop&q=80",
  ],
  smoothie: [
    "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&auto=format&fit=crop&q=80",
  ],
  fruit: [
    "https://images.unsplash.com/photo-1490818387583-1baba5e638af?w=600&auto=format&fit=crop&q=80",
  ],
};

const DEFAULT_FOOD_IMAGE =
  "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=600&auto=format&fit=crop&q=80";

/**
 * Get an appropriate, vibrant food image based on meal name, foods, or meal type.
 * @param {string} mealType - e.g. Breakfast, Lunch, Dinner, Snack
 * @param {string} mealName - e.g. Greek Yogurt Parfait, Chicken Rice Bowl
 * @param {Array<string>} [foods] - list of food items
 * @returns {string} - Image URL
 */
export function getMealImage(mealType = "", mealName = "", foods = []) {
  const combinedText = `${mealType} ${mealName} ${foods.join(" ")}`.toLowerCase();

  for (const [key, urls] of Object.entries(MEAL_IMAGE_MAP)) {
    if (combinedText.includes(key)) {
      // Deterministic pick based on string length to keep image stable for the same meal
      const idx = combinedText.length % urls.length;
      return urls[idx];
    }
  }

  const typeKey = mealType.toLowerCase();
  if (MEAL_IMAGE_MAP[typeKey]) {
    const urls = MEAL_IMAGE_MAP[typeKey];
    return urls[combinedText.length % urls.length];
  }

  return DEFAULT_FOOD_IMAGE;
}

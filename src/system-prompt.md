Analyze recipes and return structured JSON metadata.

## Output Format

Return ONLY valid JSON with these exact keys:

{
  "tags": [...],
  "mealType": [...],
  "healthiness": N,
  "totalTimeMinutes": N,
  "description": "..."
}

No markdown, no code fences, no explanation. Just the JSON object.

## Field Definitions

### tags (array of 1-4 strings)

Strongly prefer tags from these lists.

**Cuisine** (0-1, only if clearly applies):
American, Italian, Mexican, Chinese, Japanese, Indian, French, Thai, Greek, Vietnamese, Korean, Mediterranean, Middle Eastern, Cajun, Southern

**Dish type** (0-1):
Soup, Salad, Pasta, Sandwich, Stir-Fry, Casserole, Curry, Tacos, Enchiladas, Bowl, Stew, Noodles, Pancakes, Meatballs

**Main ingredient** (0-2, pick the most central):
Chicken, Beef, Pork, Fish, Shrimp, Salmon, Turkey, Tofu, Eggs, Chickpeas, Beans, Lentils, Cheese, Vegetables, Fruit

**Guidelines:**
- 1-4 tags total
- Strongly prefer tags from the lists above
- Only invent a new tag if the dish is truly unique and no existing tag fits
- Skip cuisine if the dish is generic (e.g., plain grilled chicken needs no cuisine tag)
- Use broad categories, not specific ingredients (e.g., "Fruit" not "Blueberries")
- NEVER use meal types as tags (no "Breakfast", "Lunch", "Dinner", etc. in tags)

### mealType (array of 1-2 strings)

When the dish is typically eaten. Choose from:
Breakfast, Lunch, Dinner, Snack, Dessert, Appetizer, Side Dish

Most dishes are single-type. Use multiple only when genuinely versatile (e.g., quiche = Breakfast + Lunch).

### healthiness (integer 0-10)

Nutritional quality score from 0-10 based on whole foods, vegetables, lean protein, fiber, and minimal processing.

**0-2**: Heavily processed, deep-fried, or high in refined sugar (funnel cake, candy bars, soda, donuts)
**3-4**: High in saturated fat or refined carbs, low in vegetables (mac and cheese, pizza, bacon cheeseburger, fish and chips)
**5-6**: Some balance but room for improvement (tacos, spaghetti with meat sauce, fried rice, teriyaki chicken)
**7-8**: Good balance of protein, vegetables, and whole grains (chicken stir-fry, grilled chicken salad, grain bowls)
**9-10**: Excellent nutrient density, lots of vegetables, lean protein or legumes (grilled salmon with roasted vegetables, lentil soup, Buddha bowls)

### totalTimeMinutes (integer)

Total prep + cook time in minutes. Never return 0 or null.

**If time is provided:** Use that value.
**If not provided, estimate by technique:**
- 5-15 min: No-cook, assembly, quick sauté, simple salads
- 15-30 min: Stovetop meals, stir-fry, pasta, eggs, sandwiches
- 30-45 min: Roasted vegetables, sheet pan dinners, pan-seared proteins
- 45-75 min: Whole roasted chicken, casseroles, lasagna, most baked dishes
- 75-150 min: Braises, stews, slow-roasted meats, homemade pizza dough
- 150-300 min: Slow cooker meals, smoking, bread from scratch
- 300+ min: Low-and-slow BBQ, complex fermented doughs, stock from scratch

### description (string)

A 2-3 sentence summary. Start by describing what the dish is so someone knows what they're making without reading the full recipe. Then mention what's unique, interesting, or important to know. Keep it concise (40-80 words).

Write like you're telling a friend about the recipe. Casual, helpful, and a little appetizing. Avoid AI-sounding phrases. Never use dashes.

Structure:
1. What is this dish? (1 sentence describing the food, make it sound good)
2. What's notable? (key techniques, time considerations, equipment, what makes this version different)

Examples:
- "Crispy breaded chicken cutlets topped with tangy marinara and melted mozzarella. Pound the chicken thin so it cooks evenly."
- "A comforting Vietnamese noodle soup with tender sliced beef in a rich, spiced broth. Takes about 3 hours but most of that is just letting it simmer. Char the onion and ginger first for better flavor."

## Examples

Enchiladas Suizas →
{
  "tags": ["Mexican", "Enchiladas", "Chicken"],
  "mealType": ["Dinner"],
  "healthiness": 5,
  "totalTimeMinutes": 50,
  "description": "Chicken enchiladas smothered in a creamy tomatillo sauce with melted cheese. Roasting the tomatillos and chiles under the broiler builds a lot of flavor in the sauce."
}

Pasta With Pumpkin Seed Pesto →
{
  "tags": ["Pasta", "Vegetables"],
  "mealType": ["Lunch", "Dinner"],
  "healthiness": 7,
  "totalTimeMinutes": 25,
  "description": "Fusilli tossed with a basil and pumpkin seed pesto, served cold or at room temperature. Great for meal prep since it keeps well in the fridge for days."
}

Roasted Vegetables With Cashew Romesco →
{
  "tags": ["Vegetables"],
  "mealType": ["Side Dish", "Dinner"],
  "healthiness": 9,
  "totalTimeMinutes": 30,
  "description": "Roasted broccoli and cauliflower with a smoky cashew romesco sauce. The sauce comes together in the food processor while the vegetables roast."
}

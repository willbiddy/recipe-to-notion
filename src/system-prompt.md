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
Soup, Salad, Pasta, Sandwich, Stir-Fry, Casserole, Curry, Tacos, Enchiladas, Bowl, Stew, Noodles, Pancakes, Meatballs, Dip, Sauce

**Main ingredient** (0-2, pick the most central):
Chicken, Beef, Pork, Fish, Shrimp, Seafood, Salmon, Turkey, Tofu, Eggs, Chickpeas, Beans, Lentils, Nuts, Cheese, Vegetables, Fruit

**Guidelines:**
- 1-4 tags total; strongly prefer tags from the lists above
- Only invent a new tag if the dish is truly unique and no existing tag fits
- Skip cuisine if the dish is generic (e.g., plain grilled chicken)
- Use broad categories (e.g., "Nuts" not "Walnuts", "Fruit" not "Blueberries")
- NEVER use meal types as tags (no "Breakfast", "Lunch", "Dinner", "Dessert")
- For desserts, use ingredient-based tags (e.g., "Chocolate", "Fruit") or leave tags minimal

### mealType (array of 1-2 strings)

Choose from: Breakfast, Lunch, Dinner, Snack, Dessert, Appetizer, Side Dish, Component

Use "Component" for sauces, condiments, dressings, and building-block recipes not eaten on their own.

Most dishes are single-type. Use multiple only when genuinely versatile (e.g., quiche = Breakfast + Lunch).

### healthiness (integer 0-10)

Based on Harvard T.H. Chan School of Public Health's Healthy Eating Plate: whole grains over refined carbs, quality protein (fish, poultry, legumes, nuts), healthy fats (plant oils, nuts, fish), abundant vegetables, minimal added sugar and sodium.

**10 — Optimal**
Protein anchor from fish, poultry, legumes, nuts, or eggs. Vegetables ≥50% of dish. Whole grains or legumes as base. Fats from olive oil, nuts, or fatty fish. No added sugar. Minimal sodium. Fresh, unprocessed. Roasted, grilled, steamed, or raw.
*Examples: Lemony Salmon and Spiced Chickpeas. One-Pot Beans, Greens and Grains. Big Baked Falafel Cake With Cucumber Salad.*

**8-9 — Excellent**
Quality protein is central. Vegetables are major component. May include whole grains. Healthy fats predominate. Little added sugar. One minor compromise (small amount of cheese, some saturated fat, refined garnish). Lean red meat acceptable sparingly.
*Examples: Saucy, Spiced Shrimp and White Beans. Turkey Meatballs With Romesco. Harissa Shrimp With Greens and Feta.*

**6-7 — Good**
Protein present but not dominant. Vegetables present but not starring. May use refined carbs as base but balanced by nutritious components. Moderate saturated fat from butter, cream, or cheese. Small amount of added sugar in sauce.
*Examples: Panang Curry. Spicy Sesame Noodles With Chicken. Family-Meal Fish Tacos. Pasta With Pumpkin Seed Pesto.*

**4-5 — Neutral**
Minimal protein or high-saturated-fat sources. Refined carbs dominate. Vegetables minimal. Added sugar in sauces. Higher sodium. Fats from butter, cream, cheese. Satisfying but not health-positive.
*Examples: Enchiladas Suizas. Rigatoni with Vodka Sauce. One-Pot Buffalo Chicken Pasta. Stromboli.*

**2-3 — Poor**
Negligible protein or processed meats (bacon, sausage, hot dogs). Refined carbs dominate. Vegetables absent. High added sugar. High sodium. Deep fried or loaded with cheese/cream/butter. Relies on canned soups, packaged sauces, processed cheese.
*Examples: Seattle-Style Hot Dogs. Pambazo. Creamy pasta heavy on butter and cheese without vegetables.*

**0-1 — Avoid**
No meaningful protein or only ultra-processed sources. No vegetables. Sugar is primary ingredient. Deep fried. Extremely high sodium. Built from processed components.
*Examples: Chocolate Chip Skillet Cookie. Peanut Butter Cookie Cups. Frozen pizza. Corn dogs.*

**Key signals:**

Raises score: Quality protein (fish, poultry, legumes, nuts, eggs), vegetables with color/variety, whole grains, healthy fats (olive oil, nuts, avocado, fatty fish), legumes, high fiber, fresh ingredients, herbs/spices for flavor

Lowers score: Refined carbs as base, red meat as primary protein, processed meats, deep frying, heavy butter/cream, added sugar, high sodium, canned soups/jarred sauces/packaged cheese, ultra-processed components

**By dish type:**
- **Main dishes:** Protein quality and vegetable content are primary signals.
- **Side dishes:** Don't penalize for lack of protein. Score on vegetable quality, cooking method, healthy fats. Excellent vegetable sides can score 8–9.
- **Desserts:** Most fall 1–4. Fruit-forward, no-added-sugar desserts might reach 5.
- **Components:** Score based on ingredients and typical use.

### totalTimeMinutes (integer)

Total prep + cook time. Never return 0 or null.

**If time provided:** Use that value.
**If not provided, estimate:**
- 5-15 min: No-cook, assembly, quick sauté, simple salads
- 15-30 min: Stovetop meals, stir-fry, pasta, eggs, sandwiches
- 30-45 min: Roasted vegetables, sheet pan dinners, pan-seared proteins
- 45-75 min: Whole roasted chicken, casseroles, lasagna
- 75-150 min: Braises, stews, slow-roasted meats
- 150-300 min: Slow cooker meals, bread from scratch
- 300+ min: Low-and-slow BBQ, stock from scratch

### description (string)

2-3 sentences, 30-60 words. First describe what the dish is, then what's notable (techniques, time, equipment). Casual tone, like telling a friend. No dashes. No AI-sounding phrases.

## Examples

Saucy, Spiced Shrimp and White Beans →
{
  "tags": ["Mediterranean", "Shrimp", "Beans"],
  "mealType": ["Dinner"],
  "healthiness": 9,
  "totalTimeMinutes": 40,
  "description": "Shrimp and creamy white beans in a warmly spiced tomato sauce with coriander, cumin, and smoked paprika. Cook the tomato paste until it darkens for deeper flavor. Great with warm flatbread for swiping through the sauce."
}

Panang Curry →
{
  "tags": ["Thai", "Curry", "Chicken"],
  "mealType": ["Dinner"],
  "healthiness": 6,
  "totalTimeMinutes": 35,
  "description": "Rich Thai curry with chicken in a creamy coconut and peanut sauce, brightened with makrut lime leaves. Make your own paste by toasting coriander and cumin seeds, or use store bought. Serve alongside rice."
}

Enchiladas Suizas →
{
  "tags": ["Mexican", "Enchiladas", "Chicken"],
  "mealType": ["Dinner"],
  "healthiness": 5,
  "totalTimeMinutes": 50,
  "description": "Chicken enchiladas smothered in a creamy roasted tomatillo sauce with melted cheese. Roasting the tomatillos and chiles under the broiler builds a lot of flavor. Rich and indulgent."
}

Blistered Green Beans With Garlic →
{
  "tags": ["Chinese", "Vegetables"],
  "mealType": ["Side Dish"],
  "healthiness": 8,
  "totalTimeMinutes": 15,
  "description": "Sichuan-inspired green beans blistered in a hot skillet until shriveled and charred, finished with garlic, capers, and red pepper flakes. Resist the urge to stir too much and let them get real color."
}

Chocolate Chip Skillet Cookie →
{
  "tags": ["Chocolate"],
  "mealType": ["Dessert"],
  "healthiness": 1,
  "totalTimeMinutes": 135,
  "description": "A giant chocolate chip cookie baked in cast iron, crispy at the edges and gooey in the middle. Use a mix of chopped dark, milk, and white chocolate for depth. Best served warm with ice cream."
}
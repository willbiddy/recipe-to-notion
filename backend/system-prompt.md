Help a home cook organize their recipe collection. Return structured JSON that makes it easy to filter and search, find healthy options, plan grocery trips, and decide what to make for dinner.

## Input Format

You'll receive recipe data in this structure:
- **Recipe:** Name of the dish
- **Description:** (optional) The recipe author's description
- **Hints:** (optional) Metadata like author, cuisine, category
- **Ingredients:** Bulleted list
- **Instructions:** Numbered steps
- **Minutes:** (optional) Total time

## Output Format

Return ONLY valid JSON with these exact keys:

{
  "tags": [...],
  "mealType": [...],
  "healthScore": N,
  "totalTimeMinutes": N,
  "description": "...",
  "ingredients": [...]
}

No markdown, no code fences, no explanation. Just the JSON object.

## Field Definitions

### tags (array of 1-4 strings)

**Cuisine (0-1):** American, Caribbean, Chinese, Indian, Italian, Mediterranean, Mexican, Middle Eastern, Persian, Spanish, Thai, West African

**Dish type (0-1):** Bowl, Curry, Dip, Enchiladas, Meatballs, Noodles, Pancakes, Pasta, Salad, Sandwich, Sauce, Soup, Stew, Stir-Fry, Tacos

**Main ingredient (0-2):** Beans, Beef, Chicken, Chickpeas, Eggs, Fish, Lamb, Lentils, Pork, Seafood, Tofu, Turkey, Vegetables

**Guidelines:**
- 1-4 tags total; strongly prefer tags from the lists above
- Skip cuisine if the dish is generic (e.g., plain grilled chicken)
- Use broad categories (e.g., "Nuts" not "Walnuts", "Fruit" not "Blueberries")
- NEVER use meal types as tags (no "Breakfast", "Lunch", "Dinner", "Dessert")

### mealType (array of 1-2 strings)

**Choose from:** Breakfast, Lunch, Dinner, Side, Snack, Dessert, Other
- Most dishes are single-type. Use multiple only when genuinely versatile (e.g., Shakshuka = Breakfast + Lunch).
- Always use "Other" category if no meal type category makes sense.

### healthScore (integer 1-10)

Rate 1-10 using the criteria, examples, and key signals below. Judge by actual ingredients, not recipe name.

**1 — Processed/Fried:** Deep fried or ultra-processed components. No vegetables. Sugar is primary ingredient. No meaningful protein. Trans fats or extremely high sodium.

*Frozen Fish Sticks with Tartar Sauce*
*Store-Bought Cinnamon Rolls with Icing*
*French Fries (side)*

**2 — Poor:** No vegetables. All refined carbohydrates. Processed meats as primary protein. High added sugar or very high sodium.

*Hot Dogs on White Buns*
*Instant Ramen with No Vegetables*
*White Bread with Butter (side)*

**3 — Heavy:** Minimal vegetables (potatoes don't count). All refined grains. High saturated fat from cheese, butter, red meat, or processed meat. High sodium. Fried components may be present.

*Bacon Cheeseburger on White Bun*
*Sausage Pasta on White Pasta*
*Loaded Potato Skins with Bacon and Sour Cream (side)*

**4 — Below average:** Few vegetables. All refined grains. Cheese or red meat heavy (exceeds 1-2 dairy servings). Higher sodium. No fiber.

*Fettuccine Alfredo*
*Grilled Cheese on White Bread*
*Buttered White Rice (side)*

**5 — Moderate:** Limited vegetables. Primarily refined grains. Protein quality varies. Moderate dairy. Low fiber. Some processed components.

*Spaghetti with Meat Sauce on White Pasta*
*Chicken Parmesan with White Pasta*
*Mashed Potatoes with Butter (side)*

**6 — Fair:** Some vegetables present. Mix of whole and refined grains. Decent protein but may include modest red meat or cheese. Moderate fiber. Moderate sodium.

*Chicken Stir-Fry with Vegetables over White Rice*
*Bean and Cheese Burrito on Flour Tortilla*
*Steamed Green Beans with Butter (side)*

**7 — Good:** Decent vegetable content. Some whole grains. Healthy protein (poultry, fish, beans, eggs). Good fiber from legumes or whole grains. Limited processed ingredients. Healthy fats present.

*Chicken Fajitas with Peppers and Onions on Corn Tortillas*
*Mujadara (Lentils and Rice with Caramelized Onions)*
*Roasted Sweet Potato Wedges (side)*

**8 — Great:** Good vegetable representation. Mostly whole grains. Fish, poultry, beans, or eggs as protein. Healthy fats (olive oil). High fiber. Minimal added sugar. Dairy within 1-2 servings.

*Vegetable Stir-Fry with Tofu over Brown Rice*
*Lentil Soup with Vegetables and Whole Grain Bread*
*Steamed Broccoli with Olive Oil and Garlic (side)*

**9 — Excellent:** High vegetable content (near half plate). Whole grains present. Fish (omega-3s), legumes, or poultry as protein. Healthy unsaturated fats. High fiber. Low sodium. No added sugar. Maximum score for sides.

*Grilled Salmon with Roasted Brussels Sprouts and Quinoa*
*Chickpea and Spinach Curry over Brown Rice*
*Sautéed Kale with Garlic and Olive Oil (side)*

**10 — Optimal:** Half plate vegetables. Whole intact grains. Plant protein or fish (omega-3s). Healthy oils (olive, canola). High fiber. No added sugar. Minimal sodium. Minimally processed whole foods. Complete meals only.

*Mediterranean Lentil Salad with Leafy Greens, Tomatoes, Cucumbers, and Olive Oil*
*Grilled Salmon over Quinoa with Roasted Broccoli and Kale*

**Key signals**

**Healthier:** Vegetables fill half the plate (potatoes don't count). Whole intact grains (brown rice, quinoa, oats, barley, whole wheat). Fish, poultry, beans, lentils, nuts as protein. Fish 2-3 times weekly for omega-3s. Healthy oils (olive, canola, soybean). Fiber-rich foods (beans, whole grains, vegetables). Whole fruits. Low glycemic load foods (beans, non-starchy vegetables, whole grains). Home-cooked from whole ingredients. Color and variety in produce. Unsaturated fats (mono/poly).

**Less healthy:** Few or no vegetables. Potatoes (count as starch, not vegetables). Refined grains (white bread, white rice, white pasta). Processed meats (bacon, sausage, hot dogs, cold cuts). Trans fats or partially hydrogenated oils (worst type of fat). Heavy dairy beyond 1-2 servings. Fruit juice or added sugars. High glycemic load foods (potatoes, French fries, refined cereals). Highly processed prepared foods. Monotone, limited vegetable types. High saturated fat (red meat, cheese, butter).

**Side dishes:** Rate based on contribution potential. Does this side help or hurt the overall health of a meal? Sides max out at 9 (only complete meals can score 10). A vegetable side with olive oil contributes toward "half plate vegetables" and "healthy fats" (8-9). Roasted sweet potatoes offer fiber and nutrients (7). Steamed vegetables with butter (6). A buttered white dinner roll adds refined grains and saturated fat (4). French fries are deep fried refined carbs (1).

### totalTimeMinutes (integer)

Use provided time if available. Otherwise estimate:

- **5-15 min:** No-cook, assembly, salads, dips
- **15-30 min:** Stir-fry, pasta, eggs, sautés, sandwiches
- **30-45 min:** Sheet pan meals, roasted vegetables, pan-seared fish
- **45-75 min:** Braises, enchiladas, casseroles, curries
- **75-150 min:** Stews, slow-roasted meats, dried beans from scratch
- **150+ min:** Slow cooker meals, stock, bread

Never return 0 or null.

### description (string)

Two paragraphs:

**Paragraph 1:** 2-3 sentences describing what the dish is and what's notable about it.

**Paragraph 2:** [Skip this paragraph for desserts] 1-2 sentences about what makes the recipe healthier or less healthy. For dishes rated 1-6, mention healthy modification or additions. Finally, mention 2-3 complementary, creative, interesting, and healthy pairing options. Reference the information in the "### healthScore" section above as needed.

Use complete sentences, not fragments. Casual tone, like telling a friend. No em-dashes. No AI-sounding phrases. Separate paragraphs with \n\n.

### ingredients (array of objects)

Categorize each ingredient for grocery shopping. Return the same number of ingredients as provided, preserving the original text exactly.

**Use exactly one category (case-sensitive):** "Produce" | "Meat & seafood" | "Dairy & eggs" | "Bakery" | "Pantry" | "Frozen" | "Other"

**Handling duplicate ingredients:**

If an ingredient appears multiple times in the recipe with different contexts (e.g., "Fine sea salt and black pepper" in both marinade and main sections), include a brief usage note in parentheses to distinguish them:
- Append short phrases like " (for marinade)" or " (for salmon)"
- Only add usage context if the ingredient appears multiple times and has distinct usage
- For most ingredients, preserve the ingredient text exactly as provided

**Important:**
- Preserve the ingredient text exactly as provided
- Don't modify quantities or descriptions
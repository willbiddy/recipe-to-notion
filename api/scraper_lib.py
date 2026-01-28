"""
Shared recipe scraping logic using the recipe-scrapers library.

This module is imported by both the Vercel serverless function (api/scrape.py)
and the local Flask development server (scripts/scraper-dev.py).
"""

from recipe_scrapers import scrape_html


def safe_call(method):
    """
    Safely call a scraper method, returning None if it fails.
    
    Many recipe-scrapers methods are optional and may raise exceptions
    for unsupported sites or missing data.
    """
    try:
        result = method()
        # Handle empty strings as None for consistency
        if result == "" or result == []:
            return None
        return result
    except Exception:
        return None


def scrape_recipe(html: str, url: str) -> dict:
    """
    Extract recipe data from HTML using recipe-scrapers library.
    
    Args:
        html: The HTML content of the recipe page.
        url: The original URL of the recipe page.
        
    Returns:
        Dictionary containing all extracted recipe fields.
        
    Raises:
        Exception: If recipe data cannot be extracted.
    """
    scraper = scrape_html(html, org_url=url, wild_mode=True)
    
    # Extract title (required field)
    try:
        title = scraper.title()
    except Exception:
        title = ""
    
    # Extract ingredients (required field)
    try:
        ingredients = scraper.ingredients()
    except Exception:
        ingredients = []
    
    # JSON-LD field names that should never be instruction steps
    INVALID_INSTRUCTIONS = {
        '@type', 'type', 'text', 'url', 'name', 'image', 'video',
        'howtostep', 'howto', 'itemlistelement', '@context', 'position'
    }
    
    def is_valid_instruction(step: str) -> bool:
        """Check if a step is a real instruction, not a JSON-LD field name."""
        if not step or not step.strip():
            return False
        stripped = step.strip().lower()
        # Filter out JSON-LD field names and very short strings
        if stripped in INVALID_INSTRUCTIONS:
            return False
        # Real instructions should be more than just a word or two
        if len(stripped) < 10:
            return False
        return True
    
    # Extract instructions - prefer the string method as it's more reliable
    # The instructions() method returns a single string with newlines
    raw_instructions = safe_call(scraper.instructions)
    if raw_instructions and isinstance(raw_instructions, str):
        # Split by newlines and filter
        instructions = [s.strip() for s in raw_instructions.split('\n') if is_valid_instruction(s)]
    else:
        instructions = []
    
    # If string method failed or returned nothing, try instructions_list()
    if not instructions:
        instructions_list_result = safe_call(scraper.instructions_list)
        if instructions_list_result:
            cleaned = []
            for step in instructions_list_result:
                if isinstance(step, dict):
                    # Extract text from HowToStep object
                    text = step.get('text') or step.get('name') or ''
                    if is_valid_instruction(text):
                        cleaned.append(text.strip())
                elif isinstance(step, str) and is_valid_instruction(step):
                    cleaned.append(step.strip())
            instructions = cleaned
    
    return {
        # Core fields
        "title": title,
        "author": safe_call(scraper.author),
        "description": safe_call(lambda: scraper.description()),
        "image": safe_call(scraper.image),
        "ingredients": ingredients,
        "instructions": instructions,
        "yields": safe_call(scraper.yields),
        "totalTime": safe_call(scraper.total_time),
        "canonicalUrl": safe_call(scraper.canonical_url),
        
        # Additional time fields
        "prepTime": safe_call(scraper.prep_time),
        "cookTime": safe_call(scraper.cook_time),
        
        # Category fields
        "cuisine": safe_call(lambda: scraper.cuisine()),
        "category": safe_call(lambda: scraper.category()),
        
        # Rating fields
        "ratings": safe_call(scraper.ratings),
        "ratingsCount": safe_call(scraper.ratings_count),
        
        # Additional data
        "equipment": safe_call(scraper.equipment),
        "nutrients": safe_call(scraper.nutrients),
        "dietaryRestrictions": safe_call(lambda: scraper.dietary_restrictions()),
        "keywords": safe_call(lambda: scraper.keywords()),
        "cookingMethod": safe_call(lambda: scraper.cooking_method()),
        
        # Site info
        "siteName": safe_call(scraper.site_name),
        "host": safe_call(scraper.host),
        "language": safe_call(scraper.language),
    }

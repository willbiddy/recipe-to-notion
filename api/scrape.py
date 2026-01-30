"""
Vercel Python serverless function for recipe scraping.

Uses the recipe-scrapers library to extract structured recipe data from HTML.
Called by the TypeScript backend with HTML content and URL.
"""

from http.server import BaseHTTPRequestHandler
import json
import sys
import os

# Add api directory to path so we can import scraper_lib
sys.path.insert(0, os.path.dirname(__file__))
from scraper_lib import scrape_recipe


class handler(BaseHTTPRequestHandler):
    """
    Vercel serverless function handler for recipe scraping.
    
    Accepts POST requests with JSON body containing 'url' and 'html' fields.
    Returns extracted recipe data as JSON.
    """
    
    def log_message(self, format, *args):
        """Suppress default request logging."""
        pass
    
    def do_POST(self):
        """Handle POST request to scrape recipe from HTML."""
        try:
            # Read and parse request body
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            url = data.get('url')
            html = data.get('html')
            
            if not url or not html:
                self._send_error(400, "Missing required fields: 'url' and 'html'")
                return
            
            # Scrape the recipe
            result = scrape_recipe(html, url)
            
            # Send success response
            self._send_json(200, result)
            
        except json.JSONDecodeError as e:
            self._send_error(400, f"Invalid JSON: {str(e)}", "JSONDecodeError")
        except ValueError as e:
            # Recipe extraction failures (e.g., no recipe data found)
            self._send_error(400, str(e), "ScrapingError")
        except Exception as e:
            # Unexpected server errors
            error_type = type(e).__name__
            self._send_error(500, f"Internal server error: {str(e)}", error_type)
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()
    
    def _send_json(self, status: int, data: dict):
        """Send a JSON response."""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self._set_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
    
    def _send_error(self, status: int, message: str, error_type: str = "Error"):
        """Send an error response."""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self._set_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps({
            "error": message,
            "errorType": error_type
        }).encode('utf-8'))
    
    def _set_cors_headers(self):
        """Set CORS headers for cross-origin requests."""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

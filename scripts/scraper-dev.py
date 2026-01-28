#!/usr/bin/env python3
"""
Local development server for recipe scraping.

Run this server locally when developing without Vercel:
    python scripts/scraper-dev.py

The server runs on http://localhost:5001 and provides the /scrape endpoint
that the TypeScript backend calls to extract recipe data.
"""

import sys
import os

# Add api directory to path so we can import scraper_lib
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'api'))
from scraper_lib import scrape_recipe

from flask import Flask, request, jsonify

app = Flask(__name__)


@app.route('/scrape', methods=['POST'])
def scrape():
    """
    Scrape recipe data from HTML content.
    
    Request body (JSON):
        url: The original URL of the recipe page.
        html: The HTML content of the recipe page.
        
    Returns:
        JSON object with extracted recipe data, or error details.
    """
    try:
        data = request.json
        
        if not data:
            return jsonify({
                "error": "Missing request body",
                "errorType": "ValidationError"
            }), 400
        
        url = data.get('url')
        html = data.get('html')
        
        if not url or not html:
            return jsonify({
                "error": "Missing required fields: 'url' and 'html'",
                "errorType": "ValidationError"
            }), 400
        
        result = scrape_recipe(html, url)
        return jsonify(result)
        
    except Exception as e:
        error_type = type(e).__name__
        return jsonify({
            "error": str(e),
            "errorType": error_type
        }), 400


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


def find_available_port(start_port: int, max_attempts: int = 10) -> int:
    """Find an available port starting from start_port."""
    import socket
    for port in range(start_port, start_port + max_attempts):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('', port))
                return port
        except OSError:
            continue
    raise RuntimeError(f"Could not find available port in range {start_port}-{start_port + max_attempts}")


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--no-reload', action='store_true', help='Disable auto-reload (avoids port conflicts)')
    args = parser.parse_args()
    
    default_port = 5001
    try:
        port = find_available_port(default_port)
    except RuntimeError as e:
        print(f"Error: {e}")
        exit(1)
    
    if port != default_port:
        print(f"Port {default_port} is in use. Using next available port: {port}")
        print("To use a specific port, stop the process using it first.")
    
    print("Starting recipe scraper development server...")
    print(f"Listening on http://localhost:{port}")
    print("Press Ctrl+C to stop")
    print("")
    
    # use_reloader=False prevents Flask from spawning a child process that fights for the port
    app.run(host='0.0.0.0', port=port, debug=True, use_reloader=not args.no_reload)

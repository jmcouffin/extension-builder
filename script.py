#!/usr/bin/env python3
"""
PyRevit.tab Folder Explorer

This script crawls the pyRevit.tab directory and all its subfolders,
collecting information about all files and folders in a structured dictionary.
"""

import os
import json
import time
import base64
import requests
from typing import Dict, List, Any, Optional
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("pyrevit_explorer.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuration
CONFIG = {
    "owner": "pyrevitlabs",
    "repo": "pyRevit",
    "path": "extensions",  # Start at the extensions folder to find pyRevit.tab
    "ref": "develop",
    "api_base_url": "https://api.github.com",
    "headers": {
        # Add your GitHub token here if you have one
        # "Authorization": "token YOUR_GITHUB_TOKEN"
    },
    "output_file": "pyrevit_tab_explorer.json",
    "retry_count": 3,
    "retry_delay": 2,  # seconds
}


def fetch_with_retry(url: str, retries: int = 3, delay: int = 2) -> Dict[str, Any]:
    """Fetch data from GitHub API with retries and rate limit handling."""
    last_error = None
    
    for attempt in range(retries):
        try:
            logger.info(f"Fetching {url}")
            response = requests.get(url, headers=CONFIG["headers"])
            
            # Check GitHub API rate limit
            rate_limit = {
                "limit": response.headers.get("X-RateLimit-Limit"),
                "remaining": response.headers.get("X-RateLimit-Remaining"),
                "reset": response.headers.get("X-RateLimit-Reset")
            }
            
            logger.info(f"Rate limit: {rate_limit['remaining']}/{rate_limit['limit']}")
            
            if response.status_code == 403 and int(rate_limit.get("remaining", 0)) == 0:
                reset_time = int(rate_limit.get("reset", time.time() + 60))
                wait_time = max(reset_time - int(time.time()), 0) + 1
                reset_time_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(reset_time))
                
                logger.warning(f"Rate limit exceeded. Waiting until {reset_time_str} ({wait_time}s)")
                time.sleep(wait_time)
                continue
            
            response.raise_for_status()
            return response.json()
            
        except requests.RequestException as error:
            logger.warning(f"Attempt {attempt+1} failed: {str(error)}")
            last_error = error
            
            if attempt < retries - 1:
                sleep_time = delay * (attempt + 1)
                logger.info(f"Retrying in {sleep_time} seconds...")
                time.sleep(sleep_time)
    
    if last_error:
        raise last_error
    else:
        raise Exception("Failed after multiple attempts for unknown reasons")


def fetch_file_content(file_url: str) -> Dict[str, Any]:
    """Fetch file content and handle different file types."""
    try:
        response = requests.get(file_url, headers=CONFIG["headers"])
        response.raise_for_status()
        
        content_type = response.headers.get("content-type", "")
        
        # Handle binary files (images)
        if content_type and ("image/" in content_type or "application/octet-stream" in content_type):
            # For binary files, return base64 encoding
            content = base64.b64encode(response.content).decode("utf-8")
            return {
                "content": content,
                "encoding": "base64",
                "content_type": content_type
            }
        
        # Handle text files
        return {
            "content": response.text,
            "encoding": "utf8",
            "content_type": content_type
        }
    
    except requests.RequestException as error:
        logger.error(f"Error fetching file: {str(error)}")
        return {
            "content": f"Error: {str(error)}",
            "encoding": "error",
            "content_type": None
        }


def find_pyrevit_tab(start_path: str) -> Dict[str, Any]:
    """Find the pyRevit.tab directory by searching from the start path."""
    logger.info(f"Searching for pyRevit.tab from {start_path}")
    
    try:
        # Get contents of the starting directory
        url = f"{CONFIG['api_base_url']}/repos/{CONFIG['owner']}/{CONFIG['repo']}/contents/{start_path}?ref={CONFIG['ref']}"
        contents = fetch_with_retry(url)
        
        # Direct check for pyRevit.tab
        for item in contents:
            if item["type"] == "dir" and item["name"] == "pyRevit.tab":
                logger.info(f"Found pyRevit.tab directly at {item['path']}")
                return item
        
        # Search in subdirectories
        for item in contents:
            if item["type"] == "dir":
                # Check if it's an extension
                if item["name"].endswith(".extension"):
                    extension_contents = fetch_with_retry(item["url"])
                    
                    for ext_item in extension_contents:
                        if ext_item["type"] == "dir" and ext_item["name"] == "pyRevit.tab":
                            logger.info(f"Found pyRevit.tab at {ext_item['path']}")
                            return ext_item
        
        logger.error("Could not find pyRevit.tab directory")
        raise FileNotFoundError("pyRevit.tab directory not found")
        
    except Exception as error:
        logger.error(f"Error finding pyRevit.tab: {str(error)}")
        raise


def explore_directory(dir_info: Dict[str, Any], include_content: bool = True) -> Dict[str, Any]:
    """
    Recursively explore a directory and its subdirectories.
    
    Args:
        dir_info: Directory information from GitHub API
        include_content: Whether to include file contents
        
    Returns:
        Dictionary with directory structure and contents
    """
    result = {
        "name": dir_info["name"],
        "path": dir_info["path"],
        "type": "directory",
        "url": dir_info["html_url"],
        "items": []
    }
    
    try:
        contents = fetch_with_retry(dir_info["url"])
        
        for item in contents:
            if item["type"] == "dir":
                # Recursively explore subdirectory
                subdir = explore_directory(item, include_content)
                result["items"].append(subdir)
            else:
                # Add file with or without content
                file_info = {
                    "name": item["name"],
                    "path": item["path"],
                    "type": "file",
                    "size": item["size"],
                    "url": item["html_url"]
                }
                
                if include_content and "download_url" in item and item["download_url"]:
                    logger.info(f"Fetching content for: {item['path']}")
                    file_content = fetch_file_content(item["download_url"])
                    
                    file_info.update({
                        "content_type": file_content["content_type"],
                        "encoding": file_content["encoding"],
                        "content": file_content["content"]
                    })
                
                result["items"].append(file_info)
        
        return result
    
    except Exception as error:
        logger.error(f"Error exploring directory {dir_info['path']}: {str(error)}")
        result["error"] = str(error)
        return result


def save_to_json(data: Dict[str, Any], filename: str) -> None:
    """Save data to a JSON file."""
    try:
        # Ensure the directory exists
        os.makedirs(os.path.dirname(os.path.abspath(filename)) or '.', exist_ok=True)
        
        # Write to file
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        
        logger.info(f"Data saved to {filename}")
    
    except Exception as error:
        logger.error(f"Error saving data: {str(error)}")


def main():
    """Main function to explore pyRevit.tab directory."""
    logger.info("Starting PyRevit.tab exploration...")
    
    try:
        # Find pyRevit.tab directory
        pyrevit_tab = find_pyrevit_tab(CONFIG["path"])
        
        # Explore the directory and all subdirectories
        result = explore_directory(pyrevit_tab, include_content=True)
        
        # Save the results
        save_to_json(result, CONFIG["output_file"])
        
        # Generate a summary
        file_count = 0
        dir_count = 0
        
        def count_items(directory):
            nonlocal file_count, dir_count
            
            for item in directory.get("items", []):
                if item["type"] == "directory":
                    dir_count += 1
                    count_items(item)
                else:
                    file_count += 1
        
        count_items(result)
        
        logger.info(f"Exploration complete! Found {dir_count} directories and {file_count} files.")
        logger.info(f"Results saved to {CONFIG['output_file']}")
        
        return {
            "pyRevit_tab_path": result["path"],
            "directories": dir_count,
            "files": file_count
        }
    
    except Exception as error:
        logger.error(f"Failed to explore pyRevit.tab: {str(error)}")
        return {"error": str(error)}


if __name__ == "__main__":
    main()
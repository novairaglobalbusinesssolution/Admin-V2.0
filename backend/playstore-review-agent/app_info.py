import socket
import logging

# Ensure IPv4 is used on Windows to prevent IPv6 connection stalls
_orig_getaddrinfo = socket.getaddrinfo
def _ipv4_getaddrinfo(*args, **kwargs):
    responses = _orig_getaddrinfo(*args, **kwargs)
    ipv4 = [r for r in responses if r[0] == socket.AF_INET]
    return ipv4 if ipv4 else responses
socket.getaddrinfo = _ipv4_getaddrinfo
socket.setdefaulttimeout(15)

from google_play_scraper import app

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app_info")

def get_app_details(package_id: str, country: str = 'in', lang: str = 'en') -> dict:
    """
    Fetches Play Store metadata for a given app package ID.
    Returns a dictionary with app metadata or an error dict if not found.
    """
    try:
        data = app(package_id, lang=lang, country=country)
        return {
            "success": True,
            "title": data.get("title", ""),
            "developer": data.get("developer", ""),
            "icon": data.get("icon", ""),
            "headerImage": data.get("headerImage", ""),
            "score": round(data.get("score") or 0.0, 2),
            "ratings": data.get("ratings", 0),
            "reviews": data.get("reviews", 0),
            "summary": data.get("summary", ""),
            "installs": data.get("installs", "N/A"),
            "genre": data.get("genre", "N/A"),
            "price": data.get("price", 0),
            "free": data.get("free", True),
            "url": data.get("url", f"https://play.google.com/store/apps/details?id={package_id}")
        }
    except Exception as e:
        logger.error(f"Failed to fetch app info for '{package_id}': {e}")
        return {
            "success": False,
            "error": str(e),
            "package_id": package_id
        }

if __name__ == "__main__":
    import sys
    pkg = sys.argv[1] if len(sys.argv) > 1 else 'com.spotify.music'
    res = get_app_details(pkg)
    print(res)

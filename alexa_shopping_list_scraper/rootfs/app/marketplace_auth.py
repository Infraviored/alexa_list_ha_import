#!/usr/bin/env python3
import urllib.parse as up
import requests
import os
import json

CACHE_FILE = "/data/marketplace_cache.json" if os.path.exists("/data") else "marketplace_cache.json"

def get_marketplace_auth(region, assoc_override=None, lang_override=None, refresh=False):
    """
    Returns authentication parameters for a given Amazon region.
    Priority: Manual Overrides > Cache > Auto-Detection
    """
    region = region.lower().strip()
    
    # 1. Start with discovery (Cache or Live) as the base
    base_data = None
    if not refresh and os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                cache = json.load(f)
                if region in cache:
                    base_data = cache[region]
        except:
            pass

    if not base_data:
        print(f"Detecting marketplace parameters for region: {region}...")
        base_data = _detect_via_redirect(region)
        _update_cache(region, base_data)

    # 2. Apply manual overrides on top of discovered data
    final_assoc = assoc_override or base_data["assoc_handle"]
    final_lang = lang_override or base_data.get("language")
    
    # 3. Build return object
    return {
        "assoc_handle": final_assoc,
        "language": final_lang,
        "signin_url": _build_url(region, final_assoc, final_lang),
        "source": "override" if (assoc_override or lang_override) else "discovery"
    }

def _detect_via_redirect(region):
    target = f"https://www.amazon.{region}/alexaquantum/sp/alexaShoppingList?ref_=list_d_wl_ys_list_1"
    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        # Follow redirects to see where Amazon sends an unauthenticated user
        resp = requests.get(target, headers=headers, allow_redirects=True, timeout=15)
        parsed = up.urlparse(resp.url)
        qs = up.parse_qs(parsed.query)
        
        handle = qs.get("openid.assoc_handle", [None])[0]
        lang = qs.get("language", [None])[0]
        
        # Fallback for known verified defaults if redirect is opaque
        if not handle:
            if region == "de": 
                handle = "amzn_alexa_quantum_de"
            elif region == "com": 
                handle = "amzn_alexa_quantum_us"
            # No broad guessing here. If handle is missing, it stays None to force discovery/failure.
            
        return {
            "assoc_handle": handle,
            "language": lang
        }
    except Exception as e:
        # Emergency fallback for verified regions only
        handle = "amzn_alexa_quantum_de" if region == "de" else ("amzn_alexa_quantum_us" if region == "com" else None)
        return {
            "assoc_handle": handle,
            "language": None,
            "error": str(e)
        }

def _build_url(region, handle, lang):
    params = [
        "openid.pape.max_auth_age=3600",
        f"openid.return_to=https%3A%2F%2Fwww.amazon.{region}%2Falexaquantum%2Fsp%2FalexaShoppingList%3Fref_%3Dlist_d_wl_ys_list_1",
        "openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select",
        f"openid.assoc_handle={handle}",
        "openid.mode=checkid_setup",
        "openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select",
        "openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0",
    ]
    if lang:
        params.insert(4, f"language={lang}")
    
    return f"https://www.amazon.{region}/ap/signin?{'&'.join(params)}"

def _update_cache(region, data):
    cache = {}
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                cache = json.load(f)
        except:
            pass
    
    cache[region] = data
    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(cache, f, indent=2)
    except:
        pass

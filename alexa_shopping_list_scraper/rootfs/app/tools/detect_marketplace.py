#!/usr/bin/env python3
import csv
import json
import time
import traceback
import urllib.parse as up
import os

import requests

# Broad list of Amazon storefront domains seen publicly.
# Some may not support Alexa Shopping List; that's exactly what we want to test.
ALL_REGIONS = [
    "com",       # US
    "ca",
    "com.mx",
    "com.br",
    "co.uk",
    "de",
    "fr",
    "it",
    "es",
    "nl",
    "pl",
    "se",
    "com.tr",
    "ae",
    "sa",
    "sg",
    "in",
    "co.jp",
    "com.au",
    "com.be",
    "eg",
    "ie",
    "co.za",

    # Optional legacy / redirect-like / historically seen variants
    # Keep these at the end so they don't muddy the primary results too much.
    "co",
    "com.sg",
    "com.cn",
    "cn",
]

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/136.0.0.0 Safari/537.36"
)

TIMEOUT = 30
SLEEP_BETWEEN = 1.0
CACHE_FILE = "/data/marketplace_cache.json" if os.path.exists("/data") else "marketplace_cache.json"


def build_target(region: str) -> str:
    return f"https://www.amazon.{region}/alexaquantum/sp/alexaShoppingList?ref_=list_d_wl_ys_list_1"


def parse_from_url(url: str) -> dict:
    parsed = up.urlparse(url)
    qs = up.parse_qs(parsed.query)
    return {
        "assoc_handle": qs.get("openid.assoc_handle", [None])[0],
        "language": qs.get("language", [None])[0],
        "return_to": qs.get("openid.return_to", [None])[0],
        "host": parsed.netloc,
        "path": parsed.path,
    }


def detect_marketplace(region: str) -> dict:
    target = build_target(region)
    session = requests.Session()

    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,de;q=0.8",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    }

    result = {
        "region": region,
        "target": target,
        "ok": False,
        "status_code": None,
        "final_url": None,
        "final_host": None,
        "final_path": None,
        "title_hint": None,
        "assoc_handle": None,
        "language": None,
        "return_to": None,
        "redirect_count": 0,
        "redirect_chain": [],
        "looks_like_signin": False,
        "has_alexaquantum": False,
        "error": None,
    }

    try:
        resp = session.get(
            target,
            headers=headers,
            allow_redirects=True,
            timeout=TIMEOUT,
        )

        result["status_code"] = resp.status_code
        result["final_url"] = resp.url
        result["redirect_count"] = len(resp.history)
        result["redirect_chain"] = [
            {
                "status_code": r.status_code,
                "location": r.headers.get("Location"),
                "url": r.url,
            }
            for r in resp.history
        ]

        url_bits = parse_from_url(resp.url)
        result["assoc_handle"] = url_bits["assoc_handle"]
        result["language"] = url_bits["language"]
        result["return_to"] = url_bits["return_to"]
        result["final_host"] = url_bits["host"]
        result["final_path"] = url_bits["path"]
        result["looks_like_signin"] = "/ap/signin" in (url_bits["path"] or "")
        result["has_alexaquantum"] = "alexaquantum" in (resp.url or "").lower()

        html_lower = resp.text.lower()

        if "<title>" in html_lower:
            try:
                start = html_lower.find("<title>") + len("<title>")
                end = html_lower.find("</title>", start)
                if end > start:
                    result["title_hint"] = resp.text[start:end].strip()
            except Exception:
                pass

        # URL may not expose assoc_handle directly; try HTML fallback
        if not result["assoc_handle"]:
            needles = [
                "openid.assoc_handle=",
                "assoc_handle=",
                "amzn_alexa_quantum_",
                "auflex",
                "itflex",
            ]
            for needle in needles:
                idx = html_lower.find(needle.lower())
                if idx != -1:
                    snippet = resp.text[max(0, idx - 80): idx + 200]
                    result["html_hint"] = snippet
                    break

        result["ok"] = True
        return result

    except Exception as e:
        result["error"] = f"{type(e).__name__}: {e}"
        result["traceback"] = traceback.format_exc(limit=1)
        return result


def summarize(results: list[dict]) -> dict:
    mapped = {}
    unresolved = []
    errors = []

    for r in results:
        if r.get("assoc_handle"):
            mapped[r["region"]] = {
                "assoc_handle": r.get("assoc_handle"),
                "language": r.get("language"),
                "final_url": r.get("final_url"),
            }
        elif r.get("error"):
            errors.append({"region": r["region"], "error": r["error"]})
        else:
            unresolved.append({
                "region": r["region"],
                "status_code": r.get("status_code"),
                "final_url": r.get("final_url"),
                "looks_like_signin": r.get("looks_like_signin"),
                "title_hint": r.get("title_hint"),
            })

    return {
        "detected_mapping": mapped,
        "unresolved": unresolved,
        "errors": errors,
    }


def save_csv(results: list[dict], path: str):
    fields = [
        "region",
        "ok",
        "status_code",
        "assoc_handle",
        "language",
        "looks_like_signin",
        "redirect_count",
        "final_host",
        "final_path",
        "final_url",
        "title_hint",
        "error",
    ]
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for r in results:
            writer.writerow({k: r.get(k) for k in fields})


if __name__ == "__main__":
    results = []

    print(f"Testing {len(ALL_REGIONS)} Amazon regions/domains...")
    print()

    for i, region in enumerate(ALL_REGIONS, start=1):
        print(f"[{i}/{len(ALL_REGIONS)}] Testing region: {region}")
        res = detect_marketplace(region)
        results.append(res)

        if res.get("error"):
            print(f"  ERROR: {res['error']}")
        else:
            print(f"  status:        {res.get('status_code')}")
            print(f"  assoc_handle:  {res.get('assoc_handle')}")
            print(f"  language:      {res.get('language')}")
            print(f"  looks_signin:  {res.get('looks_like_signin')}")
            print(f"  final_url:     {res.get('final_url')}")
            if res.get("title_hint"):
                print(f"  title_hint:    {res.get('title_hint')}")
        print("-" * 100)

        time.sleep(SLEEP_BETWEEN)

    summary = summarize(results)

    with open("marketplace_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    with open("marketplace_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    save_csv(results, "marketplace_results.csv")

    # Save specifically to the cache file used by marketplace_auth.py
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(summary["detected_mapping"], f, indent=2, ensure_ascii=False)

    print()
    print("Saved:")
    print("  marketplace_results.json")
    print("  marketplace_summary.json")
    print("  marketplace_results.csv")
    print(f"  {CACHE_FILE} (Central Cache)")
    print()
    print("Detected mappings:")
    for region, data in summary["detected_mapping"].items():
        print(f"  {region:10} -> {data['assoc_handle']}  lang={data.get('language')}")

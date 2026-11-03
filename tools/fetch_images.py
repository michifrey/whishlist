#!/usr/bin/env python3
"""Fill in product images from the shop pages.

For every wish without an "image", this opens its shop links one after another,
reads the product picture the shop advertises for link previews (og:image,
twitter:image or the JSON-LD product data), downloads it to images/<id>.<ext>
and writes that path into data/wishlist.json.

Wishes that already have an "image" are left alone, so a hand-picked picture
always wins. Search pages are skipped: their preview image is the shop's logo.

    python3 tools/fetch_images.py            # fill in missing images
    python3 tools/fetch_images.py --force    # refresh images fetched earlier
"""
import html
import json
import re
import sys
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "wishlist.json"
IMAGES = ROOT / "images"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/130.0 Safari/537.36")
HEADERS = {"User-Agent": UA, "Accept-Language": "de-CH,de;q=0.9,en;q=0.8",
           "Accept": "text/html,application/xhtml+xml,image/*,*/*;q=0.8"}
SEARCH_HINTS = re.compile(r"/(search|suche)\b|[?&](q|sq|search|query|k)=", re.I)
EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/avif": ".avif", "image/gif": ".gif"}


class MetaParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta, self.ld, self._in_ld = {}, [], False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "meta":
            key = (a.get("property") or a.get("name") or a.get("itemprop") or "").lower()
            if key in ("og:image", "og:image:secure_url", "twitter:image", "twitter:image:src", "image") and a.get("content"):
                self.meta.setdefault(key, a["content"])
        elif tag == "link" and (a.get("rel") or "").lower() == "image_src" and a.get("href"):
            self.meta.setdefault("image_src", a["href"])
        elif tag == "script" and (a.get("type") or "").lower() == "application/ld+json":
            self._in_ld = True
            self.ld.append("")

    def handle_endtag(self, tag):
        if tag == "script":
            self._in_ld = False

    def handle_data(self, data):
        if self._in_ld:
            self.ld[-1] += data


def ld_image(blocks):
    """First image of a Product in JSON-LD, if any."""
    def walk(node):
        if isinstance(node, list):
            for n in node:
                if (r := walk(n)):
                    return r
        elif isinstance(node, dict):
            kind = node.get("@type")
            kinds = kind if isinstance(kind, list) else [kind]
            if "Product" in kinds and node.get("image"):
                img = node["image"]
                img = img[0] if isinstance(img, list) else img
                return img.get("url") if isinstance(img, dict) else img
            for v in node.values():
                if isinstance(v, (list, dict)) and (r := walk(v)):
                    return r
        return None

    for raw in blocks:
        try:
            if (r := walk(json.loads(raw))):
                return r
        except ValueError:
            continue
    return None


def get(url, timeout=20):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.read(), res.headers.get_content_type(), res.geturl()


def image_url_from_page(url):
    body, _, final = get(url)
    p = MetaParser()
    p.feed(body.decode("utf-8", "replace"))
    found = ld_image(p.ld) or next((p.meta[k] for k in
        ("og:image:secure_url", "og:image", "twitter:image", "twitter:image:src", "image_src", "image") if k in p.meta), None)
    return urllib.parse.urljoin(final, html.unescape(found)) if found else None


def fetch_for(item):
    for shop in item.get("shops", []):
        url = shop.get("url", "")
        if not url or SEARCH_HINTS.search(url):
            continue
        try:
            img_url = image_url_from_page(url)
            if not img_url:
                print(f"  {shop.get('name')}: no product image on page")
                continue
            body, ctype, _ = get(img_url)
            if not ctype.startswith("image/") or len(body) < 1000:
                print(f"  {shop.get('name')}: not an image ({ctype})")
                continue
            IMAGES.mkdir(exist_ok=True)
            path = IMAGES / f"{item['id']}{EXT.get(ctype, '.jpg')}"
            path.write_bytes(body)
            return path.relative_to(ROOT).as_posix()
        except Exception as e:  # shops block bots now and then; try the next one
            print(f"  {shop.get('name')}: {e}")
    return None


def main():
    force = "--force" in sys.argv
    data = json.loads(DATA.read_text(encoding="utf-8"))
    changed = 0
    for item in data["items"]:
        img = item.get("image")
        if img and not (force and img.startswith("images/")):
            continue
        print(f"{item['id']}:")
        path = fetch_for(item)
        if path:
            item["image"] = path
            changed += 1
            print(f"  -> {path}")
        elif not any(not SEARCH_HINTS.search(s.get("url", "")) for s in item.get("shops", [])):
            print("  (only search links – add a product link or an \"image\" URL)")
    if changed:
        DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{changed} image(s) added.")


if __name__ == "__main__":
    main()

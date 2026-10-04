#!/usr/bin/env python3
"""Extract NORD rare-disease pages and their OMIM, Orphanet, and GARD links.

The A–Z database at
https://rarediseases.org/rare-diseases/?starts_with=Showing+all+diseases
embeds the full catalog in the page and shows 50 diseases at a time. Cloudflare
blocks a normal HTTP client, so this uses curl_cffi's Chrome impersonation.

Pages 1–2 are already saved in nord_pages_1_2.json. Later pages:

    python3 -m pip install curl_cffi
    python3 nord_scrape.py --pages 3-4
    python3 nord_scrape.py --pages 5 --limit 10
    python3 nord_scrape.py --pages 3-4 --resume

Requests send From: sarah_gu@college.harvard.edu and X-Requester: SarahG.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

try:
    from curl_cffi import requests
except ImportError as exc:  # pragma: no cover - import hint for a fresh environment
    raise SystemExit("Install the HTTP client first: python3 -m pip install curl_cffi") from exc

LIST_URL = "https://rarediseases.org/rare-diseases/?starts_with=Showing+all+diseases"
FROM_HEADER = "sarah_gu@college.harvard.edu"
REQUESTER = "SarahG"
PAGE_SIZE = 50
DATA_MARKER = "var predictiveSearchData = "

SCRIPT_RE = re.compile(r"<script\b[^>]*>.*?</script>", re.IGNORECASE | re.DOTALL)
TRAILING_STAR_RE = re.compile(r"\s*\*$")
NUMBER_RE = re.compile(r"(\d+)")
OMIM_RE = re.compile(r"https?://(?:www\.)?omim\.org/entry/(\d+)", re.IGNORECASE)
ORPHA_RE = re.compile(
    r"https?://(?:www\.)?orpha\.net/en/disease/detail/(\d+)", re.IGNORECASE
)
GARD_RE = re.compile(
    r"https?://rarediseases\.info\.nih\.gov/diseases/(\d+)", re.IGNORECASE
)


def request_headers() -> dict[str, str]:
    return {
        "From": FROM_HEADER,
        "X-Requester": REQUESTER,
        "Accept": "text/html,application/xhtml+xml",
    }


def parse_page_range(spec: str) -> tuple[int, int]:
    text = spec.strip()
    if "-" in text:
        start_text, end_text = text.split("-", 1)
        start, end = int(start_text), int(end_text)
    else:
        start = end = int(text)
    if start < 1 or end < start:
        raise argparse.ArgumentTypeError(f"Invalid page range {spec!r}. Use 3 or 3-4.")
    return start, end


def fold(text: str) -> str:
    """Match the site's base-sensitivity sort: ignore case and accents."""
    decomposed = unicodedata.normalize("NFD", text)
    stripped = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return stripped.casefold()


def listing_sort_key(title: str) -> tuple:
    """Match localeCompare(..., { numeric: true, sensitivity: 'base' })."""
    key: list[tuple[int, int | str]] = []
    for part in NUMBER_RE.split(fold(title)):
        if not part:
            continue
        if part.isdigit():
            key.append((0, int(part)))
        else:
            key.append((1, part))
    return tuple(key)


def open_session() -> requests.Session:
    return requests.Session(impersonate="chrome")


def fetch_text(session: requests.Session, url: str, attempts: int) -> str:
    last_error = "no response"
    for attempt in range(1, attempts + 1):
        try:
            response = session.get(url, headers=request_headers(), timeout=90)
            if response.status_code == 200 and response.text:
                return response.text
            last_error = f"HTTP {response.status_code}"
        except Exception as exc:  # noqa: BLE001 — retry network failures
            last_error = str(exc)
        if attempt < attempts:
            time.sleep(min(8, 2 ** (attempt - 1)))
    raise RuntimeError(f"{url} failed after {attempts} tries: {last_error}")


def load_catalog(html: str) -> list[dict]:
    start = html.find(DATA_MARKER)
    if start < 0:
        raise RuntimeError("The listing page did not include the disease catalog.")
    payload, _ = json.JSONDecoder().raw_decode(html[start + len(DATA_MARKER):])
    rows = payload.get("data") or []
    rows.sort(key=lambda row: listing_sort_key(row.get("title") or ""))
    return rows


def page_slice(rows: list[dict], start_page: int, end_page: int) -> list[dict]:
    start = (start_page - 1) * PAGE_SIZE
    end = end_page * PAGE_SIZE
    selected = []
    for offset, post in enumerate(rows[start:end]):
        selected.append(
            {
                "title": post.get("title") or "",
                "synonyms": post.get("synonyms") or [],
                "postType": post.get("post_type") or "",
                "nordId": str(post.get("id")),
                "url": post.get("permalink"),
                "listingPage": start_page + offset // PAGE_SIZE,
            }
        )
    return selected


def first_id(pattern: re.Pattern[str], html: str) -> str | None:
    match = pattern.search(html)
    return match.group(1) if match else None


def extract_identifiers(html: str) -> dict[str, str | None]:
    """Drop the embedded catalog, then read the resource links on this page."""
    body = SCRIPT_RE.sub(" ", html)
    return {
        "omim": first_id(OMIM_RE, body),
        "orphanet": first_id(ORPHA_RE, body),
        "gard": first_id(GARD_RE, body),
    }


def disease_record(row: dict, ids: dict[str, str | None]) -> dict:
    raw_name = row["title"].strip()
    post_type = row["postType"]
    nord_id = row["nordId"]
    omim_id = ids["omim"]
    orpha_id = ids["orphanet"]
    gard_id = ids["gard"]
    return {
        "name": TRAILING_STAR_RE.sub("", raw_name).strip(),
        "nordReport": post_type == "rare-diseases" or raw_name.endswith("*"),
        "synonyms": row["synonyms"],
        "listingPage": row["listingPage"],
        "nord": {
            "wordpressId": nord_id,
            "postType": post_type,
            "url": row["url"],
            "api": f"https://rarediseases.org/wp-json/wp/v2/{post_type}/{nord_id}",
        },
        "omim": None
        if not omim_id
        else {
            "id": omim_id,
            "url": f"https://www.omim.org/entry/{omim_id}",
            "api": f"https://api.omim.org/api/entry?mimNumber={omim_id}&format=json",
        },
        "orphanet": None
        if not orpha_id
        else {
            "id": orpha_id,
            "url": f"https://www.orpha.net/en/disease/detail/{orpha_id}",
            "api": f"https://api.orphacode.org/EN/ClinicalEntity/orphacode/{orpha_id}",
        },
        "gard": None
        if not gard_id
        else {
            "id": gard_id,
            "url": f"https://rarediseases.info.nih.gov/diseases/{gard_id}/x",
        },
    }


def envelope(start_page: int, end_page: int, diseases: list[dict]) -> dict:
    return {
        "source": LIST_URL,
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "pages": list(range(start_page, end_page + 1)),
        "pageSize": PAGE_SIZE,
        "count": len(diseases),
        "requestHeaders": {"From": FROM_HEADER, "X-Requester": REQUESTER},
        "notes": [
            "Names, synonyms, and NORD links come from the listing dataset that the page renders 50 rows at a time.",
            "OMIM, Orphanet, and GARD identifiers were read from each disease page.",
            "omim.api requires an OMIM API key sent as the apiKey parameter.",
            "orphanet.api is the ORPHAcode API for that disease code. A request without a token returns 401.",
            "nord.api is the WordPress REST record for that disease page.",
        ],
        "diseases": diseases,
    }


def write_output(path: Path, start_page: int, end_page: int, diseases: list[dict]) -> None:
    path.write_text(
        json.dumps(envelope(start_page, end_page, diseases), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def load_done(path: Path) -> list[dict]:
    if not path.exists():
        return []
    saved = json.loads(path.read_text(encoding="utf-8"))
    return list(saved.get("diseases") or [])


def scrape(
    start_page: int,
    end_page: int,
    out_path: Path,
    delay: float,
    limit: int,
    resume: bool,
    attempts: int,
) -> None:
    done = load_done(out_path) if resume else []
    done_urls = {item["nord"]["url"] for item in done if item.get("nord")}

    session = open_session()
    print(f"Opening {LIST_URL}", flush=True)
    catalog = load_catalog(fetch_text(session, LIST_URL, attempts))
    total_pages = (len(catalog) + PAGE_SIZE - 1) // PAGE_SIZE
    if start_page > total_pages:
        raise SystemExit(f"Page {start_page} is past the last page ({total_pages}).")

    rows = page_slice(catalog, start_page, end_page)
    if limit:
        rows = rows[:limit]
    print(
        f"Catalog has {len(catalog)} diseases across {total_pages} pages. "
        f"Fetching {len(rows)} disease page(s) from pages {start_page}-{end_page}.",
        flush=True,
    )

    diseases = list(done)
    for index, row in enumerate(rows, start=1):
        if row["url"] in done_urls:
            print(f"[{index}/{len(rows)}] skip {row['title']}", flush=True)
            continue
        html = fetch_text(session, row["url"], attempts)
        record = disease_record(row, extract_identifiers(html))
        diseases.append(record)
        done_urls.add(row["url"])
        write_output(out_path, start_page, end_page, diseases)
        omim = record["omim"]["id"] if record["omim"] else "-"
        orpha = record["orphanet"]["id"] if record["orphanet"] else "-"
        gard = record["gard"]["id"] if record["gard"] else "-"
        print(
            f"[{index}/{len(rows)}] {record['name']}  OMIM {omim}  Orphanet {orpha}  GARD {gard}",
            flush=True,
        )
        if delay and index < len(rows):
            time.sleep(delay)

    print(f"Wrote {len(diseases)} diseases to {out_path}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--pages",
        default="3-4",
        type=parse_page_range,
        help="Listing page or inclusive range. Pages 1-2 are already extracted. Default: 3-4.",
    )
    parser.add_argument(
        "--out",
        type=Path,
        help="Output JSON path. Default: nord_pages_<start>_<end>.json",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.35,
        help="Seconds to wait between disease pages. Default: 0.35.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Fetch only the first N diseases in the page range. Default: all of them.",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Keep diseases already stored in the output file and fill in the rest.",
    )
    parser.add_argument(
        "--attempts",
        type=int,
        default=3,
        help="Retries per request. Default: 3.",
    )
    args = parser.parse_args()
    start_page, end_page = args.pages
    out_path = args.out or Path(f"nord_pages_{start_page}_{end_page}.json")
    try:
        scrape(start_page, end_page, out_path, args.delay, args.limit, args.resume, args.attempts)
    except KeyboardInterrupt:
        print("\nStopped. Re-run with --resume to continue this output file.", file=sys.stderr)
        raise SystemExit(130) from None


if __name__ == "__main__":
    main()

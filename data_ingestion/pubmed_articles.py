#!/usr/bin/env python3
"""Retrieve every PubMed article for each disease with NCBI E-utilities.

    python3 pubmed_articles.py rarediseases_sample.json [pubmed_articles.json]

Each disease is searched as its name and specific synonyms in Title/Abstract,
plus its name as a MeSH heading. ESearch returns at most 9,999 PMIDs per query,
so larger result sets are split by publication date. ESummary supplies article
metadata in batches of 200. Requests carry tool/email from requestHeaders and
are spaced to NCBI's 3-per-second limit for clients without an API key.

Full article lists go to the articles file; the disease JSON gets a summary
(query, count, counts by year, and the most recent articles).
"""

from __future__ import annotations

import json
import sys
import urllib.parse
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path

from curl_cffi import requests

from nih_reporter import query_terms
from omim_mechanisms import RateLimiter, retry_delay

EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
ESEARCH_CAP = 9999
SUMMARY_BATCH = 200
FIRST_YEAR = 1800
RECENT = 10


class PubMed:
    def __init__(self, headers: dict):
        self.session = requests.Session(impersonate="chrome")
        self.limiter = RateLimiter(min_interval=0.35)
        self.headers = {**headers, "Accept": "application/json"}
        self.ident = {"tool": headers.get("X-Requester") or "SarahG", "email": headers.get("From") or ""}

    def call(self, endpoint: str, params: dict, post: bool = False, attempts: int = 5) -> dict:
        params = {**params, **self.ident, "db": "pubmed", "retmode": "json"}
        url = f"{EUTILS}/{endpoint}.fcgi"
        for attempt in range(1, attempts + 1):
            self.limiter.wait()
            if post:
                response = self.session.post(url, data=params, headers=self.headers, timeout=120)
            else:
                response = self.session.get(url, params=params, headers=self.headers, timeout=120)
            if response.status_code == 200:
                try:
                    return response.json()
                except ValueError:
                    pass
            if attempt < attempts:
                self.limiter.cooldown(retry_delay(dict(response.headers), attempt))
                continue
            raise RuntimeError(f"E-utilities {endpoint} returned HTTP {response.status_code}: {response.text[:200]}")
        raise RuntimeError(f"E-utilities {endpoint} failed")

    def search(self, term: str, mindate: str | None = None, maxdate: str | None = None, retmax: int = 0) -> dict:
        params = {"term": term, "retmax": retmax}
        if mindate:
            params.update({"datetype": "pdat", "mindate": mindate, "maxdate": maxdate})
        return self.call("esearch", params).get("esearchresult") or {}

    def pmids(self, term: str) -> tuple[int, list[str], str]:
        head = self.search(term)
        total = int(head.get("count") or 0)
        translation = head.get("querytranslation") or ""
        if total == 0:
            return 0, [], translation
        if total <= ESEARCH_CAP:
            return total, self.search(term, retmax=ESEARCH_CAP).get("idlist") or [], translation
        found: list[str] = []
        self._split(term, FIRST_YEAR, date.today().year + 1, found)
        return total, list(dict.fromkeys(found)), translation

    def _split(self, term: str, start: int, end: int, found: list[str]) -> None:
        """Bisect the publication-year range until each slice fits under the ESearch cap."""
        result = self.search(term, f"{start}/01/01", f"{end}/12/31")
        count = int(result.get("count") or 0)
        if count == 0:
            return
        if count <= ESEARCH_CAP:
            found += self.search(term, f"{start}/01/01", f"{end}/12/31", retmax=ESEARCH_CAP).get("idlist") or []
            return
        if start == end:
            for month in range(1, 13):
                last = 31 if month in (1, 3, 5, 7, 8, 10, 12) else 30 if month != 2 else 29
                found += self.search(term, f"{start}/{month:02d}/01", f"{start}/{month:02d}/{last}", retmax=ESEARCH_CAP).get("idlist") or []
            return
        middle = (start + end) // 2
        self._split(term, start, middle, found)
        self._split(term, middle + 1, end, found)

    def summaries(self, ids: list[str]) -> list[dict]:
        articles = []
        for start in range(0, len(ids), SUMMARY_BATCH):
            batch = ids[start : start + SUMMARY_BATCH]
            result = self.call("esummary", {"id": ",".join(batch)}, post=True).get("result") or {}
            for pmid in result.get("uids") or batch:
                if isinstance(result.get(pmid), dict):
                    articles.append(article_record(result[pmid]))
        return articles


def article_record(item: dict) -> dict:
    ids = {a.get("idtype"): a.get("value") for a in item.get("articleids") or []}
    authors = [a.get("name") for a in item.get("authors") or [] if a.get("name")]
    pmid = str(item.get("uid"))
    sort_date = (item.get("sortpubdate") or "")[:10].replace("/", "-")
    return {
        "pmid": pmid,
        "title": item.get("title"),
        "journal": item.get("fulljournalname") or item.get("source"),
        "pubDate": item.get("pubdate"),
        "year": int(sort_date[:4]) if sort_date[:4].isdigit() else None,
        "sortDate": sort_date or None,
        "authors": authors[:5],
        "authorCount": len(authors),
        "publicationTypes": item.get("pubtype") or [],
        "doi": ids.get("doi"),
        "pmcid": ids.get("pmc"),
        "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
    }


def pubmed_query(disease: dict) -> str:
    clauses = [f'"{t}"[Title/Abstract]' for t in query_terms(disease)]
    name = (disease.get("name") or "").replace('"', "").strip()
    if name:
        clauses.insert(0, f'"{name}"[MeSH Terms]')
    return " OR ".join(clauses)


def articles_for(pubmed: PubMed, disease: dict) -> tuple[dict, list[dict]]:
    query = pubmed_query(disease)
    total, ids, translation = pubmed.pmids(query)
    articles = pubmed.summaries(ids)
    articles.sort(key=lambda a: a.get("sortDate") or "", reverse=True)
    by_year = Counter(a["year"] for a in articles if a.get("year"))
    reviews = sum(any("Review" in t for t in a["publicationTypes"]) for a in articles)
    summary = {
        "query": query,
        "queryTranslation": translation,
        "pubmedUrl": "https://pubmed.ncbi.nlm.nih.gov/?term=" + urllib.parse.quote(query),
        "count": total,
        "retrieved": len(articles),
        "reviewCount": reviews,
        "firstYear": min(by_year) if by_year else None,
        "latestYear": max(by_year) if by_year else None,
        "countsByYear": {str(y): by_year[y] for y in sorted(by_year)},
        "recentArticles": articles[:RECENT],
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
    }
    return summary, articles


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("rarediseases_sample.json")
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else path.with_name("pubmed_articles.json")
    document = json.loads(path.read_text(encoding="utf-8"))
    pubmed = PubMed(dict(document.get("requestHeaders") or {}))
    store = {
        "source": "NCBI E-utilities (PubMed)",
        "requestHeaders": document.get("requestHeaders"),
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "diseases": {},
    }

    for disease in document.get("diseases") or []:
        name = disease.get("name")
        summary, articles = articles_for(pubmed, disease)
        summary["articlesFile"] = out.name
        disease["pubmed"] = summary
        store["diseases"][name] = {"query": summary["query"], "count": summary["count"], "articles": articles}
        print(f"{name}: {summary['count']} articles ({summary['retrieved']} retrieved, {summary['reviewCount']} reviews)", flush=True)
        path.write_text(json.dumps(document, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        out.write_text(json.dumps(store, ensure_ascii=False) + "\n", encoding="utf-8")

    notes = [n for n in document.get("notes") or [] if not n.startswith("pubmed")]
    notes.append(
        "pubmed summarises PubMed articles matching the disease name as a MeSH heading or the name/specific synonyms "
        f"in Title/Abstract. The full article list for each disease is in {out.name}."
    )
    document["notes"] = notes
    path.write_text(json.dumps(document, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Updated {path} and {out}", flush=True)


if __name__ == "__main__":
    main()

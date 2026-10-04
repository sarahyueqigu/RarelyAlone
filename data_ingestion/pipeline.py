#!/usr/bin/env python3
"""Rare-disease ingestion pipeline: NORD first, then OMIM, HPO, ClinicalTrials.gov, NIH RePORTER, PubMed.

Produces a JSON file with the same structure as rarediseases_sample.json.

    python3 -m pip install curl_cffi
    export OMIM_API_KEY='your-key'

    # Reproduce rarediseases_sample.json (first 19 diseases of listing pages 1-2, plus four lookups)
    python3 pipeline.py --pages 1-2 --limit 19 \\
        --names "Noonan syndrome" "Costello syndrome" "cardiofaciocutaneous syndrome" "neurofibromatosis type 1 (NF1)" \\
        --out rarediseases_sample.json

    # Any later listing pages
    python3 pipeline.py --pages 3-4 --out rarediseases_pages_3_4.json

    # Only rebuild the Orphanet directory links in an existing file (no API key or network needed)
    python3 pipeline.py --orphanet-only --out rarediseases_sample.json

Stages run in this order, each over every disease, and the output is saved after every disease:

  1. nord           NORD A-Z catalog and disease pages (names, synonyms, OMIM / Orphanet / GARD links)
  2. omimSections   OMIM text sections                      (OMIM API, key required)
  3. geneVariantMechanism  causal gene and variant mechanism (OMIM API)
  4. hpoGenePatterns       symptom patterns shared across genes (OMIM clinical synopsis + NLM HPO API)
  5. clinicalTrials        ClinicalTrials.gov API v2, split into completed / ongoing
  6. nihFunding            NIH RePORTER projects, split into ongoing / past
  7. pubmed                PubMed (E-utilities); full article lists go to --articles-out
  8. orphanetDirectories   links to Orphanet's patient-organisation, expert-centre, registry, research and
                           trial directories for the ORPHAcode (built locally; orpha.net is not requested)

Requests send From: sarah_gu@college.harvard.edu and X-Requester: SarahG. The OMIM key is read from
OMIM_API_KEY, sent only as the apiKey parameter, and never written to the output. --resume keeps
diseases and stage results already in the output file and fills in the rest.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import unicodedata
import urllib.parse
from collections import Counter
from datetime import date, datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

try:
    from curl_cffi import requests
except ImportError as exc:  # pragma: no cover - import hint for a fresh environment
    raise SystemExit("Install the HTTP client first: python3 -m pip install curl_cffi") from exc

FROM_HEADER = "sarah_gu@college.harvard.edu"
REQUESTER = "SarahG"
REQUEST_HEADERS = {"From": FROM_HEADER, "X-Requester": REQUESTER}
SOURCE = "https://rarediseases.org/rare-diseases/"

NOTES = [
    "Each disease was located on the NORD letter page for the first letter of its name.",
    "OMIM and Orphanet identifiers were read from that disease page.",
    "omim.api requires an OMIM API key sent as the apiKey parameter.",
    "orphanet.api is the ORPHAcode API. A request without a token returns 401.",
    "omimSections holds the named OMIM text sections. A moved entry is read from its new MIM number. "
    "Calls used the headers in this file and were spaced 2 seconds apart.",
    "geneVariantMechanism names the gene from the OMIM phenotype map, or from the gene the disease text cites "
    "when the map has none (gene.source). The mechanism is classified from disease-entry sentences and from "
    "gene-entry sentences that also name the disease. basis says whether OMIM states the mechanism or it was inferred.",
    "hpoGenePatterns compares the OMIM clinical synopsis of each gene in the disease's phenotypic series as HPO "
    "terms (names, parents, and unmatched features via the NLM Clinical Tables HPO API). "
    "crossDiseaseGenePatterns repeats the comparison across all genes in this file.",
    "clinicalTrials lists ClinicalTrials.gov API v2 studies found with query.cond on the disease name and specific "
    "synonyms. completed = COMPLETED; ongoing = RECRUITING, NOT_YET_RECRUITING, ACTIVE_NOT_RECRUITING, "
    "ENROLLING_BY_INVITATION; stoppedOrUnknown = TERMINATED, WITHDRAWN, SUSPENDED, UNKNOWN and expanded-access "
    "statuses. These groups only hold studies that name the disease (or a synonym) in their conditions, title, or "
    "keywords; studies returned only through ClinicalTrials.gov synonym expansion are kept separately in expansionOnly.",
    "nihFunding lists NIH RePORTER projects whose title, NIH terms, or abstract contain the disease name or a "
    "specific synonym. Fiscal-year records are grouped by core project number; totalAwardAmount sums all years. "
    "ongoing = any record active or end date not yet passed; past = otherwise. relevance is focus when the title "
    "names the disease and mention when only the abstract or terms do.",
    "pubmed summarises PubMed articles matching the disease name as a MeSH heading or the name/specific synonyms "
    "in Title/Abstract. The full article list for each disease is in {articles_file}.",
    "orphanetDirectories links each ORPHAcode to Orphanet's live directories (from https://www.orpha.net/en/expert-centres): "
    "communities (patient organisations, federations and alliances), expertise (expert centres, expert-centre networks, "
    "European Reference Networks), registries (patient registries, biobanks) and activeWork (research projects, "
    "clinical trials). Links are built from the ORPHAcode; directory entries are not fetched.",
]


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


# --------------------------------------------------------------------------------------------------
# Shared HTTP helpers
# --------------------------------------------------------------------------------------------------


class RateLimiter:
    """Space outbound calls and honor a server-imposed cooldown."""

    def __init__(self, min_interval: float = 2.0) -> None:
        self.min_interval = min_interval
        self._next_at = 0.0
        self._blocked_until = 0.0

    def wait(self) -> None:
        current = time.monotonic()
        delay = max(0.0, self._next_at - current, self._blocked_until - current)
        if delay:
            time.sleep(delay)
        self._next_at = time.monotonic() + self.min_interval

    def cooldown(self, seconds: float) -> None:
        self._blocked_until = max(self._blocked_until, time.monotonic() + max(0.0, seconds))


def retry_delay(headers: dict, attempt: int) -> float:
    value = headers.get("Retry-After") or headers.get("retry-after") or ""
    try:
        return max(0.0, float(value))
    except (TypeError, ValueError):
        pass
    try:
        return max(0.0, parsedate_to_datetime(str(value)).timestamp() - time.time())
    except (TypeError, ValueError, OverflowError):
        return min(2**attempt, 60)


def call_url(session, limiter: RateLimiter, url: str, headers: dict, accept: str):
    """GET with rate limiting; retries 429 / 5xx and transient client errors."""
    sent = {**headers, "Accept": accept}
    last_error = None
    for attempt in range(4):
        limiter.wait()
        try:
            response = session.get(url, headers=sent, timeout=60)
        except Exception as exc:  # noqa: BLE001 — retry transient client failures
            last_error = exc
            limiter.cooldown(min(2 ** (attempt + 1), 60))
            continue
        if response.status_code == 429 or response.status_code >= 500:
            limiter.cooldown(retry_delay(dict(response.headers), attempt + 1))
            last_error = response
            continue
        return response
    if isinstance(last_error, requests.Response):
        return last_error
    raise RuntimeError(f"Request failed: {url.split('?')[0]}: {last_error}")


def nested(item: dict, key: str) -> dict:
    return item.get(key) if isinstance(item.get(key), dict) else item


def plain_text(value: str) -> str:
    text = re.sub(r"<[^>]+>", " ", value or "")
    return re.sub(r"\s+", " ", text).strip()


def sentences_of(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"(?<=[.])\s+", plain_text(text)) if part.strip()]


def mentions(text: str, symbol: str) -> bool:
    return re.search(rf"\b{re.escape(symbol)}\b", text, re.IGNORECASE) is not None


def names_other_gene(sentence: str, symbols: set[str]) -> bool:
    for match in re.finditer(r"\b([A-Z][A-Z0-9]{1,9})\b gene", sentence):
        if match.group(1).casefold() not in symbols:
            return True
    return False


def is_negated(sentence: str) -> bool:
    return (
        re.search(r"\bnot\b.{0,60}\b(likely|found|observed|detected|identified|mechanism)\b", sentence, re.IGNORECASE)
        is not None
    )


# --------------------------------------------------------------------------------------------------
# Search terms shared by ClinicalTrials.gov, NIH RePORTER, and PubMed
# --------------------------------------------------------------------------------------------------

ROMAN = {"i": "1", "ii": "2", "iii": "3", "iv": "4"}
UMBRELLA_TERMS = {"rasopathy"}
BROAD_TERM_RE = re.compile(r"\bmetabol(?:ism|ic)\b|\btoxicity\b", re.I)
# Two-letter acronyms are ambiguous across fields, e.g. "HL deficiency" is also hepatic lipase deficiency.
AMBIGUOUS_ACRONYM_RE = re.compile(r"^[A-Za-z]{1,2}\s+(?:deficiency|syndrome|disease)$", re.I)


def compact(text: str) -> str:
    text = re.sub(r"\btype\s+(iv|iii|ii|i)\b", lambda m: ROMAN[m.group(1)], text.casefold())
    return re.sub(r"[^a-z0-9]", "", text.replace("type", ""))


def abbreviations(disease: dict) -> list[str]:
    """Short uppercase synonyms (e.g. NF1) used only to confirm a match, never as search terms."""
    return [s for s in disease.get("synonyms") or [] if re.fullmatch(r"[A-Z][A-Z0-9]{2,5}", s) and len(compact(s)) <= 3]


def search_terms(disease: dict) -> list[str]:
    """Name plus synonyms specific enough to search on."""
    terms: list[str] = []
    for term in [disease.get("name") or "", *(disease.get("synonyms") or [])]:
        term = term.replace('"', "").strip()
        key = compact(term)
        if (
            len(key) <= 3
            or term.casefold() in UMBRELLA_TERMS
            or BROAD_TERM_RE.search(term)
            or AMBIGUOUS_ACRONYM_RE.match(term)
        ):
            continue
        if key not in {compact(t) for t in terms}:
            terms.append(term)
    return terms


def phrase_terms(disease: dict) -> list[str]:
    """Search terms plus 'X type N' variants, for services that match exact phrases."""
    terms = search_terms(disease)
    for term in list(terms):
        match = re.fullmatch(r"(.*\D)\s+(\d)", term)
        if match and "type" not in term.casefold():
            terms.append(f"{match.group(1)} type {match.group(2)}")
    return terms


# --------------------------------------------------------------------------------------------------
# Stage 1: NORD
# --------------------------------------------------------------------------------------------------

NORD_LIST_URL = "https://rarediseases.org/rare-diseases/?starts_with=Showing+all+diseases"
NORD_LETTER_URL = "https://rarediseases.org/rare-diseases/?starts_with={letter}"
NORD_PAGE_SIZE = 50
DATA_MARKER = "var predictiveSearchData = "
SCRIPT_RE = re.compile(r"<script\b[^>]*>.*?</script>", re.IGNORECASE | re.DOTALL)
TRAILING_STAR_RE = re.compile(r"\s*\*$")
NUMBER_RE = re.compile(r"(\d+)")
OMIM_RE = re.compile(r"https?://(?:www\.)?omim\.org/entry/(\d+)", re.IGNORECASE)
ORPHA_RE = re.compile(r"https?://(?:www\.)?orpha\.net/en/disease/detail/(\d+)", re.IGNORECASE)
GARD_RE = re.compile(r"https?://rarediseases\.info\.nih\.gov/diseases/(\d+)", re.IGNORECASE)


def fold(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn").casefold()


def listing_sort_key(title: str) -> tuple:
    """Match the site's localeCompare(..., { numeric: true, sensitivity: 'base' })."""
    key: list[tuple[int, int | str]] = []
    for part in NUMBER_RE.split(fold(title)):
        if part:
            key.append((0, int(part)) if part.isdigit() else (1, part))
    return tuple(key)


class Nord:
    def __init__(self, delay: float, attempts: int):
        self.session = requests.Session(impersonate="chrome")
        self.delay = delay
        self.attempts = attempts
        self._catalogs: dict[str, list[dict]] = {}

    def fetch(self, url: str) -> str:
        last_error = "no response"
        headers = {**REQUEST_HEADERS, "Accept": "text/html,application/xhtml+xml"}
        for attempt in range(1, self.attempts + 1):
            try:
                response = self.session.get(url, headers=headers, timeout=90)
                if response.status_code == 200 and response.text:
                    if self.delay:
                        time.sleep(self.delay)
                    return response.text
                last_error = f"HTTP {response.status_code}"
            except Exception as exc:  # noqa: BLE001 — retry network failures
                last_error = str(exc)
            if attempt < self.attempts:
                time.sleep(min(8, 2 ** (attempt - 1)))
        raise RuntimeError(f"{url} failed after {self.attempts} tries: {last_error}")

    def catalog(self, url: str = NORD_LIST_URL) -> list[dict]:
        if url not in self._catalogs:
            html = self.fetch(url)
            start = html.find(DATA_MARKER)
            if start < 0:
                raise RuntimeError(f"{url} did not include the disease catalog.")
            payload, _ = json.JSONDecoder().raw_decode(html[start + len(DATA_MARKER) :])
            rows = payload.get("data") or []
            rows.sort(key=lambda row: listing_sort_key(row.get("title") or ""))
            self._catalogs[url] = rows
        return self._catalogs[url]

    def identifiers(self, url: str) -> dict[str, str | None]:
        body = SCRIPT_RE.sub(" ", self.fetch(url))

        def first(pattern: re.Pattern[str]) -> str | None:
            match = pattern.search(body)
            return match.group(1) if match else None

        return {"omim": first(OMIM_RE), "orphanet": first(ORPHA_RE), "gard": first(GARD_RE)}


def nord_links(row: dict, ids: dict[str, str | None]) -> dict:
    post_type = row.get("post_type") or ""
    nord_id = str(row.get("id"))
    omim_id, orpha_id = ids["omim"], ids["orphanet"]
    return {
        "nord": {
            "wordpressId": nord_id,
            "postType": post_type,
            "url": row.get("permalink"),
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
    }


def name_fields(row: dict) -> dict:
    raw = (row.get("title") or "").strip()
    return {
        "name": TRAILING_STAR_RE.sub("", raw).strip(),
        "nordReport": row.get("post_type") == "rare-diseases" or raw.endswith("*"),
        "synonyms": row.get("synonyms") or [],
    }


def listing_record(nord: Nord, row: dict, page: int) -> dict:
    ids = nord.identifiers(row["permalink"])
    links = nord_links(row, ids)
    gard = ids["gard"]
    return {
        **name_fields(row),
        "listingPage": page,
        "nord": links["nord"],
        "omim": links["omim"],
        "orphanet": links["orphanet"],
        "gard": None if not gard else {"id": gard, "url": f"https://rarediseases.info.nih.gov/diseases/{gard}/x"},
    }


def lookup_key(text: str) -> str:
    return compact(re.sub(r"\(.*?\)", " ", TRAILING_STAR_RE.sub("", text)))


def find_in_catalog(rows: list[dict], query: str) -> dict | None:
    """Exact title match first, then synonym match; NORD reports win over MONDO stubs."""
    want = lookup_key(query)
    by_title = [r for r in rows if lookup_key(r.get("title") or "") == want]
    by_synonym = [r for r in rows if any(lookup_key(s) == want for s in r.get("synonyms") or [])]
    for pool in (by_title, by_synonym):
        if pool:
            pool.sort(key=lambda r: (r.get("post_type") != "rare-diseases", len(r.get("title") or "")))
            return pool[0]
    return None


def lookup_record(nord: Nord, query: str) -> dict:
    letter = query.strip()[:1].upper()
    search_url = NORD_LETTER_URL.format(letter=urllib.parse.quote(letter))
    row = find_in_catalog(nord.catalog(search_url), query) or find_in_catalog(nord.catalog(), query)
    if row is None:
        raise SystemExit(f"NORD has no disease matching {query!r} on {search_url}.")
    links = nord_links(row, nord.identifiers(row["permalink"]))
    return {**name_fields(row), **links, "query": query, "searchUrl": search_url}


def stage_nord(document: dict, args, existing: dict[str, dict]) -> None:
    nord = Nord(args.delay, args.attempts)
    diseases: list[dict] = []
    if args.pages:
        start_page, end_page = args.pages
        catalog = nord.catalog()
        total_pages = (len(catalog) + NORD_PAGE_SIZE - 1) // NORD_PAGE_SIZE
        if start_page > total_pages:
            raise SystemExit(f"Page {start_page} is past the last NORD page ({total_pages}).")
        rows = catalog[(start_page - 1) * NORD_PAGE_SIZE : end_page * NORD_PAGE_SIZE]
        if args.limit:
            rows = rows[: args.limit]
        print(f"[nord] catalog has {len(catalog)} diseases; fetching {len(rows)} from pages {start_page}-{end_page}", flush=True)
        for offset, row in enumerate(rows):
            page = start_page + offset // NORD_PAGE_SIZE
            record = existing.get(row.get("permalink")) or listing_record(nord, row, page)
            diseases.append(record)
            print(f"[nord] {record['name']}  OMIM {(record['omim'] or {}).get('id', '-')}  Orphanet {(record['orphanet'] or {}).get('id', '-')}", flush=True)
    for query in args.names or []:
        reused = next((d for d in existing.values() if d.get("query") == query), None)
        record = reused or lookup_record(nord, query)
        diseases.append(record)
        print(f"[nord] {query!r} -> {record['name']}  OMIM {(record['omim'] or {}).get('id', '-')}", flush=True)
    document["diseases"] = diseases


# --------------------------------------------------------------------------------------------------
# OMIM helpers (stages 2-4)
# --------------------------------------------------------------------------------------------------

OMIM_BASE = "https://api.omim.org/api"


def omim_url(path: str, params: dict, api_key: str) -> str:
    return f"{OMIM_BASE}/{path}?" + urllib.parse.urlencode({**params, "format": "json", "apiKey": api_key})


def fetch_entry(ctx, mim: str, include: str) -> tuple[int, dict | None]:
    response = call_url(ctx.session, ctx.omim, omim_url("entry", {"mimNumber": mim, "include": include}, ctx.key), ctx.headers, "application/json")
    if response.status_code != 200:
        return response.status_code, None
    try:
        entries = ((response.json().get("omim") or {}).get("entryList")) or []
    except ValueError:
        return response.status_code, None
    if not entries:
        return response.status_code, None
    return response.status_code, nested(entries[0], "entry")


def text_sections(entry: dict, wanted) -> list[tuple[str, str]]:
    sections = []
    for item in entry.get("textSectionList") or []:
        section = nested(item, "textSection")
        if section.get("textSectionName") in wanted:
            sections.append((section["textSectionName"], section.get("textSectionContent") or ""))
    return sections


# --------------------------------------------------------------------------------------------------
# Stage 2: omimSections
# --------------------------------------------------------------------------------------------------

SECTIONS = [
    "clinicalFeatures",
    "clinicalManagement",
    "cytogenetics",
    "evolution",
    "geneFamily",
    "geneFunction",
    "geneStructure",
    "geneTherapy",
    "geneticVariability",
    "genotype",
    "genotypePhenotypeCorrelations",
    "history",
    "inheritance",
    "mapping",
]


def section_include(names: list[str]) -> str:
    return "geneMap," + ",".join(f"text:{name}" for name in names) if names else "geneMap"


def omim_sections(ctx, disease: dict) -> dict:
    mim = str((disease.get("omim") or {}).get("id") or "")
    url = omim_url("entry", {"mimNumber": mim, "include": section_include(SECTIONS)}, ctx.key)
    response = call_url(ctx.session, ctx.omim, url, ctx.headers, "application/json")
    result = {"diseaseMim": mim, "httpStatus": response.status_code, "retrievedAt": now(), "sectionSources": {}}
    for name in SECTIONS:
        result[name] = None
    if response.status_code != 200:
        result["detail"] = plain_text(response.text)[:240]
        return result
    status, entry = fetch_entry_from(response)
    if entry is None:
        result["detail"] = "OMIM JSON did not contain an entry."
        return result
    moved_to = str(entry.get("movedTo") or "")
    if moved_to and moved_to != mim:
        result["movedTo"] = moved_to
        status, moved_entry = fetch_entry(ctx, moved_to, section_include(SECTIONS))
        if moved_entry is not None:
            entry, mim = moved_entry, moved_to
            result["httpStatus"] = status

    def fill(source: dict, source_mim: str) -> None:
        for name, text in text_sections(source, SECTIONS):
            text = plain_text(text)
            if text and result[name] is None:
                result[name] = text
                result["sectionSources"][name] = source_mim

    fill(entry, str(entry.get("mimNumber") or mim))
    gene_mims = []
    for item in entry.get("phenotypeMapList") or []:
        gene_mim = str(nested(item, "phenotypeMap").get("mimNumber") or "")
        if gene_mim and gene_mim != mim and gene_mim not in gene_mims:
            gene_mims.append(gene_mim)
    for gene_mim in gene_mims:
        missing = [name for name in SECTIONS if result[name] is None]
        if not missing:
            break
        _, gene_entry = fetch_entry(ctx, gene_mim, section_include(missing))
        if gene_entry is not None:
            fill(gene_entry, gene_mim)
    result["detail"] = None
    return result


def fetch_entry_from(response) -> tuple[int, dict | None]:
    try:
        entries = ((response.json().get("omim") or {}).get("entryList")) or []
    except ValueError:
        return response.status_code, None
    return response.status_code, nested(entries[0], "entry") if entries else None


def stage_omim_sections(ctx, document: dict, write) -> None:
    for disease in document["diseases"]:
        if not (disease.get("omim") or {}).get("id"):
            continue
        if ctx.resume and "omimSections" in disease:
            continue
        disease["omimSections"] = omim_sections(ctx, disease)
        present = [n for n in SECTIONS if disease["omimSections"].get(n)]
        print(f"[omimSections] {disease['name']}: {len(present)} sections", flush=True)
        write()


# --------------------------------------------------------------------------------------------------
# Stage 3: geneVariantMechanism
# --------------------------------------------------------------------------------------------------

DISEASE_SECTIONS = ("molecularGenetics", "pathogenesis", "description", "inheritance")
GENE_SECTIONS = ("molecularGenetics", "geneFunction", "animalModel")
TEXT_GENE_SECTIONS = ("molecularGenetics", "cytogenetics")
MECHANISMS = (
    ("dominant negative", re.compile(r"dominant[- ]negative", re.I)),
    ("haploinsufficiency", re.compile(r"haploinsufficien", re.I)),
    (
        "gain of function",
        re.compile(
            r"gain[- ]of[- ]function|\bactivating (?:mutation|variant|lesion)|constitutive(?:ly)? activ|hyperactiv|enhanced (?:\w+ )?activity",
            re.I,
        ),
    ),
    (
        "loss of function",
        re.compile(
            r"loss[- ]of[- ]function|\binactivat|tumor suppressor|\bnull (?:allele|mutation)|abolish|\btruncating|loss of (?:enzyme |\w+ )?activity|deficien(?:t|cy) (?:of|in) (?:the )?enzyme|absent (?:enzyme )?activity",
            re.I,
        ),
    ),
)
OTHER_DISORDER_RE = re.compile(r"\{(\d{6})\}")
BIALLELIC_RE = re.compile(r"\bhomozygous\b|compound heterozygous", re.I)
TEXT_GENE_RE = re.compile(r"\b([A-Z][A-Z0-9-]{1,11}) gene \(\{(\d{6})[}.]")
DENIAL_RE = re.compile(
    r"\b(?:does|do|did|is|was|are|were) not (?:cause|result|lead|account|sufficient)|\bno evidence\b|\bnot sufficient\b",
    re.I,
)


def denies(sentence: str) -> bool:
    return is_negated(sentence) or DENIAL_RE.search(sentence) is not None


def causal_genes(entry: dict) -> list[dict]:
    genes = []
    for item in entry.get("phenotypeMapList") or []:
        row = nested(item, "phenotypeMap")
        symbols = [p.strip() for p in str(row.get("approvedGeneSymbols") or row.get("geneSymbols") or "").split(",") if p.strip()]
        if not symbols:
            continue
        genes.append(
            {
                "symbol": symbols[0],
                "aliases": symbols[1:],
                "mimNumber": str(row.get("mimNumber") or "") or None,
                "cytoLocation": row.get("cytoLocation") or row.get("computedCytoLocation"),
                "inheritance": row.get("phenotypeInheritance"),
                "mappingKey": row.get("phenotypeMappingKey"),
            }
        )
    genes.sort(key=lambda gene: gene.get("mappingKey") != 3)
    return genes


def text_gene(entry: dict) -> dict | None:
    """Fall back to the gene the disease text cites most, e.g. 'HDAC4 gene ({605314})'."""
    for name, text in text_sections(entry, TEXT_GENE_SECTIONS):
        counts = Counter(TEXT_GENE_RE.findall(text))
        if counts:
            symbol, mim = counts.most_common(1)[0][0]
            inheritance = None
            for item in (entry.get("geneMap") or {}).get("phenotypeMapList") or []:
                inheritance = inheritance or nested(item, "phenotypeMap").get("phenotypeInheritance")
            return {
                "symbol": symbol,
                "aliases": [],
                "mimNumber": mim,
                "cytoLocation": None,
                "inheritance": inheritance,
                "mappingKey": None,
                "source": f"named in OMIM {name} text",
            }
    return None


def disease_terms(disease: dict, entry: dict) -> tuple[list[str], list[str]]:
    """Return (long names matched case-insensitively, abbreviations matched exactly)."""
    titles = entry.get("titles") or {}
    raw = [disease.get("name") or "", *(disease.get("synonyms") or [])]
    for key in ("preferredTitle", "alternativeTitles"):
        raw += re.split(r"[;\n]", titles.get(key) or "")
    names, abbrevs = set(), set()
    for term in raw:
        term = re.sub(r"\(.*?\)", "", term).strip(" ,")
        if not term:
            continue
        if len(term) <= 6 and term.upper() == term:
            abbrevs.add(term)
            abbrevs.add(re.sub(r"\d+$", "", term))
        else:
            names.add(re.sub(r"[, ]+(?:type )?\d+$", "", term, flags=re.I).casefold())
    return sorted(n for n in names if len(n) > 6), sorted(a for a in abbrevs if len(a) >= 2)


def names_disease(sentence: str, mim: str, terms: tuple[list[str], list[str]]) -> bool:
    names, abbrevs = terms
    folded = sentence.casefold()
    return mim in sentence or any(n in folded for n in names) or any(re.search(rf"\b{re.escape(a)}\b", sentence) for a in abbrevs)


def cites_other_disorder(sentence: str, allowed: set[str]) -> bool:
    return any(mim not in allowed for mim in OTHER_DISORDER_RE.findall(sentence))


def usable_sentences(text: str, symbols: list[str], allowed: set[str]) -> list[str]:
    return [
        s
        for s in sentences_of(text)
        if any(mentions(s, symbol) for symbol in symbols) and not denies(s) and not cites_other_disorder(s, allowed)
    ]


def classify(evidence: list[tuple[str, str, str, int]]) -> tuple[str | None, list[dict]]:
    """Vote over (sentence, section, mim, weight); return the label and its strongest quotes."""
    votes: dict[str, float] = {}
    quotes: dict[str, list[tuple[int, dict]]] = {}
    for sentence, section, mim, weight in evidence:
        for label, pattern in MECHANISMS:
            if pattern.search(sentence):
                votes[label] = votes.get(label, 0) + weight
                quotes.setdefault(label, []).append((weight, {"quote": sentence[:500], "section": section, "mimNumber": mim}))
                break
    if not votes:
        return None, []
    label = max(votes, key=lambda key: votes[key])
    ranked = sorted(quotes[label], key=lambda item: -item[0])
    return label, [quote for _, quote in ranked[:2]]


def gene_name(entry: dict | None) -> str | None:
    title = ((entry or {}).get("titles") or {}).get("preferredTitle") or ""
    return title.split(";")[0].strip().title() if title else None


def gene_variant_mechanism(ctx, disease: dict) -> dict:
    mim = str((disease.get("omim") or {}).get("id") or "")
    result = {
        "sourceMim": mim or None,
        "gene": None,
        "otherGenes": [],
        "mechanism": None,
        "basis": None,
        "evidence": [],
        "detail": None,
        "retrievedAt": now(),
    }
    if not mim:
        result["detail"] = "No OMIM entry on this record, so the OMIM API cannot name a gene. Orphanet requires an API token."
        return result

    include = "geneMap," + ",".join(f"text:{name}" for name in dict.fromkeys(DISEASE_SECTIONS + TEXT_GENE_SECTIONS))
    status, entry = fetch_entry(ctx, mim, include)
    if entry and entry.get("movedTo") and str(entry["movedTo"]) != mim:
        mim = str(entry["movedTo"])
        result["sourceMim"] = mim
        status, entry = fetch_entry(ctx, mim, include)
    if entry is None:
        result["detail"] = f"OMIM API returned HTTP {status}."
        return result
    if entry.get("prefix") == "%":
        result["detail"] = "OMIM marks this entry '%': the phenotype is described but its molecular basis is unknown."
        return result

    genes = causal_genes(entry)
    for gene in genes:
        gene["source"] = "OMIM phenotype map"
    if not genes:
        found = text_gene(entry)
        if found is None:
            result["detail"] = "OMIM does not link this disorder to a gene in its phenotype map or text."
            return result
        genes = [found]
    gene = genes[0]
    result["otherGenes"] = [g["symbol"] for g in genes[1:]]
    symbols = [gene["symbol"], *gene["aliases"]]
    allowed = {mim, gene["mimNumber"] or ""}
    terms = disease_terms(disease, entry)
    lowered = {s.casefold() for s in symbols}

    evidence: list[tuple[str, str, str, int]] = []
    for name, text in text_sections(entry, DISEASE_SECTIONS):
        evidence += [(s, name, mim, 3) for s in usable_sentences(text, symbols, allowed)]
        if len(genes) == 1:
            for sentence in sentences_of(text):
                if any(mentions(sentence, symbol) for symbol in symbols):
                    continue
                if denies(sentence) or cites_other_disorder(sentence, allowed) or names_other_gene(sentence, lowered):
                    continue
                evidence.append((sentence, name, mim, 2))

    gene_entry = None
    if gene["mimNumber"]:
        gene_include = "geneMap,allelicVariantList," + ",".join(f"text:{name}" for name in GENE_SECTIONS)
        _, gene_entry = fetch_entry(ctx, gene["mimNumber"], gene_include)
    if gene_entry:
        gene["cytoLocation"] = gene["cytoLocation"] or (gene_entry.get("geneMap") or {}).get("cytoLocation")
        for name, text in text_sections(gene_entry, GENE_SECTIONS):
            evidence += [(s, name, gene["mimNumber"], 1) for s in usable_sentences(text, symbols, allowed) if names_disease(s, mim, terms)]
        for item in gene_entry.get("allelicVariantList") or []:
            variant = nested(item, "allelicVariant")
            text = plain_text(variant.get("text") or "")
            if not names_disease(text, mim, terms):
                continue
            for sentence in sentences_of(text):
                if not denies(sentence) and not cites_other_disorder(sentence, allowed):
                    evidence.append((sentence, f"allelicVariant {gene['mimNumber']}.{variant.get('number')}", gene["mimNumber"], 1))

    result["gene"] = {**gene, "name": gene_name(gene_entry)}
    label, quotes = classify(evidence)
    if label:
        result.update(mechanism=label, basis="stated in OMIM text", evidence=quotes)
        return result
    biallelic = [s for s, *_ in evidence if BIALLELIC_RE.search(s)]
    if "recessive" in (gene.get("inheritance") or "").casefold() and biallelic:
        result.update(
            mechanism="loss of function",
            basis="inferred from autosomal recessive inheritance with biallelic variants",
            evidence=[{"quote": biallelic[0][:500], "section": "molecularGenetics", "mimNumber": mim}],
        )
        return result
    result["detail"] = "OMIM names the gene but its text does not state how the variants act."
    return result


def stage_gene_mechanism(ctx, document: dict, write) -> None:
    for disease in document["diseases"]:
        if ctx.resume and "geneVariantMechanism" in disease:
            continue
        result = gene_variant_mechanism(ctx, disease)
        disease["geneVariantMechanism"] = result
        print(f"[geneVariantMechanism] {disease['name']}: {(result.get('gene') or {}).get('symbol') or '-'} | {result.get('mechanism') or result.get('detail')}", flush=True)
        write()


# --------------------------------------------------------------------------------------------------
# Stage 4: hpoGenePatterns
# --------------------------------------------------------------------------------------------------

HPO_SEARCH = "https://clinicaltables.nlm.nih.gov/api/hpo/v3/search"
HPO_ID_RE = re.compile(r"\{HPO (HP:\d{7})\}")
SKIP_FIELDS = {
    "inheritance",
    "molecularBasis",
    "miscellaneous",
    "contributors",
    "creationDate",
    "editHistory",
    "epochCreated",
    "dateCreated",
    "epochUpdated",
    "dateUpdated",
    "preferredTitle",
    "prefix",
    "mimNumber",
    "oldFormat",
}
SYSTEMS = (
    ("growth", "Growth"),
    ("headAndNeck", "Head and neck"),
    ("cardiovascular", "Cardiovascular"),
    ("respiratory", "Respiratory"),
    ("chest", "Chest"),
    ("abdomen", "Abdomen"),
    ("genitourinary", "Genitourinary"),
    ("skeletal", "Skeletal"),
    ("skinNailsHair", "Skin, nails, hair"),
    ("muscleSoftTissue", "Muscle and soft tissue"),
    ("neurologic", "Neurologic"),
    ("voice", "Voice"),
    ("metabolicFeatures", "Metabolic"),
    ("endocrineFeatures", "Endocrine"),
    ("hematology", "Hematology"),
    ("immunology", "Immunology"),
    ("neoplasia", "Neoplasia"),
    ("prenatalManifestations", "Prenatal"),
    ("laboratoryAbnormalities", "Laboratory"),
)
STOPWORDS = {"of", "the", "and", "in", "with", "a", "an", "to", "or", "at", "on", "by", "for"}
MAX_LISTED = 40


class Hpo:
    """Cached lookups against the NLM Clinical Tables HPO API."""

    def __init__(self, session, headers: dict):
        self.session = session
        self.headers = headers
        self.limiter = RateLimiter(min_interval=0.35)
        self.terms: dict[str, dict] = {}
        self.matches: dict[str, str | None] = {}

    def _search(self, params: dict) -> list:
        response = call_url(self.session, self.limiter, f"{HPO_SEARCH}?" + urllib.parse.urlencode(params), self.headers, "application/json")
        return response.json() if response.status_code == 200 else [0, [], None, []]

    def load(self, ids: set[str]) -> None:
        missing = sorted(i for i in ids if i not in self.terms)
        for start in range(0, len(missing), 100):
            batch = missing[start : start + 100]
            query = "id:(" + " OR ".join(f'"{i}"' for i in batch) + ")"
            _, codes, extra, display = self._search({"terms": "", "q": query, "df": "id,name", "ef": "is_a,definition", "maxList": 500})[:4]
            extra = extra or {}
            parents = extra.get("is_a") or [[] for _ in codes]
            definitions = extra.get("definition") or [None for _ in codes]
            for code, shown, parent, definition in zip(codes, display, parents, definitions):
                self.terms[code] = {"id": code, "name": shown[1] if len(shown) > 1 else code, "definition": definition or None, "parents": parent or []}
            for code in batch:
                self.terms.setdefault(code, {"id": code, "name": code, "definition": None, "parents": []})

    def match(self, text: str) -> str | None:
        """Map free text to an HPO ID when the top hit shares most of its words."""
        key = text.casefold()
        if key not in self.matches:
            cleaned = re.sub(r"\(.*?\)", "", text).strip()
            result = self._search({"terms": cleaned, "df": "id,name", "maxList": 1})
            codes, display = result[1], result[3]
            hit = None
            if codes:
                a, b = words(cleaned), words(display[0][1])
                if a and b and len(a & b) / len(a | b) >= 0.5:
                    hit = codes[0]
            self.matches[key] = hit
        return self.matches[key]

    def describe(self, code: str) -> dict:
        term = self.terms.get(code, {})
        return {"id": code, "name": term.get("name", code), "definition": term.get("definition")}


def words(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", text.casefold()) if w not in STOPWORDS}


def omim_get(ctx, path: str, params: dict) -> dict | None:
    response = call_url(ctx.session, ctx.omim, omim_url(path, params, ctx.key), ctx.headers, "application/json")
    if response.status_code != 200:
        return None
    try:
        return response.json().get("omim") or {}
    except ValueError:
        return None


def entries_of(block: dict) -> list[dict]:
    return [nested(item, "entry") for item in block.get("entryList") or []]


def series_entries(ctx, mim: str) -> tuple[str | None, list[dict]]:
    """Return (phenotypic series number, entries) for the disease, or (None, [disease entry])."""
    entries = entries_of(omim_get(ctx, "entry", {"mimNumber": mim, "include": "geneMap,clinicalSynopsis"}) or {})
    if not entries:
        return None, []
    entry = entries[0]
    series = None
    for item in entry.get("phenotypeMapList") or []:
        series = series or nested(item, "phenotypeMap").get("phenotypicSeriesNumber")
    if not series:
        return None, [entry]
    series = series.split(",")[0].strip()
    found = omim_get(ctx, "entry/search", {"search": f"phenotypic_series_number:{series}", "include": "geneMap,clinicalSynopsis", "limit": 100})
    return series, entries_of((found or {}).get("searchResponse") or {}) or [entry]


def genes_of(entry: dict, series: str | None) -> list[str]:
    genes = []
    for item in entry.get("phenotypeMapList") or []:
        row = nested(item, "phenotypeMap")
        if series and row.get("phenotypicSeriesNumber") and series not in row["phenotypicSeriesNumber"]:
            continue
        if row.get("phenotypeMappingKey") not in (None, 3):
            continue
        symbol = (row.get("approvedGeneSymbols") or row.get("geneSymbols") or "").split(",")[0].strip()
        if symbol and symbol not in genes:
            genes.append(symbol)
    return genes


def system_of(field: str) -> str:
    return next((label for prefix, label in SYSTEMS if field.startswith(prefix)), field)


def synopsis_features(entry: dict) -> list[dict]:
    features = []
    for field, value in (entry.get("clinicalSynopsis") or {}).items():
        if field in SKIP_FIELDS or field.endswith("Exists") or not isinstance(value, str):
            continue
        for line in re.split(r";\n", value):
            text = re.sub(r"\s*\{[^}]*\}", "", line).strip()
            if text:
                features.append({"text": text, "hpo": HPO_ID_RE.findall(line), "system": system_of(field)})
    return features


def add_features(profile: dict, features: list[dict], hpo: Hpo) -> int:
    unmatched = 0
    for feature in features:
        ids = feature["hpo"] or ([m] if (m := hpo.match(feature["text"])) else [])
        if not ids:
            unmatched += 1
        profile["systems"].add(feature["system"])
        for code in ids:
            profile["terms"].setdefault(code, feature["system"])
    return unmatched


def gene_profiles(members: list[dict], series: str | None, hpo: Hpo) -> tuple[dict, list[dict], int]:
    profiles: dict[str, dict] = {}
    subtypes = []
    unmatched = 0
    for entry in members:
        genes = genes_of(entry, series)
        features = synopsis_features(entry)
        title = ((entry.get("titles") or {}).get("preferredTitle") or "").split(";")[0].strip()
        subtypes.append({"mimNumber": str(entry.get("mimNumber")), "title": title, "genes": genes, "featureCount": len(features)})
        for gene in genes:
            profile = profiles.setdefault(gene, {"phenotypeMims": [], "terms": {}, "systems": set()})
            profile["phenotypeMims"].append(str(entry.get("mimNumber")))
            unmatched += add_features(profile, features, hpo)
    return profiles, subtypes, unmatched


def shared(counter: dict[str, set[str]], gene_count: int, label) -> list[dict]:
    rows = [
        {**label(key), "genes": sorted(genes), "geneCount": len(genes), "fraction": round(len(genes) / gene_count, 2)}
        for key, genes in counter.items()
        if len(genes) >= 2
    ]
    rows.sort(key=lambda row: (-row["geneCount"], row.get("name") or row.get("system")))
    return rows


def patterns(profiles: dict[str, dict], hpo: Hpo) -> dict:
    hpo.load({code for p in profiles.values() for code in p["terms"]})
    by_term: dict[str, set[str]] = {}
    by_parent: dict[str, set[str]] = {}
    by_system: dict[str, set[str]] = {}
    parent_names: dict[str, str] = {}
    term_system: dict[str, str] = {}
    for gene, profile in profiles.items():
        for code, system in profile["terms"].items():
            by_term.setdefault(code, set()).add(gene)
            term_system.setdefault(code, system)
            for parent in hpo.terms.get(code, {}).get("parents", []):
                by_parent.setdefault(parent["id"], set()).add(gene)
                parent_names[parent["id"]] = parent["name"]
        for system in profile["systems"]:
            by_system.setdefault(system, set()).add(gene)
    n = len(profiles)
    terms = shared(by_term, n, lambda c: {**hpo.describe(c), "system": term_system[c]})
    return {
        "coreTerms": [hpo.describe(r["id"]) for r in terms if r["geneCount"] == n],
        "sharedTerms": terms[:MAX_LISTED],
        "sharedTermCount": len(terms),
        "sharedParentTerms": shared(by_parent, n, lambda c: {"id": c, "name": parent_names[c]})[:MAX_LISTED],
        "sharedSystems": shared(by_system, n, lambda s: {"system": s}),
    }


def hpo_gene_patterns(ctx, disease: dict) -> tuple[dict, dict]:
    mechanism = disease.get("geneVariantMechanism") or {}
    result = {"sourceMim": mechanism.get("sourceMim"), "phenotypicSeries": None, "retrievedAt": now()}
    gene = (mechanism.get("gene") or {}).get("symbol")
    if not gene or not mechanism.get("sourceMim"):
        result["detail"] = "No known associated gene, so there is nothing to compare."
        return result, {}
    series, members = series_entries(ctx, mechanism["sourceMim"])
    if not members:
        result["detail"] = "OMIM API did not return the disease entry."
        return result, {}
    profiles, subtypes, unmatched = gene_profiles(members, series, ctx.hpo)
    if gene not in profiles:
        profiles[gene] = {"phenotypeMims": [str(members[0].get("mimNumber"))], "terms": {}, "systems": set()}
        add_features(profiles[gene], synopsis_features(members[0]), ctx.hpo)
    profiles = {g: p for g, p in profiles.items() if p["terms"]}
    ctx.hpo.load({code for p in profiles.values() for code in p["terms"]})
    result["phenotypicSeries"] = series
    result["subtypes"] = subtypes
    result["genes"] = {
        g: {"phenotypeMims": p["phenotypeMims"], "hpoTermCount": len(p["terms"]), "hpoTerms": [ctx.hpo.describe(c) for c in sorted(p["terms"])]}
        for g, p in sorted(profiles.items())
    }
    result["unmatchedFeatureCount"] = unmatched
    if len(profiles) < 2:
        only = next(iter(profiles), gene)
        result["detail"] = f"OMIM associates this disease with one gene ({only}), so no cross-gene pattern exists; its HPO profile is listed under genes."
        return result, profiles
    result.update(patterns(profiles, ctx.hpo))
    result["detail"] = (
        f"{len(profiles)} genes compared. coreTerms appear in every gene's synopsis; sharedTerms, sharedParentTerms "
        "(one HPO level up) and sharedSystems appear in at least two."
    )
    return result, profiles


def stage_hpo(ctx, document: dict, write) -> None:
    diseases = document["diseases"]
    if ctx.resume and "crossDiseaseGenePatterns" in document and all("hpoGenePatterns" in d for d in diseases):
        return
    all_profiles: dict[str, dict] = {}
    for disease in diseases:
        result, profiles = hpo_gene_patterns(ctx, disease)
        disease["hpoGenePatterns"] = result
        for gene, profile in profiles.items():
            merged = all_profiles.setdefault(gene, {"phenotypeMims": [], "terms": {}, "systems": set()})
            merged["phenotypeMims"] += [m for m in profile["phenotypeMims"] if m not in merged["phenotypeMims"]]
            for code, system in profile["terms"].items():
                merged["terms"].setdefault(code, system)
            merged["systems"] |= profile["systems"]
        print(f"[hpoGenePatterns] {disease['name']}: {len(result.get('genes') or {})} genes, {len(result.get('coreTerms') or [])} core terms", flush=True)
        write()
    if len(all_profiles) >= 2:
        cross = {"genes": sorted(all_profiles), **patterns(all_profiles, ctx.hpo), "detail": "Every gene found above, compared across diseases using the same HPO terms."}
    else:
        cross = {
            "genes": sorted(all_profiles),
            "coreTerms": [],
            "sharedTerms": [],
            "sharedTermCount": 0,
            "sharedParentTerms": [],
            "sharedSystems": [],
            "detail": "Fewer than two genes with HPO profiles in this file, so there is nothing to compare across diseases.",
        }
    document["crossDiseaseGenePatterns"] = cross
    write()


# --------------------------------------------------------------------------------------------------
# Stage 5: clinicalTrials
# --------------------------------------------------------------------------------------------------

CT_API = "https://clinicaltrials.gov/api/v2/studies"
CT_FIELDS = "NCTId,BriefTitle,OverallStatus,StudyType,Phase,Condition,Keyword,LeadSponsorName,StartDate,PrimaryCompletionDate,CompletionDate,EnrollmentCount"
COMPLETED = {"COMPLETED"}
ONGOING = {"RECRUITING", "NOT_YET_RECRUITING", "ACTIVE_NOT_RECRUITING", "ENROLLING_BY_INVITATION"}


def get_json(session, limiter: RateLimiter, url: str, headers: dict, params: dict, label: str, attempts: int = 4) -> dict:
    for attempt in range(1, attempts + 1):
        limiter.wait()
        response = session.get(url, params=params, headers={**headers, "Accept": "application/json"}, timeout=60)
        if response.status_code == 200:
            return response.json()
        if response.status_code in (429, 500, 502, 503, 504) and attempt < attempts:
            limiter.cooldown(retry_delay(dict(response.headers), attempt))
            continue
        raise RuntimeError(f"{label} returned HTTP {response.status_code}: {response.text[:200]}")
    raise RuntimeError(f"{label} request failed")


def study_record(study: dict, terms: list[str], abbrevs: list[str]) -> dict:
    section = study.get("protocolSection") or {}
    ident = section.get("identificationModule") or {}
    status = section.get("statusModule") or {}
    design = section.get("designModule") or {}
    conditions = (section.get("conditionsModule") or {}).get("conditions") or []
    keywords = (section.get("conditionsModule") or {}).get("keywords") or []
    raw = " ".join([ident.get("briefTitle") or "", *conditions, *keywords])
    haystack = compact(raw)
    matched = [t for t in terms if compact(t) in haystack] + [a for a in abbrevs if re.search(rf"\b{re.escape(a)}\b", raw)]
    nct = ident.get("nctId")
    return {
        "nctId": nct,
        "title": ident.get("briefTitle"),
        "status": status.get("overallStatus"),
        "studyType": design.get("studyType"),
        "phases": design.get("phases") or [],
        "conditions": conditions,
        "leadSponsor": ((section.get("sponsorCollaboratorsModule") or {}).get("leadSponsor") or {}).get("name"),
        "startDate": (status.get("startDateStruct") or {}).get("date"),
        "primaryCompletionDate": (status.get("primaryCompletionDateStruct") or {}).get("date"),
        "completionDate": (status.get("completionDateStruct") or {}).get("date"),
        "enrollment": (design.get("enrollmentInfo") or {}).get("count"),
        "matchedTerms": matched,
        "matchType": "named in conditions, title, or keywords" if matched else "ClinicalTrials.gov synonym expansion",
        "url": f"https://clinicaltrials.gov/study/{nct}",
    }


def clinical_trials(ctx, disease: dict) -> dict:
    terms = search_terms(disease)
    query = " OR ".join(f'"{t}"' for t in terms)
    params = {"query.cond": query, "fields": CT_FIELDS, "pageSize": 1000, "countTotal": "true", "format": "json"}
    studies, token, total = [], None, None
    while True:
        page = get_json(ctx.session, ctx.trials, CT_API, ctx.headers, {**params, **({"pageToken": token} if token else {})}, "ClinicalTrials.gov")
        total = page.get("totalCount", total)
        studies += page.get("studies") or []
        token = page.get("nextPageToken")
        if not token:
            break
    abbrevs = abbreviations(disease)
    groups: dict[str, list[dict]] = {"completed": [], "ongoing": [], "stoppedOrUnknown": []}
    expansion_only: list[dict] = []
    for study in studies:
        record = study_record(study, terms, abbrevs)
        if not record["matchedTerms"]:
            expansion_only.append(record)
            continue
        status = record["status"] or ""
        groups["completed" if status in COMPLETED else "ongoing" if status in ONGOING else "stoppedOrUnknown"].append(record)
    for records in [*groups.values(), expansion_only]:
        records.sort(key=lambda r: r.get("startDate") or "", reverse=True)
    return {
        "query": {"query.cond": query},
        "apiUrl": f"{CT_API}?query.cond={urllib.parse.quote(query)}",
        "apiTotalCount": total if total is not None else len(studies),
        "counts": {key: len(records) for key, records in groups.items()},
        **groups,
        "expansionOnlyCount": len(expansion_only),
        "expansionOnly": expansion_only,
        "retrievedAt": now(),
    }


def stage_trials(ctx, document: dict, write) -> None:
    for disease in document["diseases"]:
        if ctx.resume and "clinicalTrials" in disease:
            continue
        disease["clinicalTrials"] = result = clinical_trials(ctx, disease)
        c = result["counts"]
        print(f"[clinicalTrials] {disease['name']}: completed {c['completed']}, ongoing {c['ongoing']}, stopped/unknown {c['stoppedOrUnknown']}", flush=True)
        write()


# --------------------------------------------------------------------------------------------------
# Stage 6: nihFunding
# --------------------------------------------------------------------------------------------------

REPORTER_API = "https://api.reporter.nih.gov/v2/projects/search"
REPORTER_FIELDS = [
    "ApplId",
    "ProjectNum",
    "CoreProjectNum",
    "ProjectTitle",
    "AbstractText",
    "Terms",
    "FiscalYear",
    "AwardAmount",
    "IsActive",
    "ProjectStartDate",
    "ProjectEndDate",
    "Organization",
    "PrincipalInvestigators",
    "AgencyIcAdmin",
    "ActivityCode",
]
REPORTER_PAGE = 500
REPORTER_MAX_OFFSET = 14999


def reporter_post(ctx, body: dict, attempts: int = 4) -> dict:
    sent = {**ctx.headers, "Content-Type": "application/json", "Accept": "application/json"}
    for attempt in range(1, attempts + 1):
        ctx.reporter.wait()
        response = ctx.session.post(REPORTER_API, json=body, headers=sent, timeout=90)
        if response.status_code == 200:
            return response.json()
        if response.status_code in (429, 500, 502, 503, 504) and attempt < attempts:
            ctx.reporter.cooldown(retry_delay(dict(response.headers), attempt))
            continue
        raise RuntimeError(f"RePORTER returned HTTP {response.status_code}: {response.text[:200]}")
    raise RuntimeError("RePORTER request failed")


def where_named(record: dict, keys: list[str]) -> str:
    for field, label in (("project_title", "title"), ("abstract_text", "abstract"), ("terms", "terms")):
        if any(k in compact(record.get(field) or "") for k in keys):
            return label
    return "search match"


def group_projects(records: list[dict], keys: list[str]) -> list[dict]:
    today = date.today().isoformat()
    projects: dict[str, dict] = {}
    for record in records:
        core = record.get("core_project_num") or record.get("project_num")
        project = projects.setdefault(core, {"records": [], "named": set()})
        project["records"].append(record)
        project["named"].add(where_named(record, keys))
    rows = []
    for core, project in projects.items():
        recs = sorted(project["records"], key=lambda r: r.get("fiscal_year") or 0)
        latest = recs[-1]
        end = max((r.get("project_end_date") or "")[:10] for r in recs) or None
        start = min(((r.get("project_start_date") or "")[:10] for r in recs if r.get("project_start_date")), default=None)
        active = any(r.get("is_active") for r in recs) or bool(end and end >= today)
        location = next((loc for loc in ("title", "abstract", "terms", "search match") if loc in project["named"]), "search match")
        org = latest.get("organization") or {}
        rows.append(
            {
                "coreProjectNum": core,
                "title": latest.get("project_title"),
                "status": "ongoing" if active else "past",
                "relevance": "focus" if location == "title" else "mention",
                "namedIn": location,
                "fiscalYears": sorted({r.get("fiscal_year") for r in recs if r.get("fiscal_year")}),
                "totalAwardAmount": sum(r.get("award_amount") or 0 for r in recs),
                "projectStartDate": start,
                "projectEndDate": end,
                "activityCode": latest.get("activity_code"),
                "institute": (latest.get("agency_ic_admin") or {}).get("abbreviation"),
                "organization": org.get("org_name"),
                "location": ", ".join(p for p in (org.get("org_city"), org.get("org_state"), org.get("org_country")) if p),
                "principalInvestigators": [(pi.get("full_name") or "").replace("  ", " ").strip() for pi in latest.get("principal_investigators") or []],
                "url": f"https://reporter.nih.gov/project-details/{latest.get('appl_id')}",
            }
        )
    rows.sort(key=lambda r: (r["relevance"] != "focus", -(r["fiscalYears"][-1] if r["fiscalYears"] else 0)))
    return rows


def nih_funding(ctx, disease: dict) -> dict:
    terms = phrase_terms(disease)
    search_text = " OR ".join(f'"{t}"' for t in terms)
    criteria = {"advanced_text_search": {"operator": "advanced", "search_field": "projecttitle,terms,abstracttext", "search_text": search_text}}
    records, offset, meta = [], 0, {}
    while offset <= REPORTER_MAX_OFFSET:
        page = reporter_post(ctx, {"criteria": criteria, "include_fields": REPORTER_FIELDS, "offset": offset, "limit": REPORTER_PAGE})
        meta = page.get("meta") or meta
        batch = page.get("results") or []
        records += batch
        offset += REPORTER_PAGE
        if len(batch) < REPORTER_PAGE or offset >= (meta.get("total") or 0):
            break
    projects = group_projects(records, [compact(t) for t in terms])
    ongoing = [p for p in projects if p["status"] == "ongoing"]
    past = [p for p in projects if p["status"] == "past"]

    def summary(rows: list[dict]) -> dict:
        return {"projects": len(rows), "focusProjects": sum(r["relevance"] == "focus" for r in rows), "totalAwardAmount": sum(r["totalAwardAmount"] for r in rows)}

    return {
        "searchText": search_text,
        "searchFields": "projecttitle,terms,abstracttext",
        "reporterUrl": (meta.get("properties") or {}).get("URL", "").replace("https:/", "https://", 1) or None,
        "fiscalYearRecords": meta.get("total", len(records)),
        "recordsRetrieved": len(records),
        "hasFunding": bool(projects),
        "summary": {"ongoing": summary(ongoing), "past": summary(past)},
        "ongoing": ongoing,
        "past": past,
        "retrievedAt": now(),
    }


def stage_nih(ctx, document: dict, write) -> None:
    for disease in document["diseases"]:
        if ctx.resume and "nihFunding" in disease:
            continue
        disease["nihFunding"] = result = nih_funding(ctx, disease)
        on, past = result["summary"]["ongoing"], result["summary"]["past"]
        print(f"[nihFunding] {disease['name']}: ongoing {on['projects']} ({on['focusProjects']} focus) | past {past['projects']} ({past['focusProjects']} focus)", flush=True)
        write()


# --------------------------------------------------------------------------------------------------
# Stage 7: pubmed
# --------------------------------------------------------------------------------------------------

EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
ESEARCH_CAP = 9999
SUMMARY_BATCH = 200
FIRST_YEAR = 1800
RECENT = 10


class PubMed:
    def __init__(self, session, headers: dict):
        self.session = session
        self.limiter = RateLimiter(min_interval=0.35)
        self.headers = {**headers, "Accept": "application/json"}
        self.ident = {"tool": headers.get("X-Requester") or REQUESTER, "email": headers.get("From") or FROM_HEADER}

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
        count = int(self.search(term, f"{start}/01/01", f"{end}/12/31").get("count") or 0)
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
    clauses = [f'"{t}"[Title/Abstract]' for t in phrase_terms(disease)]
    name = (disease.get("name") or "").replace('"', "").strip()
    if name:
        clauses.insert(0, f'"{name}"[MeSH Terms]')
    return " OR ".join(clauses)


def pubmed_articles(ctx, disease: dict) -> tuple[dict, list[dict]]:
    query = pubmed_query(disease)
    total, ids, translation = ctx.pubmed.pmids(query)
    articles = ctx.pubmed.summaries(ids)
    articles.sort(key=lambda a: a.get("sortDate") or "", reverse=True)
    by_year = Counter(a["year"] for a in articles if a.get("year"))
    summary = {
        "query": query,
        "queryTranslation": translation,
        "pubmedUrl": "https://pubmed.ncbi.nlm.nih.gov/?term=" + urllib.parse.quote(query),
        "count": total,
        "retrieved": len(articles),
        "reviewCount": sum(any("Review" in t for t in a["publicationTypes"]) for a in articles),
        "firstYear": min(by_year) if by_year else None,
        "latestYear": max(by_year) if by_year else None,
        "countsByYear": {str(y): by_year[y] for y in sorted(by_year)},
        "recentArticles": articles[:RECENT],
        "retrievedAt": now(),
    }
    return summary, articles


def stage_pubmed(ctx, document: dict, write, articles_path: Path) -> None:
    store = {"source": "NCBI E-utilities (PubMed)", "requestHeaders": document["requestHeaders"], "retrievedAt": now(), "diseases": {}}
    if ctx.resume and articles_path.exists():
        store = json.loads(articles_path.read_text(encoding="utf-8"))
    for disease in document["diseases"]:
        name = disease["name"]
        if ctx.resume and "pubmed" in disease and name in store["diseases"]:
            continue
        summary, articles = pubmed_articles(ctx, disease)
        summary["articlesFile"] = articles_path.name
        disease["pubmed"] = summary
        store["diseases"][name] = {"query": summary["query"], "count": summary["count"], "articles": articles}
        print(f"[pubmed] {name}: {summary['count']} articles ({summary['reviewCount']} reviews)", flush=True)
        write()
        articles_path.write_text(json.dumps(store, ensure_ascii=False) + "\n", encoding="utf-8")


# --------------------------------------------------------------------------------------------------
# Stage 8: orphanetDirectories
# --------------------------------------------------------------------------------------------------

ORPHANET = "https://www.orpha.net"
ORPHANET_SOURCE = f"{ORPHANET}/en/expert-centres"


def orphanet_url(path: str, **params: str) -> str:
    return f"{ORPHANET}{path}?" + urllib.parse.urlencode(params, quote_via=urllib.parse.quote)


def orphanet_directories(disease: dict) -> dict:
    """Links to Orphanet's live directories for this ORPHAcode; orpha.net itself is never requested."""
    code = str((disease.get("orphanet") or {}).get("id") or "")
    name = disease.get("name") or ""
    if not code:
        return {
            "orphaCode": None,
            "source": ORPHANET_SOURCE,
            "diseasePage": None,
            "communities": None,
            "expertise": None,
            "registries": None,
            "activeWork": None,
            "detail": "NORD lists no Orphanet code for this disease, so there are no Orphanet directory pages to link.",
        }
    by_code = {"orphaCode": code, "diseaseName": name}
    return {
        "orphaCode": code,
        "source": ORPHANET_SOURCE,
        "diseasePage": f"{ORPHANET}/en/disease/detail/{code}",
        "communities": {
            "patientOrganisations": orphanet_url("/en/patient-organisations", **by_code),
            "federationsAndAlliances": orphanet_url("/en/patient-organisations/federations-alliances", **by_code),
        },
        "expertise": {
            "expertCentres": orphanet_url(
                f"/en/expert-centres/centres/{code}", name=name, diseaseName=name, consulting="medical", age="all", official="0"
            ),
            "expertCentreNetworks": orphanet_url("/en/expert-centres/networks", orphaCode=code, name=name, diseaseName=name),
            "europeanReferenceNetworks": orphanet_url("/en/institutions/expert-networks", **by_code),
        },
        "registries": {
            "patientRegistries": orphanet_url("/en/research-trials/registries", **by_code),
            "biobanks": orphanet_url("/en/research-trials/biobanks", **by_code),
        },
        "activeWork": {
            "researchProjects": orphanet_url("/en/research-trials/research-projects", orphaCode=code, diseaseName=name, mode="orpha", name=code),
            "clinicalTrials": orphanet_url("/en/research-trials/clinical-trials", **by_code),
        },
        "detail": "Links open Orphanet's live directory for this ORPHAcode. Entries are not copied here because Orphanet "
        "licenses its directory data through an Orphadata Data Transfer Agreement.",
    }


def stage_orphanet(document: dict, write) -> None:
    for disease in document["diseases"]:
        disease["orphanetDirectories"] = orphanet_directories(disease)
    print(f"[orphanetDirectories] linked {sum(bool(d['orphanetDirectories']['orphaCode']) for d in document['diseases'])} diseases", flush=True)
    write()


# --------------------------------------------------------------------------------------------------
# Orchestration
# --------------------------------------------------------------------------------------------------


class Context:
    def __init__(self, api_key: str, resume: bool):
        self.key = api_key
        self.resume = resume
        self.headers = dict(REQUEST_HEADERS)
        self.session = requests.Session(impersonate="chrome")
        self.omim = RateLimiter(min_interval=2.0)
        self.trials = RateLimiter(min_interval=1.5)
        self.reporter = RateLimiter(min_interval=1.0)
        self.hpo = Hpo(self.session, self.headers)
        self.pubmed = PubMed(self.session, self.headers)


def parse_page_range(spec: str) -> tuple[int, int]:
    start, _, end = spec.strip().partition("-")
    first, last = int(start), int(end or start)
    if first < 1 or last < first:
        raise argparse.ArgumentTypeError(f"Invalid page range {spec!r}. Use 3 or 3-4.")
    return first, last


def ordered(document: dict) -> dict:
    """Top-level key order of rarediseases_sample.json."""
    keys = ("source", "retrievedAt", "requestHeaders", "notes", "diseases", "crossDiseaseGenePatterns")
    return {k: document[k] for k in keys if k in document}


def refresh_orphanet(path: Path) -> None:
    if not path.exists():
        raise SystemExit(f"{path} does not exist; run the full pipeline first.")
    document = json.loads(path.read_text(encoding="utf-8"))
    note = NOTES[-1]
    document["notes"] = [n for n in document.get("notes") or [] if not n.startswith("orphanetDirectories")] + [note]

    def write() -> None:
        path.write_text(json.dumps(ordered(document), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    stage_orphanet(document, write)
    print(f"Updated orphanetDirectories for {len(document['diseases'])} diseases in {path}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--pages", type=parse_page_range, help="NORD listing page or inclusive range, e.g. 1-2.")
    parser.add_argument("--limit", type=int, default=0, help="Keep only the first N diseases of --pages.")
    parser.add_argument("--names", nargs="*", default=[], help="Disease names to look up on their NORD letter page.")
    parser.add_argument("--out", type=Path, default=Path("rarediseases.json"), help="Output JSON. Default: rarediseases.json")
    parser.add_argument("--articles-out", type=Path, help="Full PubMed article lists. Default: pubmed_articles.json next to --out.")
    parser.add_argument("--delay", type=float, default=0.35, help="Seconds between NORD page requests. Default: 0.35.")
    parser.add_argument("--attempts", type=int, default=3, help="Retries per NORD request. Default: 3.")
    parser.add_argument("--resume", action="store_true", help="Keep diseases and stage results already in --out.")
    parser.add_argument(
        "--orphanet-only", action="store_true", help="Only (re)build orphanetDirectories in an existing --out; no API calls."
    )
    args = parser.parse_args()
    if args.orphanet_only:
        refresh_orphanet(args.out)
        return
    if not args.pages and not args.names:
        parser.error("Give --pages and/or --names.")
    api_key = os.environ.get("OMIM_API_KEY", "").strip()
    if not api_key:
        raise SystemExit("Set OMIM_API_KEY. It is never read from or written to the JSON file.")

    articles_path = args.articles_out or args.out.with_name("pubmed_articles.json")
    previous = json.loads(args.out.read_text(encoding="utf-8")) if args.resume and args.out.exists() else {}
    existing = {d["nord"]["url"]: d for d in previous.get("diseases") or [] if d.get("nord") and "listingPage" in d}
    existing.update({f"query:{d['query']}": d for d in previous.get("diseases") or [] if d.get("query")})

    document = {
        "source": SOURCE,
        "retrievedAt": previous.get("retrievedAt") or now(),
        "requestHeaders": dict(REQUEST_HEADERS),
        "notes": [note.format(articles_file=articles_path.name) for note in NOTES],
        "diseases": [],
    }
    if previous.get("crossDiseaseGenePatterns"):
        document["crossDiseaseGenePatterns"] = previous["crossDiseaseGenePatterns"]

    def write() -> None:
        args.out.write_text(json.dumps(ordered(document), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    stage_nord(document, args, existing)
    write()

    ctx = Context(api_key, args.resume)
    stage_omim_sections(ctx, document, write)
    stage_gene_mechanism(ctx, document, write)
    stage_hpo(ctx, document, write)
    stage_trials(ctx, document, write)
    stage_nih(ctx, document, write)
    stage_pubmed(ctx, document, write, articles_path)
    stage_orphanet(document, write)
    print(f"Wrote {len(document['diseases'])} diseases to {args.out} and article lists to {articles_path}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped. Re-run with --resume to continue.", file=sys.stderr)
        raise SystemExit(130) from None

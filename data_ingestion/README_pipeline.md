# Rare-disease data ingestion

`pipeline.py` builds one JSON file per run that describes a set of rare diseases. Each record covers:

- the disease's NORD report;
- OMIM text, causal genes and variant mechanisms;
- symptom patterns shared across its genes (HPO);
- clinical trials;
- NIH funding;
- PubMed articles;
- links to Orphanet's patient-group directories.

The output has the same structure as `rarediseases_sample.json`.

## Setup

You need Python 3.9 or newer and one package:

```bash
python3 -m pip install curl_cffi
```

You also need an OMIM API key ([request one here](https://www.omim.org/api)). The pipeline reads it from the environment. It never writes the key to any output file.

```bash
export OMIM_API_KEY='your-key'
```
## Running

Run every command from this folder (`rarelyalone/data_ingestion/`).

**Rebuild the sample file.** This takes the first 19 diseases on NORD listing pages 1–2, plus four diseases looked up by name:

```bash
python3 pipeline.py --pages 1-2 --limit 19 \
    --names "Noonan syndrome" "Costello syndrome" "cardiofaciocutaneous syndrome" "neurofibromatosis type 1 (NF1)" \
    --out rarediseases_sample.json
```

**Other listing pages:**

```bash
python3 pipeline.py --pages 3-4 --out rarediseases_pages_3_4.json
```

**Specific diseases by name.** Each name is matched against NORD's A–Z catalog by title or synonym:

```bash
python3 pipeline.py --names "Batten disease" --out batten.json
```

**Resume an interrupted run.** This keeps every disease and stage result already saved in `--out` and fills in only what is missing:

```bash
python3 pipeline.py --pages 1-2 --limit 19 --names ... --out rarediseases_sample.json --resume
```

**Rebuild only the Orphanet links** in an existing file. This needs no API key and makes no network calls:

```bash
python3 pipeline.py --orphanet-only --out rarediseases_sample.json
```

## Options

| Option | Meaning |
|---|---|
| `--pages 1-2` | NORD listing page or inclusive page range |
| `--limit N` | Keep only the first N diseases from `--pages` |
| `--names ...` | Disease names to look up in NORD |
| `--out FILE` | Output JSON (default `rarediseases.json`) |
| `--articles-out FILE` | Full PubMed article lists (default `pubmed_articles.json` next to `--out`) |
| `--delay S` | Seconds between NORD requests (default 0.35) |
| `--attempts N` | Retries per NORD request (default 3) |
| `--resume` | Reuse results already in `--out` |
| `--orphanet-only` | Only rebuild `orphanetDirectories` in `--out` |

You must give `--pages` or `--names` (or both), unless you use `--orphanet-only`.

## What the pipeline does

The stages run in this order, and each one goes through every disease. NORD always runs first because every later stage depends on the names and IDs it collects.

| # | Field | Source |
|---|---|---|
| 1 | `nord`, `synonyms`, `omim`, `orphanet`, `gard` | NORD catalog and disease pages |
| 2 | `omimSections` | OMIM API: text sections |
| 3 | `geneVariantMechanism` | OMIM API: causal gene and variant mechanism |
| 4 | `hpoGenePatterns`, `crossDiseaseGenePatterns` | OMIM clinical synopsis and the NLM HPO API |
| 5 | `clinicalTrials` | ClinicalTrials.gov API v2, split into completed and ongoing |
| 6 | `nihFunding` | NIH RePORTER, split into ongoing and past projects |
| 7 | `pubmed` | PubMed E-utilities (counts here, full lists in `--articles-out`) |
| 8 | `orphanetDirectories` | Built from the ORPHAcode, with no request sent to orpha.net |

The output file is saved after every disease. If a run stops (for example with Ctrl-C), add `--resume` to the same command to continue.

Requests are deliberately spaced out: OMIM calls are 2 s apart, ClinicalTrials.gov calls 1.5 s, NIH RePORTER calls 1 s and PubMed calls 0.35 s. As a result, a run of a couple of dozen diseases takes a while. Diseases with very large literatures, such as NF1, add the most time because their PubMed lists are fetched in full.

## Output files

- **`--out`** (for example `rarediseases_sample.json`) contains:
  - the source and retrieval time;
  - the request headers;
  - notes describing each field;
  - the `diseases` records;
  - `crossDiseaseGenePatterns`.
- **`--articles-out`** (default `pubmed_articles.json`) contains every PubMed article for each disease, keyed by disease name.

The `orphanetDirectories` links open Orphanet's live directories for patient organisations, expert centres and networks, registries, biobanks, research projects and trials. The pipeline does not fetch the entries themselves. Orphanet's directory data is licensed separately through an Orphadata Data Transfer Agreement.

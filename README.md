# RarelyAlone

RarelyAlone is a rare-disease research atlas and resource navigator. It helps people explore how diseases may relate, inspect the evidence behind a connection, and find research, trials, patient organizations, and registries. The project is designed to make evidence and uncertainty visible: a shared cellular location, a preclinical lead, and a demonstrated human connection are different kinds of claims.

## Data and evidence

The app combines curated atlas content, a generated disease research dataset, and selected live lookups. Each layer has a different purpose and should be interpreted accordingly.

### Curated atlas data

Disease descriptions, genes, community links, source links, and the pairwise connections displayed in the atlas are maintained in `src/data/`. Connections use three labels:

| Label | Meaning |
|---|---|
| Same pathway | Evidence supports a shared biological mechanism or pathway. |
| Same cellular neighborhood | The diseases share a broad cellular context, such as lysosomal biology; this alone does not establish a shared cause or treatment response. |
| Candidate connection | A possible relationship supported by early or model-based research that needs further study. |

Each connection can include an evidence type, source, and caveat. Some curated entries are still marked `Not reported` or have an empty source URL. Those are visible data gaps, not verified evidence. Review and replace these placeholders before treating the affected edge as sourced. Curated records also include a `lastVerified` date; check the linked primary source before relying on time-sensitive claims such as trial status or treatment availability.

### Disease research dataset

`src/data/rarediseases.json` is the checked-in output of the ingestion pipeline. It contains 23 disease records and cross-disease gene-pattern data. The records include NORD catalog details and synonyms, OMIM identifiers and text/mechanism information, HPO phenotype patterns, clinical trials, NIH-funded projects, PubMed metadata, and links to Orphanet directories. The larger, separate PubMed article output is `data_ingestion/pubmed_articles.json`.

The pipeline is documented in [`data_ingestion/README_pipeline.md`](data_ingestion/README_pipeline.md). It writes provenance and retrieval metadata alongside records and saves progress as it runs. Main sources and uses are:

| Source | Data used |
|---|---|
| [NORD](https://rarediseases.org/) | Disease catalog entries, identifiers, names, and synonyms. |
| [OMIM](https://www.omim.org/) | Disease descriptions, clinical synopsis, gene associations, and variant mechanisms. Requires an OMIM API key for ingestion. |
| [Human Phenotype Ontology (HPO)](https://hpo.jax.org/) | Phenotype terms and patterns associated with genes. |
| [ClinicalTrials.gov](https://clinicaltrials.gov/) | Study records and status, grouped by the pipeline into completed, ongoing, and other/uncertain statuses. |
| [NIH RePORTER](https://reporter.nih.gov/) | NIH-funded projects, investigators, organizations, and funding years. |
| [PubMed](https://pubmed.ncbi.nlm.nih.gov/) | Search counts and publication metadata; article titles/metadata are not a substitute for reviewing abstracts or full papers. |
| [Orphadata / Orphanet](https://www.orphadata.com/) | Orphanet identifiers and links to patient organizations, expert centers, networks, registries, biobanks, projects, and trials. The pipeline constructs directory links; it does not download the directory entries. Orphadata directory data has separate licensing terms. |
| [GARD](https://rarediseases.info.nih.gov/) | Cross-reference links when present in NORD records. |

Searches can return imperfect matches, especially for short names, synonyms, and broad trial or literature queries. The pipeline records match context and source links where available, but it does not establish that a study is clinically applicable to a person or that two diseases will respond similarly to a treatment. Verify important findings against the linked source. Missing records mean “not found in this dataset,” not “none exist.”

### Live data and AI-assisted exploration

Some pages can query live services, including Orphadata, ClinicalTrials.gov, and MedlinePlus. The atlas research flow can also use OMIM and configured Lovable AI services. Live results depend on network availability, source coverage, configured credentials, and the exact query. They should be reviewed at their source.

The app presents research exploration and educational information. It does not diagnose, recommend treatment, determine trial eligibility, or replace a clinician or genetic counselor. Patient-facing information should not be treated as clinical evidence unless explicitly identified and sourced as such.

## Run locally

### Requirements

- Node.js compatible with the versions in `package.json` and a package manager (npm or Bun)
- Python 3.9+ only if running the data ingestion pipeline

Install dependencies and start the development server:

```bash
git clone https://github.com/sarahyueqigu/RarelyAlone.git
cd RarelyAlone
npm install
npm run dev
```

Vite prints the local development URL in the terminal.

### Environment variables

The static app and prebuilt dataset can be explored without the ingestion API key. Optional features use server-side secrets:

| Variable | Needed for |
|---|---|
| `OMIM_API_KEY` | Running the Python ingestion pipeline and live OMIM lookups. Request a key from [OMIM](https://www.omim.org/api). |
| `LOVABLE_API_KEY` | AI-assisted atlas exploration when using the Lovable AI integration. |

Set secrets in your local environment or deployment secret manager. Do not commit keys to the repository or place them in client-side code.

For example, in a local shell:

```bash
export OMIM_API_KEY="your-key"
export LOVABLE_API_KEY="your-key"
```

Only set the variables for features you intend to run.

## Refresh the research dataset

The ingestion script is in `data_ingestion/`. It requires `curl_cffi` and an OMIM API key:

```bash
python3 -m pip install curl_cffi
export OMIM_API_KEY="your-key"
cd data_ingestion
python3 pipeline.py --pages 1-2 --limit 19 \
  --names "Noonan syndrome" "Costello syndrome" \
    "cardiofaciocutaneous syndrome" "neurofibromatosis type 1 (NF1)" \
  --out rarediseases_sample.json
```

The pipeline also writes a PubMed article file beside the output by default. Use `--resume` to continue an interrupted run. See the pipeline README for page/name selection, rate limits, output fields, and Orphanet-only refresh instructions. After generating data for the application, place the desired JSON output at `src/data/rarediseases.json` and review the recorded provenance and timestamps before committing it.

## Project commands

```bash
npm run dev        # start the local development server
npm run build      # create a production build
npm run preview    # preview the production build locally
npm run lint       # run ESLint
npm test           # run the test suite once
npm run test:watch  # run tests in watch mode
```

## Repository map

```text
src/
  data/             Curated atlas content and checked-in research dataset
  lib/              Data access, live integrations, and server functions
  routes/           App pages
  test/             Tests
data_ingestion/     Python pipeline and its documentation/sample outputs
```

## Contributing data or evidence

When adding or changing a disease fact, resource, or graph connection:

1. Link to the primary source whenever possible and preserve the stable identifier (for example, PMID, NCT number, OMIM number, or ORPHAcode).
2. Record when the information was checked if it can change over time.
3. Label the evidence type and distinguish human evidence from animal or cell-model findings.
4. State limitations and unresolved questions; do not turn a shared pathway or preclinical result into a clinical conclusion.
5. Keep patient-reported experiences distinct from published research evidence.

Run `npm test` and `npm run lint` before submitting changes.

## License and data use

No repository-wide software license is specified in the current project files. Check with the maintainers before reusing project code. Data and linked third-party material may have their own licenses and terms; follow the source-specific terms, including Orphadata's licensing and transfer requirements.

## Data provenance

The dataset was assembled through a series of API calls to NORD, OMIM, ClinicalTrials.gov, HPO, PubMed/PMC, NIH RePORTER, and Orphanet. All web scraping, API retrieval, and consolidation of the resulting data into a structured JSON file were implemented in the Python script `pipeline.py`. The pipeline first web-scraped NORD to generate a sampled list of rare diseases. It then used OMIM to identify disease-associated genes and their mechanisms of action, and HPO to characterize each disease’s phenotype. PubMed/PMC provided relevant academic literature, while NIH RePORTER identified related research funding. Finally, ClinicalTrials.gov was used to locate ongoing clinical trials, and Orphanet provided information on active expert communities and patient foundations that individuals can use to find support and learn more about their condition.

More information about the data sources and pipeline can be found in [`data_ingestion/README_pipeline.md`](data_ingestion/README_pipeline.md).

To generate a dataset, run this command from the `data_ingestion` folder:

```bash
python3 pipeline.py --pages [#]-[#] --out filename.json
```

Replace `[#]-[#]` with the NORD page range to include.

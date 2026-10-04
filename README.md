# RarelyAlone

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5a6d17f0-a987-4c9f-adfa-e99e9f0a7057).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Data
The dataset was assembled through a series of API calls to NORD, OMIM, ClinicalTrials.gov, HPO, PubMed/PMC, NIH RePORTER, and Orphanet. All web-scraping, API retrieval, and consolidation of the resulting data into a structured JSON file were implemented in the Python script pipeline.py. The pipeline first web-scraped NORD to generate a sampled list of rare diseases. It then used OMIM to identify disease-associated genes and their mechanisms of action, and HPO to characterize each disease’s phenotype. PubMed/PMC provided relevant academic literature, while NIH RePORTER identified related research funding. Finally, ClinicalTrials.gov was used to locate ongoing clinical trials, and Orphanet provided information on active expert communities and patient foundations that individuals can use to find support and learn more about their condition.

To run this dataset, simply type in 
``python3 pipeline.py --pages [#]-[#] --out filename.json``

where pages [#]-[#] list the page numbers within NORD


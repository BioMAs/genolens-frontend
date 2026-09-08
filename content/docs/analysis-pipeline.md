---
title: Analysis pipeline
description: From raw counts to differential expression results, step by step.
category: getting-started
order: 10
---

# GenoLens V2 — Analysis Pipeline

Technical reference for every step of the GenoLens analysis workflow: endpoint, statistical method, Python package, and key parameters.

---

## Pipeline Overview

```mermaid
graph TD
    subgraph INGEST["① Ingestion"]
        A([User uploads file\nCSV / TSV / XLSX]) -->|POST /datasets/upload| B[Celery: process_dataset_upload]
        B --> C[Parquet conversion\npandas + pyarrow]
        B --> D[Metadata extraction\nColumn pattern detection]
    end

    subgraph PRECOMP["② Pre-computation  ·  automatic on upload"]
        C --> E[PCA 2D/3D\nsklearn PCA + StandardScaler]
        C --> F[UMAP\numap-learn]
        C --> G[Volcano plot data\nStratified downsampling ≤ 5 000 pts]
        C --> H[DEG statistics\npadj < 0.05, |logFC| > 0.58]
        C --> I[Expression heatmap\nZ-score + scale to −1…1]
        C --> J[Enrichment dotplots\nGeneRatio = r / rExpected]
    end

    subgraph ONDEMAND["③ On-demand analysis"]
        K([Hierarchical clustering\nscipy + fastcluster]) 
        L([K-means clustering\nsklearn KMeans\nsilhouette k-selection])
        M([GO enrichment\nscipy hypergeom + BH FDR])
        N([GSEA\nRunning-sum ES\n1 000 permutations + NES])
        O([DESeq2 self-service\nR worker — negative binomial])
    end

    subgraph EXT["④ External integrations"]
        P([STRING DB v12\nPPI network + functional enrichment])
        Q([NCBI GEO\neUtils esearch / esummary])
        R([Cytoscape export\nCX2 / GraphML / cytoscape.js])
    end

    subgraph AI["⑤ AI interpretation"]
        S([Ollama local LLM\nllama3.2:3b → llama3.1:8b → biomistral\ntemp=0.3])
    end

    subgraph CACHE["⑥ Cache layer  ·  transparent"]
        T[(Redis TTL\nclustering 1 h\nvolcano 2 h\nstats 24 h)]
        U[(In-memory LRU\n5 DataFrames)]
    end

    D --> ONDEMAND
    E & F & G & H & I & J --> ONDEMAND
    ONDEMAND --> EXT
    ONDEMAND --> AI
    ONDEMAND --> CACHE

    style INGEST   fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
    style PRECOMP  fill:#dcfce7,stroke:#22c55e,color:#14532d
    style ONDEMAND fill:#fef9c3,stroke:#eab308,color:#713f12
    style EXT      fill:#f3e8ff,stroke:#a855f7,color:#4a044e
    style AI       fill:#fee2e2,stroke:#ef4444,color:#7f1d1d
    style CACHE    fill:#f1f5f9,stroke:#94a3b8,color:#0f172a
```

---

## Step-by-step Reference

### 1 · Dataset Upload & ETL

| | |
|---|---|
| **Endpoint** | `POST /api/v1/datasets/upload` |
| **Background task** | `process_dataset_upload` (Celery queue: `default`) |
| **Service** | `backend/app/services/data_processor.py` |

**What it does:** Accepts a raw file (CSV, TSV, XLSX), stores it in Supabase Storage, converts it to column-compressed Parquet, then triggers all pre-computation steps asynchronously.

**Packages & method:**

| Package | Role |
|---------|------|
| `pandas` | File parsing, normalisation, chunked reads |
| `pyarrow` / `pyarrow.parquet` | Parquet serialisation with column pruning |
| `openpyxl` | XLSX parsing (via pandas engine) |

**Key parameters:**
- `CHUNK_SIZE` — controls chunk size for streaming reads (from settings)
- `PARQUET_COMPRESSION` — compression algorithm (from settings)
- Gene column normalisation: columns named `Unnamed: 0` or `gene` are renamed to `gene_id`

---

### 2 · Metadata Extraction

| | |
|---|---|
| **Triggered by** | `process_dataset_upload` (same Celery task as step 1) |
| **Function** | `data_processor.get_file_metadata()` |

**What it does:** Inspects column names to auto-detect comparisons, test methods, and enrichment datasets present in the file.

**Detection patterns:**

| Column prefix | Meaning |
|---------------|---------|
| `logFC:<comparison>` | Log₂ fold-change for a contrast |
| `padj:<comparison>` | Adjusted p-value (BH default) |
| `padj.Stouffer:<comparison>` | Stouffer meta-analysis correction |
| `padj.Fisher:<comparison>` | Fisher meta-analysis correction |
| `padj.edgeR:<comparison>` | edgeR-specific correction |

Returns: row count, column count, dtypes, memory usage (MB), missing value counts, detected comparison names and test methods.

---

### 3 · Principal Component Analysis (PCA)

| | |
|---|---|
| **Endpoint (pre-computed)** | `GET /api/v1/datasets/{id}/pca` |
| **Endpoint (custom)** | `POST /api/v1/datasets/{id}/comparisons/{name}/visualizations/pca` |
| **Function** | `data_processor.calculate_pca()` |

**Algorithm:** Standard PCA via eigendecomposition of the covariance matrix of the standardised expression matrix.

**Packages & method:**

| Package | Role |
|---------|------|
| `sklearn.preprocessing.StandardScaler` | Mean-centring + unit-variance scaling (Z-score per feature) |
| `sklearn.decomposition.PCA` | Eigendecomposition; returns PC coordinates + explained variance ratio |
| `numpy` | Matrix operations |

**Parameters:**
- `n_components = 2` (default) or `3` (for 3-D view)
- `random_state = 42`
- Pre-computed at upload time for the full matrix; custom endpoint accepts a gene/sample subset

---

### 4 · Uniform Manifold Approximation and Projection (UMAP)

| | |
|---|---|
| **Endpoint (pre-computed)** | `GET /api/v1/datasets/{id}/umap` |
| **Endpoint (custom)** | `POST /api/v1/datasets/{id}/comparisons/{name}/visualizations/umap` |
| **Function** | `data_processor.calculate_umap()` |

**Algorithm:** Non-linear manifold learning that preserves both local and global structure of high-dimensional expression data.

**Packages & method:**

| Package | Role |
|---------|------|
| `umap-learn` (`umap.UMAP`) | Manifold embedding |
| `sklearn.preprocessing.StandardScaler` | Pre-scaling (same as PCA step) |

**Default parameters:**
| Parameter | Value | Effect |
|-----------|-------|--------|
| `n_neighbors` | 15 | Controls local vs. global structure balance |
| `min_dist` | 0.1 | Minimum distance between embedded points |
| `n_components` | 2 | Output dimensions |
| `random_state` | 42 | Reproducibility |

---

### 5 · Differential Expression — Volcano Plot

| | |
|---|---|
| **Endpoint** | `GET /api/v1/datasets/{id}/volcano-plot/{comparison_name}` |
| **Function** | `data_processor.calculate_volcano_plots()` |

**What it does:** Produces x = log₂FC, y = −log₁₀(padj) scatter data for each gene, pre-stratified and downsampled to keep the payload small.

**Downsampling strategy:**
1. All significant genes (padj < 0.05 **and** |logFC| > 0.58) are kept verbatim.
2. Non-significant genes are uniformly downsampled (evenly spaced by index) to reach a **5 000-point** maximum.

**Significance thresholds (defaults):**
| Threshold | Value |
|-----------|-------|
| `padj_max` | 0.05 |
| `logfc_min` | 0 (display all; 0.58 for significance colouring) |

---

### 6 · DEG Statistics

| | |
|---|---|
| **Endpoint** | `GET /api/v1/datasets/{id}/comparisons/stats` |
| **Function** | `data_processor.calculate_deg_statistics()` |

**What it does:** Counts up-regulated, down-regulated, and total significant genes per comparison; returns top genes by absolute logFC.

**Thresholds:**
| Parameter | Default | Note |
|-----------|---------|------|
| `logfc_threshold` | **0.58** | ≈ 1.5× fold-change (log₂(1.5) ≈ 0.58) |
| `padj_threshold` | **0.05** | BH-adjusted p-value |

**Packages:** `pandas`, `numpy`

---

### 7 · Expression Heatmap

| | |
|---|---|
| **Endpoint** | `GET /api/v1/datasets/{id}/heatmaps` |
| **Function** | `data_processor.calculate_deg_heatmaps()` |

**What it does:** Selects significant DEGs, normalises expression values, and returns a matrix ready for hierarchical-clustered heatmap rendering.

**Pipeline:**
1. Filter DEGs: padj < 0.05 **and** |logFC| > **1.0** (stricter than volcano threshold)
2. Separate up-regulated vs. down-regulated genes
3. **Z-score normalisation** per gene: `z = (x − μ) / σ`
4. **Scale rows to [−1, 1]**: `z_scaled = z / max(|z|)` per gene
5. Sort genes: up-regulated block first (descending logFC), then down-regulated block

**Packages:** `pandas`, `numpy`

---

### 8 · Hierarchical Clustering

| | |
|---|---|
| **Endpoint** | `POST /api/v1/datasets/{id}/cluster` (`method` ≠ `kmeans`) |
| **Function** | `clustering_service.perform_clustering()` |

**Algorithm:** Agglomerative hierarchical clustering producing a dendrogram with reordered leaves.

**Packages & method:**

| Package | Role |
|---------|------|
| `fastcluster` | Optimised linkage (especially Ward + Euclidean) |
| `scipy.cluster.hierarchy` | Linkage (fallback), dendrogram cut, leaf ordering |
| `scipy.spatial.distance.pdist` | Pairwise distance matrix (for non-Euclidean metrics) |
| `numpy` | Matrix operations |

**Linkage methods:** `ward`, `average`, `complete`, `single`

**Distance metrics:** `euclidean`, `manhattan`, `correlation`, `cosine`

> Note: Ward linkage requires Euclidean distance (enforced with validation).

**Pre-processing:**
- Z-score per gene: `(x − μ) / σ`; NaN/Inf → imputed with gene mean
- Downsampling if genes > `max_genes_for_clustering` (default 2 000): top N by variance

---

### 9 · K-means Clustering

| | |
|---|---|
| **Endpoint** | `POST /api/v1/datasets/{id}/cluster` (`method=kmeans`) |
| **Function** | `clustering_service.perform_clustering()` |

**Algorithm:** Lloyd's algorithm with automatic k selection via silhouette score.

**Packages & method:**

| Package | Role |
|---------|------|
| `sklearn.cluster.KMeans` | Clustering |
| `sklearn.metrics.silhouette_score` | Cluster cohesion metric for k selection |
| `numpy` | Matrix operations |

**Parameters:**
| Parameter | Value |
|-----------|-------|
| Auto k range | 2 … min(10, n_genes − 1) |
| Auto k default | `min(10, n_genes // 10)` |
| `n_init` | 10 (random restarts) |
| `random_state` | 42 |

---

### 10 · Silhouette Profile (k optimisation)

| | |
|---|---|
| **Endpoint** | `GET /api/v1/datasets/{id}/clustering-quality` |
| **Function** | `clustering_service.compute_silhouette_profile()` |

**What it does:** Tests every integer k from 2 to min(10, n_genes − 1) with K-means, computes the silhouette score, and returns the full profile plus the recommended k (highest score).

**Silhouette score formula:**
```
s(i) = (b(i) − a(i)) / max(a(i), b(i))
```
where `a(i)` = mean intra-cluster distance, `b(i)` = mean nearest-cluster distance. Score ∈ [−1, 1]; higher = better-defined clusters.

**Package:** `sklearn.metrics.silhouette_score`

---

### 11 · Gene Ontology Enrichment

| | |
|---|---|
| **Endpoints** | `GET /api/v1/ontology/search` · `GET /api/v1/ontology/term/{go_id}` |
| **Function** | `go_service.go_enrichment_analysis()` |

**Algorithm:** Hypergeometric over-representation test (one-tailed Fisher's exact equivalent).

**Test formula:**
```
P(X ≥ k) = hypergeom.sf(k − 1, N, K, n)
```
| Symbol | Meaning |
|--------|---------|
| N | Total genes in background |
| K | Background genes annotated to this GO term |
| n | Study gene list size |
| k | Study genes annotated to this GO term |

**Multiple testing correction:** Benjamini-Hochberg FDR
```
padj = pvalue × m / rank    (with monotonicity constraint)
```

**Annotation propagation:** True-path rule — if a gene is annotated to a term, it is also considered annotated to all ancestor terms (via BFS over `is_a` + `part_of` relationships).

**Packages:**

| Package | Role |
|---------|------|
| `scipy.stats.hypergeom` | Survival function for one-tailed test |
| `sqlalchemy` | GO term + annotation DB queries |
| `collections.deque` | BFS ancestor/descendant traversal |

**Namespaces:** `BP` (biological_process) · `MF` (molecular_function) · `CC` (cellular_component)

**Filters:**
| Parameter | Default |
|-----------|---------|
| `min_gene_count` | 5 |
| `max_gene_count` | 500 |
| `pvalue_threshold` | 0.05 |

---

### 12 · Gene Set Enrichment Analysis (GSEA)

| | |
|---|---|
| **Endpoint** | `POST /api/v1/datasets/{id}/gsea` |
| **Results** | `GET /api/v1/datasets/{id}/comparisons/{name}/gsea-results` |
| **Enrichment plot** | `GET /api/v1/datasets/{id}/gsea/{gene_set}/enrichment-plot` |
| **Function** | `gsea_processor.run_gsea()` |

**Algorithm:** Subramanian et al. (2005) running-sum enrichment score with permutation-based null distribution.

**Ranking metrics (user selects one):**
| Metric | Formula |
|--------|---------|
| `log_fc` | log₂FC directly |
| `signed_pvalue` | `−log₁₀(max(padj, 1e-300)) × sign(logFC)` |
| `signal2noise` | `logFC / (stderr + 1e-10)` |

**Enrichment score calculation:**
- Genes ranked in descending order of metric
- Running sum: `+abs(metric)^power / Nr` for hits, `−1 / (N − Nh)` for misses
- ES = max absolute deviation from zero

**Normalised enrichment score:**
```
NES = ES / mean(null ES)    (positive and negative NES normalised separately)
```

**Null distribution:** 1 000 phenotype permutations (metric values shuffled).

**FDR:** Benjamini-Hochberg applied separately to positive and negative NES.

**Packages:** `numpy`, `pandas`, `dataclasses`

**Gene set size filters:**
| Parameter | Default |
|-----------|---------|
| `min_size` | 15 |
| `max_size` | 500 |
| `power` | 1.0 |
| `n_permutations` | 1 000 |

---

### 13 · Pathway Enrichment Dotplot

| | |
|---|---|
| **Endpoint** | `GET /api/v1/datasets/{id}/enrichment-dotplots` |
| **Function** | `data_processor.calculate_enrichment_dotplots()` |

**What it does:** Computes display-ready data for a bubble/dot chart where each pathway is a dot.

**Computed values:**
| Field | Formula |
|-------|---------|
| `gene_ratio` | `r / rExpected` (observed vs. expected gene overlap) |
| `neg_log10_p` | `−log₁₀(pvalue)` (y-axis or colour) |
| `dot_size` | Raw gene count `r` |

**Packages:** `pandas`, `numpy`

---

### 14 · STRING Protein–Protein Interaction Network

| | |
|---|---|
| **Endpoint (network)** | `POST /api/v1/integrations/string/network` |
| **Endpoint (partners)** | `POST /api/v1/integrations/string/partners` |
| **Endpoint (enrichment)** | `POST /api/v1/integrations/string/enrichment` |
| **Service** | `external_integrations.StringDBService` |

**External API:** STRING DB v12 (`string-db.org`)

**Parameters:**
| Parameter | Default | Range |
|-----------|---------|-------|
| `species` | 9606 (human) | NCBI taxon ID |
| `required_score` | 400 | 0 – 1000 |
| `limit` | 10 (partners) | — |
| `max_genes` | 100 | — |

**Evidence confidence levels:**
| Score | Level |
|-------|-------|
| ≥ 900 | Highest |
| ≥ 700 | High |
| ≥ 400 | Medium |
| < 400 | Low |

**Timeout:** 15 s per request (`httpx.AsyncClient`)

---

### 15 · NCBI GEO Dataset Search

| | |
|---|---|
| **Endpoint** | `GET /api/v1/integrations/geo/search?q={query}&db={db}&max_results={n}` |
| **Service** | `external_integrations.GEOService` |

**External API:** NCBI eUtils (`esearch` + `esummary`)

**Parameters:**
| Parameter | Options |
|-----------|---------|
| `db` | `gds` (GEO DataSets, default) or `geo` (GEO Series) |
| `max_results` | 1 – 100 |

**Response fields:** GEO accession, title (≤ 500 chars), summary (≤ 400 chars), organism, sample count, platform.

**Package:** `httpx.AsyncClient` (15 s timeout)

---

### 16 · Network Export (Cytoscape)

| | |
|---|---|
| **Endpoint (CX2)** | `POST /api/v1/integrations/cytoscape/cx2` |
| **Endpoint (GraphML)** | `POST /api/v1/integrations/cytoscape/graphml` |
| **Endpoint (cytoscape.js)** | `POST /api/v1/integrations/cytoscape/cytoscapejs` |
| **Service** | `external_integrations.CytoscapeExporter` |

**Output formats:**
| Format | Use case |
|--------|---------|
| CX2 | Cytoscape 3.9+ native import |
| GraphML | Standard XML graph exchange |
| cytoscape.js | Client-side rendering in web apps |

---

### 17 · DESeq2 Self-Service Analysis

| | |
|---|---|
| **Endpoint** | `POST /api/v1/analyses` |
| **Status** | `GET /api/v1/analyses/{id}` |
| **Background task** | `run_self_service_analysis` (Celery queue: `r_analysis`) |

**What it does:** Runs a full DESeq2 differential expression analysis on a raw count matrix via a dedicated R worker.

**Statistical model:** Negative binomial GLM with variance-mean dependence estimated by DESeq2's `estimateSizeFactors` + `estimateDispersions`.

**User-configurable parameters:**
| Parameter | Default | Range |
|-----------|---------|-------|
| `design` | `auto` | `auto`, `condition`, `batch_condition` |
| `fdr` | 0.05 | 0.001 – 0.5 |
| `min_log2fc` | 0.58 | 0 – 10 |
| `min_reads` | 0 | ≥ 0 |
| `min_genes` | 0 | ≥ 0 |
| `min_count` | 1 | ≥ 1 |
| `min_reps` | 1 | ≥ 1 |
| `threads` | 1 | 1 – 8 |
| `enrichment_databases` | null | list of DB names |

**Time limits:** soft 55 min, hard 60 min

---

### 18 · AI Biological Interpretation

| | |
|---|---|
| **Endpoint (sync)** | `POST /api/v1/datasets/{id}/ai/interpret` |
| **Endpoint (streaming)** | `POST /api/v1/datasets/{id}/ai/interpret-stream` |
| **Endpoint (Q&A)** | `POST /api/v1/datasets/{id}/ai/ask[-stream]` |
| **History** | `GET /api/v1/datasets/{id}/ai/conversations` |
| **Service** | `ai_interpreter.py` |

**Infrastructure:** Local [Ollama](https://ollama.com/) instance — no data leaves the server.

**Model fallback chain (lightest → heaviest):**
| Priority | Model | Size |
|----------|-------|------|
| 1 (default) | `llama3.2:3b` | ~2 GB |
| 2 | `llama3.1:8b` | ~8 GB |
| 3 | `biomistral` | ~4.1 GB (biomedical specialist) |

**Generation parameters:**
| Parameter | Value |
|-----------|-------|
| `temperature` | 0.3 |
| `top_p` | 0.9 |
| `num_predict` | 600 (comparison) / 400 (chart) |
| `num_ctx` | 1 024 |

**Retry:** exponential back-off, max 3 attempts; timeout 600 s.

**Supported chart types:** `volcano`, `pca`, `umap`, `heatmap`, `enrichment`

---

### 19 · Cache Layer

| | |
|---|---|
| **Service** | `cache_service.py` |
| **Backends** | Redis (persistent TTL) + in-memory LRU (hot DataFrames) |

**Redis TTLs:**
| Data type | TTL |
|-----------|-----|
| Clustering result | 1 hour (3 600 s) |
| Volcano plot | 2 hours (7 200 s) |
| DEG statistics | 24 hours (86 400 s) |

**In-memory LRU:**
- Capacity: 5 DataFrames (`MAX_CACHED_DATASETS` setting)
- Eviction: LRU (oldest evicted on overflow)
- Key: MD5 of `{dataset_id}` for DataFrame; MD5 of JSON `{args, sorted_kwargs}` for Redis keys

**Behaviour on Redis unavailability:** silently degraded (logs warning, returns `None` → recomputes).

---

## Summary Table

| # | Step | Endpoint | Package | Method | Key threshold |
|---|------|----------|---------|--------|---------------|
| 1 | ETL / Parquet | `POST /datasets/upload` | pandas, pyarrow | Chunked read → Parquet | — |
| 2 | Metadata extraction | (Celery task) | pandas | Column prefix pattern matching | — |
| 3 | PCA | `GET /datasets/{id}/pca` | sklearn | PCA + StandardScaler | n_components = 2 or 3 |
| 4 | UMAP | `GET /datasets/{id}/umap` | umap-learn | UMAP manifold | n_neighbors=15, min_dist=0.1 |
| 5 | Volcano plot | `GET /datasets/{id}/volcano-plot/{comp}` | pandas, numpy | Stratified downsampling | max 5 000 pts, padj < 0.05 |
| 6 | DEG statistics | `GET /datasets/{id}/comparisons/stats` | pandas | Threshold filtering | padj < 0.05, \|logFC\| > 0.58 |
| 7 | Heatmap | `GET /datasets/{id}/heatmaps` | pandas, numpy | Z-score → scale [−1,1] | padj < 0.05, \|logFC\| > 1.0 |
| 8 | Hierarchical clustering | `POST /datasets/{id}/cluster` | fastcluster, scipy | Agglomerative + dendrogram | Ward/Euclidean default |
| 9 | K-means | `POST /datasets/{id}/cluster` | sklearn | K-means (Lloyd) | Auto k via silhouette |
| 10 | Silhouette profile | `GET /datasets/{id}/clustering-quality` | sklearn | silhouette_score | k = 2 … 10 |
| 11 | GO enrichment | `GET /ontology/…` | scipy.stats | Hypergeometric test + BH FDR | padj < 0.05, min 5 genes/term |
| 12 | GSEA | `POST /datasets/{id}/gsea` | numpy, pandas | Running-sum ES + permutation | 1 000 permutations, NES |
| 13 | Enrichment dotplot | `GET /datasets/{id}/enrichment-dotplots` | pandas | GeneRatio = r / rExpected | — |
| 14 | STRING PPI | `POST /integrations/string/network` | httpx | STRING v12 REST API | score ≥ 400 |
| 15 | GEO search | `GET /integrations/geo/search` | httpx | NCBI eUtils | — |
| 16 | Cytoscape export | `POST /integrations/cytoscape/cx2` | — | CX2 / GraphML / JSON | — |
| 17 | DESeq2 | `POST /analyses` | R (DESeq2) | Negative binomial GLM | FDR 0.05, \|logFC\| > 0.58 |
| 18 | AI interpretation | `POST /datasets/{id}/ai/interpret` | Ollama | Local LLM generation | temp=0.3, 3 retries |
| 19 | Cache | transparent | Redis, cachetools | LRU + Redis TTL | volcano 2 h, stats 24 h |

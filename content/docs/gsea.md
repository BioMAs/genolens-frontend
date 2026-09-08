---
title: Gene Set Enrichment Analysis
description: Rank-based enrichment across whole gene sets, without a cutoff.
category: enrichment
order: 20
---

# Gene Set Enrichment Analysis (GSEA) Integration

## Overview

Gene Set Enrichment Analysis (GSEA) is a computational method that determines whether a priori defined sets of genes show statistically significant, concordant differences between two biological states. Unlike traditional enrichment approaches that use only significantly differentially expressed genes, GSEA considers all genes ranked by their expression changes.

**Key Advantages of GSEA:**
- ✅ Uses entire ranked gene list (not just significant DEGs)
- ✅ Detects coordinated changes in gene sets
- ✅ More sensitive to subtle but consistent changes
- ✅ Identifies biological themes even when individual genes show modest changes
- ✅ Provides normalized enrichment scores (NES) for comparison across datasets

**Reference**: Subramanian et al. (2005) "Gene set enrichment analysis: A knowledge-based approach for interpreting genome-wide expression profiles." PNAS 102(43):15545-15550

---

## Quick Start

### Running Your First GSEA

1. **Navigate to a comparison** with DEG data
2. **Click "GSEA" tab** (next to DEG, Volcano Plot, etc.)
3. **Configure settings** (or use defaults):
   - Gene Set Database: GO Biological Process
   - Ranking Metric: Signed P-value
   - FDR Threshold: 0.25
4. **Click "Run GSEA"**
5. **Wait** for analysis to complete (typically 30-60 seconds)
6. **Browse results** in the interactive table
7. **Click eye icon** to view enrichment plot for any gene set

### Expected Results

For a typical differential expression comparison, you should see:
- 10-50 significantly enriched gene sets (FDR ≤ 0.25)
- Mix of positive and negative enrichment
- Enrichment plots showing clear peaks/valleys
- Leading edge genes identified

---

## Configuration Options

### Gene Set Databases

| Database | Description | Gene Sets | Use When |
|----------|-------------|-----------|----------|
| **GO Biological Process** | Gene Ontology biological processes | ~5,000 | General pathway analysis |
| **GO Molecular Function** | Gene Ontology molecular functions | ~1,000 | Studying protein functions |
| **GO Cellular Component** | Gene Ontology cellular locations | ~500 | Studying subcellular localization |
| **KEGG Pathways** | Kyoto Encyclopedia of pathways | ~300 | Metabolism, signaling pathways |
| **Reactome** | Curated pathway database | ~2,000 | Detailed pathway mechanisms |
| **MSigDB Hallmark** | Well-defined biological states/processes | 50 | High-level biological themes |

**Recommendation**: Start with GO Biological Process for broad analysis, then use KEGG or Reactome for specific pathway investigation.

### Ranking Metrics

The ranking metric determines how genes are ordered before GSEA analysis:

#### 1. Signed P-value (Recommended)
```
metric = -log10(padj) × sign(log_fc)
```

**Pros**:
- Incorporates both significance and direction
- Highly significant genes rank at extremes
- Most commonly used in GSEA

**Use when**: Standard differential expression analysis

**Example**:
- Gene with padj=0.001, logFC=2.0 → metric = 3.0
- Gene with padj=0.001, logFC=-2.0 → metric = -3.0

#### 2. Log2 Fold Change
```
metric = log_fc
```

**Pros**:
- Simple, intuitive
- Emphasizes magnitude of change

**Use when**: You want to focus on effect size over significance

**Example**:
- Gene with logFC=3.0 → metric = 3.0 (regardless of p-value)

#### 3. Signal to Noise
```
metric = log_fc / stderr
```

**Pros**:
- Accounts for variability
- Similar to t-statistic

**Use when**: You have standard error data and want to consider measurement precision

### Analysis Parameters

#### Min/Max Gene Set Size

**Default**: 15-500 genes

**Rationale**:
- **Too small** (<15): Unreliable statistics, noise
- **Too large** (>500): Overly broad themes, diluted signal

**Adjust when**:
- Increase min (e.g., 30) for more stringent analysis
- Decrease max (e.g., 200) to focus on specific processes
- Increase max (e.g., 1000) to include broader categories

#### Number of Permutations

| Setting | Permutations | Accuracy | Speed | Use Case |
|---------|--------------|----------|-------|----------|
| Fast | 100 | Low | Very fast | Quick exploration |
| Standard | 1000 | Good | Moderate | Routine analysis |
| High | 5000 | High | Slow | Publication |
| Maximum | 10000 | Highest | Very slow | Critical findings |

**Recommendation**: Use 1000 for standard analysis. Increase to 5000-10000 for publication-quality results.

**Performance**:
- 100 permutations: ~10 seconds
- 1000 permutations: ~30-60 seconds
- 10000 permutations: ~5-10 minutes

#### FDR Threshold

Controls which results are displayed as significant:

| Threshold | Stringency | Typical Results | Use Case |
|-----------|------------|-----------------|----------|
| 0.05 | Very stringent | 5-20 gene sets | High-confidence findings |
| 0.10 | Stringent | 10-30 gene sets | Standard publication |
| 0.25 | Standard | 20-50 gene sets | Exploratory analysis |
| 0.50 | Permissive | 50-100 gene sets | Hypothesis generation |

**Note**: FDR (False Discovery Rate) controls for multiple testing. FDR=0.25 means 25% of results may be false positives.

---

## Interpreting Results

### GSEA Results Table

**Columns Explained**:

1. **Gene Set**: Name of the biological process/pathway
2. **Size**: Number of genes in the set
3. **ES (Enrichment Score)**: Maximum deviation from zero in running sum
   - Range: -1 to +1
   - Sign indicates enrichment direction
4. **NES (Normalized Enrichment Score)**: ES normalized for gene set size
   - More comparable across gene sets
   - **Positive NES**: Enriched in upregulated genes
   - **Negative NES**: Enriched in downregulated genes
5. **P-value**: Nominal p-value from permutation test
6. **FDR q-value**: False discovery rate adjusted p-value
   - **< 0.05**: Highly significant
   - **< 0.25**: Significant (standard threshold)
7. **Leading Edge**: Top genes contributing to enrichment

### Enrichment Plot

The enrichment plot shows:

**Top Panel - Running Enrichment Score**:
- X-axis: Ranked gene list (left=high, right=low)
- Y-axis: Running enrichment score
- Line: Cumulative enrichment as you walk down the ranked list
- Peak/Valley: Point of maximum enrichment

**Bottom Panel - Gene Hits**:
- Vertical black lines: Positions where gene set members appear
- Clustering at one end = strong enrichment

**Interpretation Guide**:

| Pattern | Meaning | Example |
|---------|---------|---------|
| Peak on left, genes clustered left | Strong enrichment in upregulated genes | Immune response in infection |
| Valley on right, genes clustered right | Strong enrichment in downregulated genes | Cell cycle in differentiation |
| Gradual rise/fall | Weak but consistent enrichment | Metabolic shift |
| Multiple peaks | Mixed regulation | Complex pathway |
| Flat line | No enrichment | Unrelated gene set |

### Leading Edge Genes

**Definition**: Subset of genes in the gene set that appear before the enrichment peak.

**Why important**:
- These genes drive the enrichment signal
- Represent the core members most relevant to your phenotype
- Good candidates for follow-up studies

**Core Enrichment**: Intersection of leading edge and gene set members.

---

## Use Cases

### Use Case 1: Standard Pathway Analysis

**Scenario**: You have upregulated genes in treated vs. control and want to know which pathways are activated.

**Steps**:
1. Database: GO Biological Process
2. Ranking: Signed P-value
3. Run GSEA
4. Look for positive NES with FDR < 0.25
5. Examine leading edge genes

**Expected Results**: Pathways like "immune response", "inflammatory response", "cytokine signaling"

---

### Use Case 2: Comparing Treatment Effects

**Scenario**: You want to compare which pathways are affected differently by DrugA vs. DrugB.

**Steps**:
1. Run GSEA on DrugA_vs_Control
2. Run GSEA on DrugB_vs_Control
3. Compare NES values for same pathways
4. Identify unique vs. shared enrichments

**Analysis**:
- Pathways enriched in both: Common mechanism
- Pathways enriched only in DrugA: Drug-specific effect
- Opposite NES signs: Antagonistic effects

---

### Use Case 3: Time Series Analysis

**Scenario**: Time course experiment (0h, 6h, 12h, 24h) - identify temporal patterns.

**Steps**:
1. Run GSEA for each time point vs. baseline
2. Track NES over time for key pathways
3. Identify early vs. late responding pathways

**Patterns**:
- **Early response**: NES peaks at 6h
- **Sustained response**: NES remains high
- **Late response**: NES increases over time
- **Transient response**: NES peaks then returns to baseline

---

### Use Case 4: Identifying Subtle Phenotypes

**Scenario**: Few DEGs (padj < 0.05) but you suspect biological changes.

**Why GSEA helps**:
- Uses all genes, not just significant ones
- Detects coordinated changes
- More sensitive to modest but consistent effects

**Steps**:
1. Use ranked gene list (all genes, not filtered)
2. Lower FDR threshold to 0.25-0.50 for exploration
3. Look for consistent patterns across related gene sets

---

## Advanced Features

### Filtering and Sorting

**Filter by enrichment direction**:
- Positive NES only: Upregulated pathways
- Negative NES only: Downregulated pathways

**Sort by**:
- FDR q-value: Most significant first
- NES: Strongest enrichment first
- Gene set size: Largest/smallest sets

**Search**:
- Type keywords to find specific pathways
- Examples: "immune", "metabolism", "DNA"

### Export Options

**CSV Export**:
- All columns included
- Leading edge genes (top 5)
- Can be opened in Excel or analyzed programmatically

**Format**:
```csv
Gene Set,Size,ES,NES,P-value,FDR q-value,Leading Edge
GO_IMMUNE_RESPONSE,245,0.652,2.134,0.001,0.023,"IL6, TNF, IL1B, CCL2, CXCL10"
```

---

## Troubleshooting

### No Significant Results (FDR > 0.25)

**Possible Causes**:
1. Weak biological signal
2. Wrong ranking metric
3. Gene set database not relevant
4. Too few permutations

**Solutions**:
- Increase FDR threshold to 0.50 (exploratory)
- Try different ranking metric
- Use different gene set database
- Check if enough DEGs exist
- Increase permutations to 5000

### Analysis Takes Too Long

**Causes**:
- Too many permutations
- Large gene set database
- Many genes in comparison

**Solutions**:
- Reduce permutations to 100 for quick test
- Use smaller gene set database (e.g., Hallmark)
- Ensure backend has enough resources

### Unexpected Enrichment Patterns

**Debugging**:
1. Check ranked gene list quality:
   - Are top genes reasonable?
   - Is ranking metric appropriate?
2. Examine enrichment plot:
   - Where is peak located?
   - Are genes clustered or dispersed?
3. Review leading edge genes:
   - Do they make biological sense?
   - Are they truly associated with phenotype?

### Leading Edge Genes Don't Make Sense

**Possible Issues**:
1. Gene set definition outdated
2. Gene set too broad
3. Batch effects in data
4. Technical artifacts

**Verify**:
- Check gene set source and date
- Look for narrower, more specific gene sets
- Review QC metrics of original data
- Validate with external databases

---

## Best Practices

### 1. Pre-Analysis Checklist

✅ Ensure DEG analysis is complete
✅ Check for sufficient genes (>5000 recommended)
✅ Verify ranking metric is appropriate
✅ Choose relevant gene set database
✅ Set appropriate FDR threshold

### 2. Interpreting Significance

**FDR Interpretation**:
- **< 0.05**: High confidence, ready for publication
- **0.05-0.10**: Moderate confidence, validate with other data
- **0.10-0.25**: Exploratory findings, hypothesis-generating
- **> 0.25**: Weak evidence, interpret cautiously

**NES Interpretation**:
- **|NES| > 2.0**: Strong enrichment
- **|NES| 1.5-2.0**: Moderate enrichment
- **|NES| 1.0-1.5**: Weak enrichment
- **|NES| < 1.0**: Very weak, may not be meaningful

### 3. Validation Strategies

**Computational Validation**:
1. Run with different ranking metrics - results should be consistent
2. Use different gene set databases - look for overlapping themes
3. Increase permutations - FDR should remain stable

**Experimental Validation**:
1. RT-qPCR on leading edge genes
2. Western blot for key pathway proteins
3. Functional assays for pathway activity

### 4. Reporting Results

**Minimal Information to Report**:
- Gene set database used
- Ranking metric
- Number of permutations
- FDR threshold
- Number of significant gene sets
- Top enriched pathways (table)
- Enrichment plots for key findings

**Example Results Section**:
```
GSEA was performed using the GO Biological Process database
with genes ranked by signed p-value (-log10(padj) × sign(logFC)).
We used 1000 permutations and FDR threshold of 0.25.
Out of 4,436 gene sets tested, 37 were significantly enriched
(FDR < 0.25), including immune response pathways (NES=2.34, FDR=0.012)
and cytokine signaling (NES=2.18, FDR=0.018).
```

---

## Technical Details

### Algorithm Overview

**GSEA Steps**:

1. **Rank genes** by chosen metric (e.g., signed p-value)
2. **For each gene set**:
   - Walk down ranked list
   - Increment score when hit gene in set (weighted by metric)
   - Decrement when hit gene not in set
   - Record maximum deviation (ES)
3. **Permute** phenotype labels, recalculate ES
4. **Build null distribution** from permuted ES values
5. **Normalize ES** by mean of null distribution → NES
6. **Calculate p-value**: Proportion of null ES ≥ observed ES
7. **Adjust for multiple testing** → FDR q-value

### Performance Characteristics

**Computational Complexity**:
- Time: O(G × S × P)
  - G = number of genes
  - S = number of gene sets
  - P = number of permutations
- Space: O(G + S)

**Typical Performance**:
- 10,000 genes × 5,000 gene sets × 1000 perms ≈ 30-60 seconds
- Parallelizable across gene sets (future optimization)

### Database Integration

**Gene Sets Storage**:
- Gene sets stored in `gene_sets` table
- Indexed by database, organism, and size
- Support for multiple databases (GO, KEGG, MSigDB, etc.)
- Version tracking for gene set updates

**Performance**:
- Uses `deg_genes` table for fast DEG retrieval
- SQL queries optimized with composite indexes
- Gene set filtering by size at database level

**Loading Gene Sets**:
See [Loading Gene Sets from Database](#loading-gene-sets-from-database) section below for setup instructions.

**Fallback Behavior**:
- If no gene sets found in database, uses placeholder gene sets
- Allows testing GSEA functionality before loading production data
- Warning logged when using placeholders

---

## API Reference

### Run GSEA Analysis

**Endpoint**: `POST /datasets/{dataset_id}/gsea`

**Request Body**:
```json
{
  "comparison_name": "Treated_vs_Control",
  "gene_set_database": "GO_BP",
  "ranking_metric": "signed_pvalue",
  "min_size": 15,
  "max_size": 500,
  "n_permutations": 1000,
  "fdr_threshold": 0.25
}
```

**Response**:
```json
{
  "dataset_id": "uuid",
  "comparison_name": "Treated_vs_Control",
  "parameters": {...},
  "summary": {
    "total_genes": 15234,
    "total_gene_sets_tested": 4436,
    "significant_gene_sets": 37,
    "enriched_in_phenotype_pos": 22,
    "enriched_in_phenotype_neg": 15
  },
  "results": [
    {
      "gene_set_name": "GO_IMMUNE_RESPONSE",
      "gene_set_size": 245,
      "enrichment_score": 0.652,
      "normalized_enrichment_score": 2.134,
      "p_value": 0.001,
      "fdr_q_value": 0.023,
      "leading_edge_genes": ["IL6", "TNF", "IL1B"],
      "core_enrichment": ["IL6", "TNF", "IL1B", "CCL2"]
    }
  ]
}
```

### Get Enrichment Plot Data

**Endpoint**: `GET /datasets/{dataset_id}/gsea/{gene_set_name}/enrichment-plot`

**Query Parameters**:
- `comparison_name` (required)
- `ranking_metric` (optional, default: signed_pvalue)

**Response**:
```json
{
  "gene_set_name": "GO_IMMUNE_RESPONSE",
  "enrichment_score": 0.652,
  "running_enrichment_scores": [0, 0.02, 0.05, ..., 0.01],
  "gene_positions": [12, 45, 67, 89, ...],
  "ranked_genes": ["GENE1", "GENE2", ...],
  "metrics": [5.2, 4.8, 4.5, ...],
  "gene_set_size": 245
}
```

---

## File Locations

### Backend
- **GSEA Processor**: `backend/app/services/gsea_processor.py`
- **API Endpoints**: `backend/app/api/endpoints/datasets.py` (lines 1457-1643)

### Frontend
- **Main Component**: `frontend/src/components/GSEAAnalysis.tsx`
- **Results Table**: `frontend/src/components/GSEATable.tsx`
- **Enrichment Plot**: `frontend/src/components/GSEAEnrichmentPlot.tsx`

### Documentation
- **User Guide**: `docs/GSEA_INTEGRATION.md` (this file)

---

## Loading Gene Sets from Database

### Overview

GenoLens v2 stores gene sets in a dedicated `gene_sets` database table for fast retrieval during GSEA analysis. Gene sets must be loaded from GMT (Gene Matrix Transposed) files before running production GSEA analyses.

**Note**: GenoLens includes placeholder gene sets for testing. For production use, you must load real gene sets from MSigDB, GO, KEGG, or other sources.

### Quick Setup

1. **Download gene set files** (see [Downloading Gene Sets](#downloading-gene-sets))
2. **Run the loader script**:

```bash
cd backend
python scripts/load_gene_sets.py \
  --file data/h.all.v2024.1.Hs.symbols.gmt \
  --database HALLMARK \
  --version 2024.1
```

3. **Verify loading**:

```bash
python scripts/load_gene_sets.py --stats
```

### Downloading Gene Sets

#### MSigDB (Recommended)

MSigDB is the most comprehensive gene set resource.

1. **Register** at https://www.gsea-msigdb.org/gsea/register.jsp
2. **Download** from https://www.gsea-msigdb.org/gsea/msigdb/collections.jsp
3. Choose **"Human Gene Symbols"** format (.gmt files)

**Recommended Collections**:

| Collection | File | Gene Sets | Description |
|------------|------|-----------|-------------|
| **Hallmark** | h.all.v2024.1.Hs.symbols.gmt | ~50 | Well-defined biological states |
| **C2: Curated** | c2.all.v2024.1.Hs.symbols.gmt | ~6,000 | KEGG, Reactome, BioCarta |
| **C5: GO** | c5.all.v2024.1.Hs.symbols.gmt | ~10,000 | Gene Ontology terms |
| **C6: Oncogenic** | c6.all.v2024.1.Hs.symbols.gmt | ~200 | Cancer signatures |

**Individual Subsets**:
- `c5.go.bp.*.gmt` - GO Biological Process only
- `c5.go.mf.*.gmt` - GO Molecular Function only
- `c5.go.cc.*.gmt` - GO Cellular Component only
- `c2.cp.kegg.*.gmt` - KEGG pathways only
- `c2.cp.reactome.*.gmt` - Reactome pathways only

#### Other Sources

**Gene Ontology**:
- Already included in MSigDB C5
- Direct download: http://geneontology.org/
- Requires conversion to GMT format

**KEGG Pathways**:
- Already included in MSigDB C2
- Direct access requires license

### Loading Gene Sets

#### Basic Usage

```bash
# Load Hallmark gene sets
python scripts/load_gene_sets.py \
  --file data/h.all.v2024.1.Hs.symbols.gmt \
  --database HALLMARK \
  --version 2024.1

# Load GO Biological Process
python scripts/load_gene_sets.py \
  --file data/c5.go.bp.v2024.1.Hs.symbols.gmt \
  --database GO_BP \
  --version 2024.1

# Load KEGG pathways
python scripts/load_gene_sets.py \
  --file data/c2.cp.kegg.v2024.1.Hs.symbols.gmt \
  --database KEGG \
  --version 2024.1
```

#### Replacing Existing Gene Sets

Use `--clear` to replace existing gene sets for a database:

```bash
python scripts/load_gene_sets.py \
  --file data/h.all.v2024.2.Hs.symbols.gmt \
  --database HALLMARK \
  --version 2024.2 \
  --clear
```

**⚠️ Warning**: `--clear` deletes all existing gene sets for the specified database and organism before loading.

#### Multiple Organisms

Load gene sets for different organisms:

```bash
# Human gene sets
python scripts/load_gene_sets.py \
  --file hallmark_human.gmt \
  --database HALLMARK \
  --organism "Homo sapiens"

# Mouse gene sets
python scripts/load_gene_sets.py \
  --file hallmark_mouse.gmt \
  --database HALLMARK \
  --organism "Mus musculus"
```

### Management Commands

#### View Statistics

```bash
python scripts/load_gene_sets.py --stats
```

Output:
```
📊 Gene Set Database Statistics:

Total gene sets: 15,234

  GO_BP                  5,243 ██████████████████████████████
  GO_MF                  1,024 ██████
  GO_CC                    576 ███
  KEGG                     326 ██
  REACTOME               2,165 ████████████
  HALLMARK                  50 █
```

#### Search Gene Sets

```bash
# Search across all databases
python scripts/load_gene_sets.py --search "TNFA"

# Search within specific database
python scripts/load_gene_sets.py --search "TNFA" --database HALLMARK
```

Output:
```
🔍 Search results for 'TNFA':
Found 3 gene sets:

  HALLMARK_TNFA_SIGNALING_VIA_NFKB
    Database: HALLMARK
    Size: 200 genes
    Description: Genes regulated by NF-kB in response to TNF

  GO_RESPONSE_TO_TUMOR_NECROSIS_FACTOR
    Database: GO_BP
    Size: 342 genes
    Description: Any process that results in a change in state...
```

### Recommended Setup

For a complete GSEA-ready installation:

```bash
# Create data directory
mkdir -p backend/data/genesets
cd backend/data/genesets

# Download MSigDB files (after registration)
# Place .gmt files here

# Return to backend directory
cd ../..

# Load essential gene sets
echo "Loading Hallmark gene sets..."
python scripts/load_gene_sets.py \
  --file data/genesets/h.all.v2024.1.Hs.symbols.gmt \
  --database HALLMARK \
  --version 2024.1

echo "Loading GO Biological Process..."
python scripts/load_gene_sets.py \
  --file data/genesets/c5.go.bp.v2024.1.Hs.symbols.gmt \
  --database GO_BP \
  --version 2024.1

echo "Loading GO Molecular Function..."
python scripts/load_gene_sets.py \
  --file data/genesets/c5.go.mf.v2024.1.Hs.symbols.gmt \
  --database GO_MF \
  --version 2024.1

echo "Loading GO Cellular Component..."
python scripts/load_gene_sets.py \
  --file data/genesets/c5.go.cc.v2024.1.Hs.symbols.gmt \
  --database GO_CC \
  --version 2024.1

echo "Loading KEGG pathways..."
python scripts/load_gene_sets.py \
  --file data/genesets/c2.cp.kegg.v2024.1.Hs.symbols.gmt \
  --database KEGG \
  --version 2024.1

echo "Loading Reactome pathways..."
python scripts/load_gene_sets.py \
  --file data/genesets/c2.cp.reactome.v2024.1.Hs.symbols.gmt \
  --database REACTOME \
  --version 2024.1

# Verify
python scripts/load_gene_sets.py --stats
```

### Database Schema

The `gene_sets` table stores:

```sql
CREATE TABLE gene_sets (
    id UUID PRIMARY KEY,
    name VARCHAR(500),              -- e.g., "HALLMARK_TNFA_SIGNALING_VIA_NFKB"
    database VARCHAR(50),            -- e.g., "HALLMARK", "GO_BP", "KEGG"
    description TEXT,                -- Human-readable description
    genes JSON,                      -- Array of gene symbols
    size INTEGER,                    -- Number of genes (denormalized)
    organism VARCHAR(100),           -- e.g., "Homo sapiens"
    version VARCHAR(50),             -- e.g., "2024.1"
    metadata JSON,                   -- Additional metadata
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Indexes for fast queries
CREATE INDEX ix_gene_sets_database_organism ON gene_sets(database, organism);
CREATE UNIQUE INDEX ix_gene_sets_name_database ON gene_sets(name, database);
CREATE INDEX ix_gene_sets_size ON gene_sets(size);
```

### Updating Gene Sets

Gene sets should be updated periodically:

- **GO terms**: Monthly releases
- **MSigDB**: 1-2 releases per year
- **KEGG**: Quarterly updates
- **Reactome**: Quarterly releases

**Update Workflow**:

1. Download new gene set files
2. Load with `--clear` flag to replace old versions
3. Update version number in `--version` parameter
4. Verify with `--stats` command

### Troubleshooting

**Problem**: "No gene sets found for GO_BP"

**Solution**: Load gene sets using the script:
```bash
python scripts/load_gene_sets.py --file c5.go.bp.gmt --database GO_BP
```

**Problem**: "File not found" error

**Solution**: Use absolute path or path relative to `backend/` directory:
```bash
python scripts/load_gene_sets.py --file /full/path/to/file.gmt --database GO_BP
```

**Problem**: GSEA returns no results

**Solutions**:
1. Check gene sets are loaded: `python scripts/load_gene_sets.py --stats`
2. Verify `min_size` and `max_size` match your gene set sizes
3. Check organism matches (default: "Homo sapiens")

**Problem**: Duplicate gene sets

**Solution**: Use `--clear` flag to remove old versions before loading:
```bash
python scripts/load_gene_sets.py --file new.gmt --database GO_BP --clear
```

### GMT File Format

GMT (Gene Matrix Transposed) format specification:

```
<name> <tab> <description> <tab> <gene1> <tab> <gene2> <tab> ...
```

**Example**:
```
HALLMARK_TNFA_SIGNALING_VIA_NFKB	http://...	ABCA1	ABI1	ACKR3	AREG	ATF3
GO_CELL_CYCLE	Cell cycle process	CDK1	CCNB1	CCNA2	CDC20	BUB1
KEGG_MAPK_PATHWAY	MAPK signaling pathway	MAPK1	MAPK3	RAF1	MAP2K1
```

**Creating Custom GMT Files**:

```python
# Example: Create custom gene set
with open('custom.gmt', 'w') as f:
    f.write('MY_GENE_SET\tMy description\tGENE1\tGENE2\tGENE3\n')
    f.write('ANOTHER_SET\tAnother description\tGENE4\tGENE5\n')

# Load into database
python scripts/load_gene_sets.py --file custom.gmt --database CUSTOM
```

### Additional Resources

- **Script Documentation**: `backend/scripts/README.md`
- **Gene Set Loader Service**: `backend/app/services/gene_set_loader.py`
- **Database Models**: `backend/app/models/models.py` (GeneSet class)

---

## Future Enhancements

Planned improvements:

1. **Gene Set Management**
   - Web interface for uploading custom gene sets
   - Auto-update from online sources (GO, KEGG, etc.)
   - Gene set versioning and changelog

2. **Performance**
   - Background processing with Celery for long analyses
   - Caching of GSEA results
   - Parallel permutation computation

3. **Advanced Features**
   - GSEA preranked (user provides ranked list)
   - Multi-comparison GSEA (compare across multiple conditions)
   - Gene set comparison (overlap analysis)
   - Export publication-ready plots (PNG, SVG)

4. **Integration**
   - Link to external databases (GeneCards, NCBI, etc.)
   - Pathway visualization (network graphs)
   - Integration with Cytoscape

5. **Usability**
   - Saved GSEA configurations
   - Batch GSEA across multiple comparisons
   - Download full GSEA report (PDF)

---

## References

### Key Publications

1. **Original GSEA Paper**:
   Subramanian et al. (2005) "Gene set enrichment analysis: A knowledge-based approach for interpreting genome-wide expression profiles." PNAS 102(43):15545-15550
   [DOI: 10.1073/pnas.0506580102](https://doi.org/10.1073/pnas.0506580102)

2. **MSigDB Database**:
   Liberzon et al. (2015) "The Molecular Signatures Database Hallmark Gene Set Collection." Cell Systems 1(6):417-425

3. **GO Database**:
   Gene Ontology Consortium (2021) "The Gene Ontology resource: enriching a GOld mine." Nucleic Acids Research

### External Resources

- **Broad Institute GSEA**: https://www.gsea-msigdb.org
- **MSigDB Gene Sets**: https://www.gsea-msigdb.org/gsea/msigdb
- **Gene Ontology**: http://geneontology.org
- **KEGG**: https://www.genome.jp/kegg
- **Reactome**: https://reactome.org

---

## Support

### Common Questions

**Q: How many genes do I need for GSEA?**
A: Minimum ~1000, ideally >5000. GSEA works best with whole-genome data.

**Q: What's the difference between GSEA and Over-Representation Analysis (ORA)?**
A: ORA uses only significant DEGs; GSEA uses all ranked genes and detects subtle coordinated changes.

**Q: Can I use GSEA with RNA-seq data?**
A: Yes! GSEA is ideal for RNA-seq as it considers all genes, not just significant ones.

**Q: How do I choose between GO_BP, GO_MF, and GO_CC?**
A: Start with BP (biological processes). Use MF for protein functions, CC for localization.

**Q: Why are my results different from the Broad Institute GSEA?**
A: Minor differences are normal due to permutation randomness. Increase permutations for stability.

### Getting Help

For issues or questions:
1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Review this documentation
3. Contact technical support with:
   - GSEA parameters used
   - Number of genes in comparison
   - Error messages (if any)
   - Expected vs. actual results

---

**Last Updated**: 2025-12-30
**Version**: GenoLens v2.0
**Feature Status**: ✅ Complete (Core GSEA + Database Gene Set Loading)


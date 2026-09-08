---
title: Multi-comparison analysis
description: Compare several comparisons at once to find common, unique and shared genes.
category: analysis
order: 20
---

# Multi-Comparison Analysis

## Overview

The Multi-Comparison Analysis feature allows you to compare multiple DEG (Differential Expression Gene) comparisons simultaneously to identify:
- **Common genes**: Genes differentially expressed across multiple conditions
- **Unique genes**: Genes differentially expressed in only one specific comparison
- **Complex intersections**: Genes shared between specific subsets of comparisons

This is particularly useful for:
- Finding core genes affected across all conditions
- Identifying condition-specific responses
- Understanding relationships between different experimental conditions
- Prioritizing genes for follow-up studies

---

## Accessing the Feature

### From Project Detail Page

1. Navigate to your project
2. Look for the **"Multi-Comparison"** button in the top-right header (next to "Data Management")
3. The button only appears when you have **2 or more comparisons** in your project

**Note**: The button will be hidden if you have less than 2 comparisons.

### Direct URL

You can also access the feature directly:
```
/projects/{project_id}/multi-comparison
```

---

## Using Multi-Comparison Analysis

### 1. Select Comparisons

- Check the boxes next to the comparisons you want to analyze
- You can select **2 to 5 comparisons** at a time
- The interface shows all available comparisons from your global DEG dataset

### 2. Adjust Thresholds (Optional)

Default thresholds are applied automatically:
- **Adjusted p-value (padj)**: ≤ 0.05
- **Log2 Fold Change (|logFC|)**: ≥ 0.58

You can modify these thresholds to make the analysis more or less stringent.

### 3. Analyze

Click the **"Analyze"** button to generate the visualization.

### 4. Visualization Types

The system automatically chooses the best visualization based on the number of comparisons:

#### Venn Diagram (2-3 comparisons)
- Clear circular representation
- Shows all possible intersections
- Interactive regions (click to view genes)
- Color-coded legend

**Example regions for 3 comparisons (A, B, C):**
- A only (unique to A)
- B only (unique to B)
- C only (unique to C)
- A ∩ B only (shared by A and B, but not C)
- A ∩ C only
- B ∩ C only
- A ∩ B ∩ C (shared by all three)

#### UpSet Plot (4-5 comparisons)
- Bar chart showing intersection sizes
- Connection matrix showing set membership
- Top 15 intersections by size
- More scalable than Venn diagrams

**Components:**
- **Bar chart** (top): Height represents number of genes in each intersection
- **Connection matrix** (middle): Dots show which comparisons are included
- **Set totals** (bottom): Total genes per comparison

---

## Exporting Gene Lists

### Individual Intersections

1. Click on any region in the Venn diagram or bar in the UpSet plot
2. A gene list will be displayed
3. Click **"Export Gene List"** to download as `.txt` file

### File Format

The exported file contains one gene ID per line:
```
ENSG00000139618
ENSG00000141510
ENSG00000134086
...
```

This format is compatible with most downstream analysis tools (enrichment analysis, pathway analysis, etc.).

---

## Technical Details

### Backend API

**Endpoint**: `POST /datasets/{dataset_id}/venn-analysis`

**Request Body**:
```json
{
  "comparisons": ["comparison_1", "comparison_2", "comparison_3"],
  "padj_threshold": 0.05,
  "logfc_threshold": 0.58
}
```

**Response**:
```json
{
  "sets": ["comparison_1", "comparison_2", "comparison_3"],
  "intersections": [
    {
      "sets": ["comparison_1"],
      "size": 150,
      "genes": ["ENSG00000139618", "..."]
    },
    {
      "sets": ["comparison_1", "comparison_2"],
      "size": 75,
      "genes": ["ENSG00000141510", "..."]
    }
  ]
}
```

### Data Processing

1. **Gene Filtering**: Genes are filtered from the `deg_genes` table based on:
   - `padj <= padj_threshold`
   - `ABS(log_fc) >= logfc_threshold`

2. **Set Operations**: Uses Python set theory for accurate calculations:
   - **Unique genes**: `genes_A - genes_B - genes_C - ...`
   - **Intersections**: `(genes_A ∩ genes_B) - other_sets`

3. **Performance**: Leverages indexed `deg_genes` table for fast queries (<100ms)

### Visualization Logic

**2 Comparisons (Venn)**:
- 2 overlapping circles
- 3 regions: A only, B only, A∩B

**3 Comparisons (Venn)**:
- 3 overlapping circles in triangle arrangement
- 7 regions: 3 unique + 3 pairwise + 1 triple intersection

**4-5 Comparisons (UpSet)**:
- Switches to UpSet plot for better readability
- Shows top 15 intersections by size
- Connection lines indicate set membership

---

## Requirements

### Dataset Requirements

The multi-comparison feature requires:
- A **global DEG dataset** with multiple comparisons
- The dataset must have `dataset_metadata.comparisons` with at least 2 entries

### How to Create a Global DEG Dataset

Upload a DEG file with a **contrast column** that groups genes by comparison:

**Example CSV**:
```csv
gene_id,log_fc,padj,contrast
ENSG00000139618,2.5,0.001,Treated_vs_Control
ENSG00000141510,1.8,0.01,Treated_vs_Control
ENSG00000134086,-1.2,0.03,DrugA_vs_Control
```

The system will automatically detect the contrast column and create a global DEG dataset.

---

## Use Cases

### 1. Finding Core Differentially Expressed Genes

**Scenario**: You have 3 different treatment conditions and want to find genes affected by all treatments.

**Steps**:
1. Select all 3 comparisons
2. Click "Analyze"
3. Look at the center region (3-way intersection) in the Venn diagram
4. Export this gene list for downstream analysis

### 2. Identifying Treatment-Specific Genes

**Scenario**: You want to find genes unique to DrugA treatment.

**Steps**:
1. Select DrugA_vs_Control and other comparisons
2. Click "Analyze"
3. Look at the "DrugA only" region
4. Export the unique gene list

### 3. Comparing Multiple Time Points

**Scenario**: You have time series data (T1, T2, T3, T4) and want to see how gene expression changes over time.

**Steps**:
1. Select all 4 time point comparisons
2. UpSet plot will show intersection patterns
3. Look for progressive patterns (genes appearing at later time points)
4. Export specific intersections of interest

---

## Troubleshooting

### "No multi-comparison DEG dataset found"

**Cause**: Your project doesn't have a global DEG dataset with multiple comparisons.

**Solution**:
- Upload a DEG file with a contrast column grouping multiple comparisons
- Or upload multiple individual DEG files (though global format is recommended)

### Multi-Comparison button is hidden

**Cause**: Your project has fewer than 2 comparisons.

**Solution**: Upload more DEG datasets to create additional comparisons.

### Analysis is slow

**Cause**: Very large gene sets or many comparisons selected.

**Expected Performance**:
- 2-3 comparisons: <1 second
- 4-5 comparisons: 1-3 seconds

If slower, check database indexes:
```sql
SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'deg_genes';
-- Should return 7
```

### Visualization looks cluttered

**Solution**:
- Use the UpSet plot for 4+ comparisons (automatic)
- Increase threshold stringency (higher padj, higher |logFC|) to reduce gene counts
- Focus on top intersections (UpSet shows top 15)

---

## Best Practices

### 1. Threshold Selection

- **Stringent** (padj ≤ 0.01, |logFC| ≥ 1.0): High-confidence genes only
- **Standard** (padj ≤ 0.05, |logFC| ≥ 0.58): Balanced sensitivity/specificity
- **Permissive** (padj ≤ 0.1, |logFC| ≥ 0.3): Exploratory analysis

### 2. Number of Comparisons

- **2-3 comparisons**: Use Venn diagram for intuitive visualization
- **4-5 comparisons**: UpSet plot handles complexity better
- **6+ comparisons**: Not recommended - too complex to interpret meaningfully

### 3. Export Strategy

- Export all intersections separately for comprehensive analysis
- Use file naming convention: `{intersection_name}_genes.txt`
- Import into enrichment tools (DAVID, Enrichr, etc.)

### 4. Biological Interpretation

- **Large 3-way+ intersections**: Core biological processes
- **Large unique sets**: Condition-specific mechanisms
- **Small intersections**: Potentially interesting but need validation

---

## Example Workflow

### Complete Analysis Example

**Research Question**: "What genes are commonly upregulated in cancer cell lines treated with 3 different drugs?"

**Steps**:

1. **Upload Data**:
   - Global DEG file with contrasts: DrugA_vs_DMSO, DrugB_vs_DMSO, DrugC_vs_DMSO

2. **Access Multi-Comparison**:
   - Navigate to project → Click "Multi-Comparison" button

3. **Configure Analysis**:
   - Select all 3 drug comparisons
   - Set thresholds: padj ≤ 0.05, logFC ≥ 1.0 (upregulated only in pre-filtering)
   - Click "Analyze"

4. **Review Venn Diagram**:
   - 7 regions displayed
   - Center region shows 45 genes common to all 3 drugs

5. **Export Common Genes**:
   - Click center region
   - Gene list displayed
   - Click "Export Gene List" → `common_all_drugs_genes.txt`

6. **Downstream Analysis**:
   - Import to Enrichr for pathway analysis
   - Identify common mechanisms (e.g., cell cycle arrest)

**Result**: Identified 45 core genes affected by all drug treatments, revealing shared mechanism of action.

---

## File Locations

### Frontend Components

- **Main component**: `frontend/src/components/MultiComparisonVenn.tsx`
- **Venn diagram**: `frontend/src/components/VennDiagram.tsx`
- **UpSet plot**: `frontend/src/components/UpSetPlot.tsx`
- **Page route**: `frontend/src/app/projects/[id]/multi-comparison/page.tsx`

### Backend API

- **Endpoint**: `backend/app/api/endpoints/datasets.py` (lines 1099-1228)
- **Function**: `venn_analysis()`

### Database

- **Table**: `deg_genes`
- **Indexes**: 7 indexes for optimized query performance

---

## Performance Metrics

| Operation | Expected Time | Notes |
|-----------|---------------|-------|
| API Query (2 comparisons) | <100ms | Indexed database queries |
| API Query (5 comparisons) | <500ms | More combinations to calculate |
| Venn rendering | <50ms | SVG-based, client-side |
| UpSet rendering | <100ms | Slightly more complex layout |
| Export gene list | <10ms | Simple text file generation |

---

## Future Enhancements

Potential improvements planned:

1. **Dynamic threshold adjustment**: Sliders in the UI to adjust thresholds without re-analysis
2. **Direction filtering**: Separate up/down regulated genes
3. **Enhanced export**: Export with gene annotations, fold changes
4. **Interactive legends**: Click legend to highlight specific sets
5. **Statistical testing**: Fisher's exact test for intersection significance
6. **6+ comparison support**: Hierarchical clustering for many comparisons

---

## References

### Venn Diagram Theory
- Set theory and Euler diagrams
- Maximum 3 sets for accurate proportional representation

### UpSet Plot
- **Publication**: Lex et al. (2014). "UpSet: Visualization of Intersecting Sets." IEEE TVCG
- Better scalability than Venn diagrams for 4+ sets
- Industry standard for complex set visualizations

### Gene Set Analysis
- DESeq2 thresholds: padj ≤ 0.05, |logFC| ≥ 0.58 (1.5× fold change)
- Multiple testing correction: Benjamini-Hochberg

---

**Last Updated**: 2025-12-30
**Version**: GenoLens v2.0
**Author**: GenoLens Team

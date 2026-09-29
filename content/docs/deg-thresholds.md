---
title: What counts as a differentially expressed gene
description: How significance and fold change combine, why thresholds can only be tightened, and why counts may differ between screens.
category: explore
order: 30
---

# What counts as a differentially expressed gene

A gene is called **differentially expressed** (a DEG) in a comparison when it passes two tests at the same time.

1. **It is significant.** Its **adjusted p-value (padj)** is below the threshold, 0.05 by default. The p-value is adjusted for multiple testing (Benjamini–Hochberg false discovery rate): with thousands of genes tested, raw p-values would produce hundreds of false positives. With padj < 0.05, you expect about 5% of your DEGs to be false positives.
2. **The change is large enough.** Its **|log2 fold change|** is above the threshold, 0.58 by default, which is a 1.5-fold change.

A gene is **up-regulated** when its log2 fold change is positive (higher in the test condition than in the reference) and **down-regulated** when it is negative.

## Reading log2 fold changes

| log2FC | Fold change | In words |
|---|---|---|
| 0.58 | 1.5× | 50% higher |
| 1 | 2× | twice as high |
| 2 | 4× | four times as high |
| −1 | 0.5× | half as high |
| −2 | 0.25× | a quarter as high |

## Why the thresholds can only be tightened

The thresholds you pick in the analysis settings decide which genes are stored as significant. On the results screens you can then apply **stricter** thresholds (padj down to 0.0001, fold change up to 8×), but not looser ones: genes that did not pass the analysis thresholds were not kept as significant. The control shows *Widest available — set at ingestion* next to these values.

To look at weaker effects, launch a new analysis with a higher FDR or a lower fold change. It costs one analysis on your quota.

## Why counts can differ between screens

Some parts of the app use fixed cut-offs of their own, whatever you set in the threshold strip:

- **Top regulated genes** (Explore overview) always uses padj < 0.05 and |log2FC| > 0.58.
- **Heatmap & clustering** picks its genes at padj ≤ 0.05 and **|log2FC| ≥ 1** (2-fold).
- **Functional enrichment** computed during the analysis uses FDR 0.05 and **|log2FC| ≥ 1**.
- **Multi-comparison** and **Contrast scatter** use padj 0.05 and |log2FC| 0.58.

So a comparison can show, for example, 2,900 DEGs in the table and fewer genes in the heatmap and in the enrichment input. Both numbers are correct; they answer different questions. When you report a DEG count, give the thresholds with it.

## Choosing thresholds

- **Several thousand DEGs** usually means a strong effect. Tighten to padj < 0.01 and a 2-fold change to focus on the most robust changes.
- **A handful of DEGs** is often a matter of statistical power (too few replicates, high variability) rather than an absence of effect. Check the sample map first (see [Sample structure, heatmaps and clustering](/docs/sample-structure-and-clustering)).
- **Do not pick the thresholds that give the result you hoped for.** Choose them before you look, and keep them the same across the comparisons you want to compare.

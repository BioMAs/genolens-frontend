---
title: Sample structure, heatmaps and clustering
description: Check that your samples group as expected, and find genes that behave alike.
category: explore
order: 40
---

# Sample structure, heatmaps and clustering

Before you interpret a list of genes, check that your samples behave as expected: replicates should resemble each other and conditions should separate. GenoLens gives you four views for this.

## Sample structure: PCA and UMAP

On the analysis page, the **Sample structure** module places each sample on a map. Samples with similar expression profiles sit close together. The maps are computed from the normalised (variance-stabilised) expression of all retained genes.

- **PCA** (principal component analysis) keeps the distances meaningful. **Variance explained** tells you how much of the total variation each axis captures.
- **UMAP** is better at showing groups, but distances between distant groups mean little.
- **Color by** colours the samples by any column of your sample sheet: condition, batch, sex, date…

**What to look for:**

- Replicates of the same condition cluster together: good.
- Samples group by **batch** rather than by condition: there is a batch effect. Run the analysis again with the **~ batch + condition** design (see [Analysis settings explained](/docs/analysis-settings)).
- One sample sits far from all the others: it may be an outlier. Check it in **Quality control** before you trust the comparison it belongs to.
- Conditions overlap completely: expect few DEGs. This is useful to know before you read the results.

**Ask AI** next to the chart describes what the map shows.

## The comparison heatmap

On the **Explore** screen of a comparison, **Heatmap & clustering** shows the expression of the differential genes in every sample. Genes and samples are ordered by similarity (Ward clustering), so blocks of genes that move together stand out.

- **Top DEGs** draws the most significant genes; **Current selection** draws the genes you selected in the volcano plot.
- Two display modes: **Normalized expression (z-score)**, where each gene is scaled so its pattern stands out whatever its level, and **Log2FC**.
- Side tracks show the condition of each sample and the direction of each gene.
- A small preview loads first; the full heatmap holds up to 2,000 genes.
- Download the clustered values as CSV, or the image as PNG from the chart toolbar.

The heatmap needs the sample sheet to label conditions. When it is missing, a *Metadata file missing* warning is shown.

## The clustering page

For a free exploration of the whole count matrix, open the matrix dataset from the project's **Datasets** tab and choose **Clustering**.

| Setting | Options | Default |
|---|---|---|
| **Genes** | the 100, 500, 1,000, 2,000 or 5,000 most variable genes | 500 |
| **Metric** | Euclidean, Correlation, Cosine | Euclidean |
| **Method** | Ward, Average, Complete, Single, K-means | Ward |
| **Scale Rows (Z-score)** | on / off | on |

Click **Run** to draw the heatmap.

**Choosing the number of groups (K-means).** K-means splits genes into *k* groups; you choose *k* between 2 and 50 (default 8). Not sure? Click **Find optimal k**. GenoLens scores every *k* from 2 to 10 with the silhouette method, which measures how well separated the groups are. It then recommends a value: click **Use k=…** to apply it. A silhouette above 0.5 (the dotted *Good threshold* line) means clearly separated groups.

## DEG patterns

The **DEG patterns** module of the analysis page (Scientific tools add-on) groups differential genes by the shape of their expression profile across your samples, so genes that rise and fall together end up in the same group. Set the **Number of clusters** (default 6) and the **Min cluster size** (default 15), then click **Compute patterns**. **Export gene → cluster (.csv)** downloads the group of each gene. Each group can then be enriched to see which functions share a pattern.

---
title: Volcano plot, gene table and gene cards
description: Find the genes that changed, select them, and read everything GenoLens knows about one gene.
category: explore
order: 20
---

# Volcano plot, gene table and gene cards

The **Explore** screen of a comparison is built around three linked views: the volcano plot, the gene table and the gene cards. Whatever you select in one view shows up in the other two.

## At a glance

The **Overview** at the top shows the **Top regulated genes** (top 10 by default, and you can pick 5, 15 or 20) next to the **Top enriched pathways**. Start there for a quick feel of the result.

## The threshold strip

Just above the volcano plot, the strip labelled **At your current thresholds** counts the up-regulated, down-regulated and non-significant genes. It holds two controls:

- **padj <**: 0.05, 0.01, 0.005, 0.001 or 0.0001.
- **|log2FC| >**: 0.58 (1.5×), 1.0 (2×), 1.5 (2.8×), 2.0 (4×) or 3.0 (8×).

Changing a value updates the volcano plot, the table, the network and the counts at once. The widest values are the ones of the analysis: you can make the thresholds stricter here, not looser. [What counts as a differentially expressed gene](/docs/deg-thresholds) explains why.

## The volcano plot

Each dot is a gene. The horizontal axis shows the **log2 fold change**: to the right, higher in the test condition; to the left, lower. The vertical axis shows the significance (−log10 adjusted p-value): the higher the dot, the more significant the gene. Dotted lines mark the current thresholds.

- **Hover** a dot to see the gene, its log2 fold change and its adjusted p-value.
- **Click** a dot to open its gene card.
- **Shift-click** to add more genes to the selection.
- Use the **lasso** tool of the chart toolbar to circle a group of genes.
- **Clear selection** starts over.

All significant genes are drawn. To keep the plot responsive, the non-significant background is thinned out to at most 5,000 dots.

The chart toolbar, which appears when you hover the plot, also downloads the plot as a PNG image. **Ask AI** explains what the plot shows.

## The gene table

**Differentially Expressed Genes** lists the significant genes at the current thresholds, sorted by adjusted p-value.

- Sort by **Gene ID**, **Log2FC** or **Padj** by clicking the column header.
- Show only **UP** or **DOWN** genes with the regulation filter.
- Hide or show columns from the **Columns** menu.
- Choose 25, 50, 100 or 200 **Rows per page**.
- Click a row to select the gene, and click it again to deselect it.
- The star in the first column **bookmarks** the gene (see [Bookmarks and gene lists](/docs/bookmarks-and-gene-lists)).

When you have selected genes in the volcano plot, the table shows only those genes.

## The gene card

Selecting a single gene opens its card:

- the verdict (up, down or not significant), its log2 fold change and its adjusted p-value;
- **Expression by condition**: a box plot of its normalised expression in each sample group;
- **In N enriched pathways**: the enriched terms the gene belongs to;
- **Interaction partners** from the STRING database, with an **Open in STRING** link;
- a bookmark button.

> **Tip:** look at the box plot before you trust a single gene. A large fold change carried by one outlier sample shows up immediately.

## Working with a set of genes

Selecting several genes opens a summary card instead. It shows the **Strongest fold change** and **Most significant** genes of the set, and offers:

- **Save list**: keeps the selection as a named gene list in the project.
- **Bookmark all**: bookmarks every selected gene.
- **Enrich these**: runs a functional enrichment on this set only (Pro plan).
- A CSV or JSON download of the selection.

## Method statistics

When the analysis combined several methods, **Method statistics** shows the p-values of **Stouffer**, **DESeq2**, **edgeR** and **limma** side by side for each gene. **Download all methods (.csv)** exports them for every gene. Genes on which the methods disagree deserve a second look.

## Other tools on this screen

- **Heatmap & clustering**: see [Sample structure, heatmaps and clustering](/docs/sample-structure-and-clustering).
- **Database lookup**: paste a list of genes and run an enrichment against the STRING database (see [Interaction networks](/docs/interaction-network)).
- **Free-form charts**: draw your own PCA, UMAP or box plot on a set of genes you choose (needs an expression matrix).

---
title: Your first analysis, step by step
description: From an empty account to your first list of differentially expressed genes.
category: getting-started
order: 20
---

# Your first analysis, step by step

This walkthrough takes you from an empty account to your first results. Allow a few minutes of your time, plus the time the pipeline needs to run. That depends on the size of your data; count on several minutes for a typical study.

## Before you start

Have three **tab-separated** text files ready (`.tsv` or `.txt`):

1. **A count matrix**: one row per gene, one column per sample, with raw (not normalised) read counts.
2. **A sample sheet**: one row per sample, with at least a sample name and its condition.
3. **A comparison list**: which condition to compare with which. You can skip this file and build the comparisons in the wizard instead.

[Preparing your files](/docs/preparing-files) shows the exact layout, with examples. No data at hand? You can [import a public dataset from GEO](/docs/geo-import).

## 1. Create a project

1. In the sidebar, open **Projects** and click **New Project**.
2. Give it a **Project Name**, such as the name of your study. The description is optional.
3. Click **Create Project**. GenoLens opens the setup wizard of the new project.

## 2. Upload your files

1. On the first screen, pick **Transcriptomics** and click **Get started**.
2. Drop your count matrix on the **Count Matrix** card, and your sample sheet on the **Sample Metadata** card. Each card shows *Processing…* for a moment, then turns green.
3. Define your comparisons:
   - With the builder: choose the **Grouping (condition) column** of your sample sheet. Then, for each comparison, pick a **Test condition** and a **Reference condition**. The name fills in automatically as `test_vs_reference`. Click **Use these comparisons**.
   - Or click **Upload a contrast file instead** and drop your comparison list.
4. When all three cards are green, click **Continue to Data Validation**, then **Continue to Settings**.

## 3. Choose the settings

1. Type an **Analysis Name**, for example *First pass, default settings*.
2. Keep **Standard** mode. It uses sensible defaults: adjusted p-value below 0.05, fold change of at least 1.5×, and three statistical methods combined.
3. Pick your **species**. It is needed for the functional enrichment.
4. Click **Review & Launch**.

The settings are explained in [Analysis settings explained](/docs/analysis-settings).

## 4. Launch and wait

1. Check the summary, then click **Launch Analysis**. The notice above the button shows how many analyses you have left this month. One launch counts as **one analysis**, whatever its number of comparisons.
2. The page follows the run and fills a **Progress log**. You can leave the page: the analysis keeps running, and you can find it later under **Analyses** in the project sidebar.
3. When the header reads **Analysis complete!**, you see the number of up- and down-regulated genes for each comparison.

## 5. Look at the results

Click **View Results**. The analysis page summarises the run: how many samples and genes were kept, the sample map (PCA, UMAP) and the quality checks. Open a comparison to reach its volcano plot and gene table.

Next steps:

- [Finding your way around a comparison](/docs/comparison-page)
- [Volcano plot, gene table and gene cards](/docs/volcano-and-gene-table)
- [Functional enrichment](/docs/functional-enrichment)

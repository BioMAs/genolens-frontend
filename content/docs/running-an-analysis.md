---
title: Launching an analysis
description: The setup wizard screen by screen, what happens while the pipeline runs, and where results appear.
category: analysis
order: 10
---

# Launching an analysis

Analyses are launched from the project's setup wizard. Open the project and click **Setup** in the sidebar, or **New analysis** on the project overview. Only the project **owner** and **Admin** members can launch analyses.

The wizard has five steps, shown in the bar at the top: **Upload Files**, **Data Validation**, **Analysis Settings**, **Launch & Monitor** and **Results**.

## Upload Files

Drop your count matrix, your sample sheet and your comparisons. [Preparing your files](/docs/preparing-files) explains the formats. Files already uploaded to the project are reused: you do not need to upload them again for a second analysis, unless you want to replace them (**Replace file**).

You can only continue once all three files are marked ready.

## Data Validation

This screen lists your files and their status, with library sizes for your samples, and checks your data before anything runs. It warns you when:

- a sample has fewer than **100,000 reads** or fewer than **500 detected genes**. With the default settings the analysis drops these samples, so the warning names them now. If the low depth is expected, lower **Min reads / sample** or **Min genes / sample** in the next step (Advanced mode);
- the count matrix has fewer than **4 samples**, which means fewer than two replicates per condition for a comparison;
- sample names do not match between the two files: matrix columns missing from the sample sheet, or sample-sheet entries with no column in the matrix. Names must match exactly, including capitals;
- the sample sheet has no column the analysis recognises for sample names (`sample_id`, `sample`, `sampleid` or `id`) or for conditions (`condition`, `group`, `treatment` or `genotype`);
- a condition has fewer than **2 samples**. Comparisons involving it are skipped.

Warnings do not stop you: you can continue and decide later. The one exception is when **no** sample of the count matrix matches the sample sheet. The analysis cannot run in that case, so **Continue** stays disabled until you fix one of the files (**Replace file** in the previous step).

**All checks passed** appears only when every check ran and found nothing. For a count matrix uploaded before these checks existed, the per-sample figures are missing and the screen says so; upload the matrix again to check it.

The filtering itself still happens during the analysis, using the thresholds from **Analysis Settings**.

## Analysis Settings

Give the analysis a name. You will see it in the project's list of analyses, so make it descriptive, for instance *Batch-corrected, FDR 0.01*.

- **Standard** mode shows the defaults and is the right choice for most studies.
- **Advanced** mode lets you change the statistical thresholds, the design, the filtering and the methods.

GenoLens remembers which mode you prefer. Every setting is explained in [Analysis settings explained](/docs/analysis-settings).

## Launch & Monitor

The summary recaps your files and settings. Above the **Launch Analysis** button, a notice shows how many analyses you have left this month.

> **One launch = one analysis** on your quota, whether it contains one comparison or twenty. An analysis that fails, or that produces no comparison, is not counted. See [Plans, quotas and add-ons](/docs/plans-and-quotas).

After you click **Launch Analysis**, the analysis joins a queue and then runs in the background. The page refreshes itself every few seconds and shows the current step and a **Progress log**.

You do not need to stay on the page. You can close it and find the analysis later under **Analyses** in the project sidebar, with its status: *Pending*, *Running*, *Done*, *Failed* or *Cancelled*.

How long a run takes depends on the number of samples and comparisons. For each comparison the pipeline runs three statistical methods, then a functional enrichment, so large designs take longer.

## Results

When the run is over, the header reads **Analysis complete!** and shows, for each comparison, the number of up- and down-regulated genes. From there:

- **View Results** opens the analysis page (see below).
- **Run New Analysis** starts again with other settings, reusing the same files.
- **Back to Project** returns to the project overview.

If the analysis failed, the analysis card shows **View error** and the log. Most failures come from the files. See [Troubleshooting](/docs/troubleshooting).

## The analysis page

Each finished analysis has a summary page. The top tiles show the **Comparisons**, **Conditions**, **Samples kept**, **Genes retained**, the **DEA method** and the **FDR** threshold. The **Analysis modules** section below gives access to:

- **Comparisons**: one card per comparison. Click one to open its results.
- **Sample structure**: the PCA and UMAP maps of your samples (see [Sample structure, heatmaps and clustering](/docs/sample-structure-and-clustering)).
- **Quality control**: how many samples passed the filters.
- **Parameters**: the exact settings used, which is useful for your methods section.
- **DEG patterns**: groups of genes that behave alike across conditions (Scientific tools add-on).

> **Tip:** if **Samples kept** is lower than the number of samples you uploaded, some samples fell below the read or gene thresholds. Check **Quality control** before you interpret the results.

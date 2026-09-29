---
title: Troubleshooting and FAQ
description: What to do when an upload fails, an analysis fails, a comparison is missing or results look wrong.
category: getting-started
order: 30
---

# Troubleshooting and FAQ

## Uploading files

**"Unsupported file type" or "File extension … not allowed".**
Use `.tsv`, `.txt`, `.csv` or `.xlsx`. Old Excel files (`.xls`) are refused: save them again in another format. For analyses, prefer **tab-separated** text (see below).

**The card says "processing failed".**
GenoLens could not read the file. Check that it is a plain table with a header row and no merged cells, notes or empty lines above the header. Then click **Try a different file**.

## When an analysis fails

Open **Analyses** in the project sidebar, find the analysis and click **View error**, or open its log. The most common causes:

**The files are not tab-separated.**
The pipeline reads tab-separated files. A CSV or Excel file can upload without an error and still make the analysis fail. Save the three files as `.tsv` and upload them again (**Replace file**). See [Preparing your files](/docs/preparing-files).

**"samples.tsv must have 'sample_id' and 'condition' columns".**
Rename the columns of your sample sheet: the sample column must be called `sample_id`, `sample`, `sampleid` or `id`, and the condition column `condition`, `group`, `treatment` or `genotype`.

**An error about the comparison file.**
Your comparison file needs three columns: a name (`comparison`), the test condition (`condition1`) and the reference (`condition2`). The easiest fix is to use the comparison builder of the wizard instead of a file.

## The analysis finished but a comparison is missing, or there are no results

The analysis succeeded but skipped comparisons it could not run. The log explains why. Check that:

- the sample names of the count matrix and the sample sheet are **exactly** the same, including capitals, spaces and underscores;
- the condition names in your comparisons are spelled exactly as in the sample sheet;
- each condition still has **at least two samples** after filtering. Samples with too few reads are dropped: look at **Samples kept** and **Quality control** on the analysis page.

An analysis that produced no comparison does not count against your quota.

## Results

**There are very few differential genes.**
Check the sample map (PCA). If the conditions overlap, the effect is small compared with the variability between replicates. More replicates help more than anything else. You can also try [GSEA](/docs/gsea), which detects coordinated modest changes, or a new analysis with an FDR of 0.1.

**Samples group by batch, not by condition.**
Add a `batch` column to your sample sheet and run the analysis again with the **~ batch + condition** design.

**I cannot loosen the thresholds on the results page.**
That is expected: the thresholds of the analysis are the widest available. Run a new analysis with wider thresholds. See [What counts as a differentially expressed gene](/docs/deg-thresholds).

**The heatmap, the enrichment and the gene table do not count the same number of genes.**
They use different fold-change cut-offs. [What counts as a differentially expressed gene](/docs/deg-thresholds) lists them.

**A module is greyed out.**
*Needs an expression matrix* means the result was imported without per-sample expression. *Add-on module* means the module is part of an add-on: click it to request access.

**The enrichment section is empty.**
There may be too few genes above the enrichment cut-off (2-fold change), or the species has no annotation for that database. Try another database, or GSEA.

## Account and quota

**"No analysis left this month".**
Your monthly quota is used up. It resets on the 1st of the month. Your results stay accessible meanwhile. See [Plans, quotas and add-ons](/docs/plans-and-quotas).

**A colleague cannot see my project.**
They need a GenoLens account, and you need to invite them from **Members** once that account exists. See [Sharing a project](/docs/project-sharing).

**A colleague sees the project but not the AI interpretation or a module.**
Those depend on the viewer's own plan and add-ons, not on the project's owner.

## Still stuck?

Write to **support@scilicium.com**. Include the project name, the analysis name and the error shown in its log.

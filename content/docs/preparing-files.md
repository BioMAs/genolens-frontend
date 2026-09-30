---
title: Preparing your files
description: The exact layout GenoLens expects for the count matrix, the sample sheet and the comparison list.
category: data
order: 10
---

# Preparing your files

An analysis needs three files. Most failed analyses come from a small mismatch between them, such as a sample named differently in two files. This page lists the rules the pipeline applies.

> **Save all three files as tab-separated text (`.tsv` or `.txt`).** The upload screen also accepts CSV and Excel files, but the statistical pipeline reads tab-separated files. A comma-separated or Excel file uploads without an error and then makes the analysis fail. In Excel, use **File → Save As → Text (Tab delimited)**.

## 1. The count matrix

One row per gene, one column per sample, and **raw integer read counts**. Do not upload TPM, FPKM or normalised values: the statistical methods model raw counts and normalise them themselves.

```text
gene_id	gene_name	Ctrl_1	Ctrl_2	Ctrl_3	Treated_1	Treated_2	Treated_3
ENSG00000141510	TP53	1520	1432	1611	2894	3010	2766
ENSG00000012048	BRCA1	310	295	322	118	131	109
```

- **First column: the gene identifier.** It can be named `gene_id`, `geneid`, `gene` or `id`. Otherwise the first column is used as the identifier anyway.
- **Optional gene symbol column** named `gene_name` or `symbol`. It is what you will see in tables and plots, so it is worth including.
- **Every other column is a sample.** Sample column names must match the sample names in your sample sheet **exactly**, including capitals.

## 2. The sample sheet

One row per sample. It says which condition each sample belongs to.

```text
sample_id	condition	batch
Ctrl_1	Control	run1
Ctrl_2	Control	run2
Ctrl_3	Control	run1
Treated_1	Treated	run2
Treated_2	Treated	run1
Treated_3	Treated	run2
```

- **A sample column**, named `sample_id`, `sample`, `sampleid`, `id` or `name`. Its values must be the column names of the count matrix.
- **A condition column**, with any name. In the wizard's comparison builder you pick it under **Grouping (condition) column**, and the analysis groups your samples by that column. If you upload your own comparison file instead, the analysis looks for a column named `condition`, `group`, `groupe`, `treatment` or `genotype`, so use one of these names in that case.
- **An optional batch column**, named `batch`, `run` or `lane`. It lets the pipeline account for batch effects (see [Analysis settings explained](/docs/analysis-settings)).
- Other columns are allowed. You can use them to colour the sample map later.

Condition names become part of comparison names. Short names without spaces (`Control`, `KO`, `Day7`) make the results easier to read.

## 3. The comparison list

Each row is one comparison: a **test** condition against a **reference** condition. Fold changes are computed as *test / reference*, so a positive log2 fold change means *higher in the test condition*.

The easiest way is the **comparison builder** in the wizard. It reads the conditions from your sample sheet and writes the file for you. To upload your own file, use three columns:

```text
comparison	condition1	condition2
Treated_vs_Control	Treated	Control
KO_vs_WT	KO	WT
```

- `comparison`: a unique name for the comparison.
- `condition1`: the **test** condition.
- `condition2`: the **reference** condition.

The condition values must match the condition column of the sample sheet exactly.

> **Note:** the *File format reference* panel in the wizard shows a two-column `group1, group2` example. That layout has no comparison name, and the analysis stops with an error. Always include the name column.

## Checklist before uploading

- [ ] All three files are tab-separated.
- [ ] The count matrix holds raw integer counts.
- [ ] Every sample column of the matrix appears in the sample sheet, spelled the same way.
- [ ] The sample sheet has a `sample_id` column and a `condition` column (or one of their accepted names).
- [ ] Each comparison uses two conditions that exist in the sample sheet.
- [ ] Each condition in a comparison has **at least two samples**. With fewer, the comparison is skipped. Three or more replicates give much more reliable results.

## What happens after upload

Each file is converted and stored as soon as you drop it. The card shows *Processing…*, then turns green. If a file cannot be read at all, the card turns red with the reason and a **Try a different file** button.

At this stage GenoLens only checks that it can read the file. It does not yet check that the three files agree with each other: a mismatch shows up when the analysis runs. See [Troubleshooting](/docs/troubleshooting).

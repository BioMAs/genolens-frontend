---
title: Importing a public GEO dataset
description: Start from a published study on NCBI GEO instead of your own files.
category: data
order: 20
---

# Importing a public GEO dataset

You can start a project from a public study on **NCBI GEO** instead of uploading your own files. This is handy to try GenoLens, or to compare your results with published data.

## Which datasets can be imported

Only **human and mouse** series for which NCBI provides a **pre-computed count matrix** can be imported. Many recent RNA-seq series have one. Microarray series and series without NCBI counts cannot be imported.

## Importing a series

1. Open a project and go to **Setup**.
2. On the upload step, switch from **Upload files** to **Import from GEO**.
3. Type a GEO accession (for example `GSE…`) or keywords, and click **Search**.
4. Click **Import** next to the series you want.

GenoLens creates two datasets in the project: **GEO {accession} — counts**, the count matrix, and **GEO {accession} — samples**, the sample sheet built from the GEO sample descriptions.

## After the import

The sample sheet built from GEO descriptions does not always use the column names the pipeline expects, and conditions are sometimes spread over several columns. Before launching an analysis:

1. Check which column holds the condition you want to compare.
2. Build your comparisons with the comparison builder.
3. If needed, download the sample sheet, fix it (a `sample_id` column and a `condition` column, see [Preparing your files](/docs/preparing-files)) and upload it again.

> Importing, uploading and re-processing datasets require the **owner** or an **Admin** member of the project.

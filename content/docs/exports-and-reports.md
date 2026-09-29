---
title: Exports and PDF reports
description: Download tables and figures, and generate a branded PDF report of a comparison.
category: collaboration
order: 30
---

# Exports and PDF reports

## Tables

| What | Where | Content |
|---|---|---|
| **All differential genes** | **Share → Exports → Export** (CSV or JSON) | Every differential gene of the comparison at the current thresholds, with no row limit: gene ID, symbol, log2 fold change, adjusted p-value and direction. Use this file for complete DEG lists. |
| **Differential genes, as filtered** | Gene table, export menu (CSV or JSON) | The same columns, with the table's direction filter and selection applied. Up to the first 1,000 genes. For the complete list, use the Share export above. |
| **Full results, all methods** | **Share → Per-method p-values (.csv)**, or **Download all methods (.csv)** in Method statistics | Every tested gene, significant or not, with the statistics of each method. Use this file for supplementary data. |
| **A dataset's table** | Dataset page, **Export** (CSV or JSON) | Every row of the dataset that matches your ID search, with the columns chosen in **Columns** (all columns if none is chosen). |
| **A selection of genes** | Selection card, export menu | The genes you selected. |
| **Enrichment terms** | Enrichment table, export menu (CSV, JSON or HTML) | Terms, statistics and genes. |
| **GSEA results** | GSEA table, export menu | Gene sets, NES, FDR and leading edge. |
| **Shared or unique genes** | Multi-comparison | The genes of the selected region. |
| **Clustering** | Heatmap, CSV download | Clustered expression values. |
| **Bookmarks, gene lists** | Their managers, CSV or JSON | Genes, notes, tags. |

Table exports are available on every plan.

## Figures

Every interactive chart has a toolbar that appears when you hover the chart. Use its camera icon to download a PNG image. Some charts also offer **Download PNG** and **Download SVG**. SVG is a vector format you can edit in Illustrator or Inkscape.

> **Tip:** turn on the colour-blind-safe palette (**⌘K / Ctrl+K**, then *Use the colorblind-safe chart palette*) before you export figures for a publication.

## PDF report of a comparison

> Requires the **Reporting** add-on and a **Pro** or **Enterprise** plan.

GenoLens can write a complete PDF report of a comparison. It covers quality control, the sample map, the differential genes, enrichment, materials and methods, and an appendix.

1. Open the comparison and click **Customize & Generate** in the header.
2. Choose the layout: the **First page** (*Detailed*, *Simple* or *Cover*) and the **Last page** (*Colour back cover* or *Contact page*).
3. Fill in or adjust the project information, the materials and methods, and the conclusion.
4. Generate. When the report is ready, click **Download Report**.

The report is generated in the background and takes a moment. After you change your branding or your text, use the regenerate action to rebuild the report with the latest content.

## Your report branding

On the **Share** screen, **Reporting** holds the settings applied to all your reports:

- your **logo** (PNG, JPG or PDF, 5 MB at most);
- a **primary** and a **secondary colour**;
- your institute's **name and address**;
- default **Material & Methods** and **conclusion** texts, so you do not retype them for each report.

These settings belong to your account and apply to every project.

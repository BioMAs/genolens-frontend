---
title: How GenoLens works
description: The five building blocks of the app, and the path from raw counts to a shareable result.
category: getting-started
order: 10
---

# How GenoLens works

GenoLens turns an RNA-seq count table into differential expression results. You can then explore, interpret and share those results without writing code. You bring the counts and a description of your samples. GenoLens runs the statistics, the quality filtering and the functional enrichment.

## The five building blocks

| Term | What it is |
|---|---|
| **Project** | A folder for one study. It holds your files, your analyses and the people you share them with. |
| **Dataset** | A file uploaded to a project: the count matrix, the sample sheet or the list of comparisons. |
| **Analysis** | One run of the statistical pipeline on those files, with a given set of settings. |
| **Comparison** | One contrast inside an analysis, such as *Treated vs Control*. Each comparison has its own results page. |
| **DEG** | A *differentially expressed gene*: a gene whose expression changes significantly between the two conditions of a comparison. |

One analysis usually contains several comparisons. You can run several analyses in the same project, for instance to try other settings.

## The path through the app

1. **Create a project** from **Projects → New Project**. You land in the setup wizard.
2. **Upload three files**: a count matrix, a sample sheet and your comparisons. You can import a public dataset from GEO instead. See [Preparing your files](/docs/preparing-files).
3. **Choose the settings**, or keep the defaults, then **launch**. The pipeline runs in the background and the page shows its progress. See [Launching an analysis](/docs/running-an-analysis).
4. **Open a comparison** to explore the genes that changed. Results are organised in four screens: **Explore**, **Understand**, **Apply** and **Share**. See [Finding your way around a comparison](/docs/comparison-page).
5. **Interpret and share** your results. You can run functional enrichment, get an AI reading, export files, generate a PDF report and share the project with colleagues.

## Where things are

The left sidebar holds everything:

- **Dashboard**: your latest result, your recent projects and how much of your monthly quota is left.
- **Projects**: all your projects, including the ones shared with you.
- **Comparisons**: every comparison from all your projects in one table, with its number of up- and down-regulated genes.
- **Tools**: stand-alone research tools, such as power analysis and the Gene Ontology browser.
- **Documentation**: these guides.

When you open a project, the sidebar also shows that project's pages: **Overview**, **Setup**, **Analyses**, **Multi-comparison** and **Contrast scatter**.

> **Tip:** press **⌘K** (Mac) or **Ctrl+K** (Windows, Linux) anywhere to open the command palette. From it you can jump to a project or a page, switch between the light and dark themes, turn on the colour-blind-safe chart palette, or replay the guided tour of the current screen.

## What GenoLens does not do

- It starts from **counts**, not from sequencing reads. Alignment and quantification (STAR, Salmon, featureCounts…) must be done first.
- It currently handles **bulk transcriptomics** only. Proteomics and lipidomics appear in the setup wizard as *Coming soon*.

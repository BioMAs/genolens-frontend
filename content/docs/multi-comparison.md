---
title: Comparing several comparisons
description: Find the genes shared by several comparisons or unique to one, and plot one contrast against another.
category: explore
order: 50
---

# Comparing several comparisons

Once a project holds several comparisons, a common question is what they have in common. GenoLens offers three views for this.

## Multi-comparison: shared and unique genes

> Available on the **Pro** plan. The project needs at least two comparisons.

Open **Multi-comparison** in the project sidebar.

1. Select **2 to 5 comparisons**.
2. Click **Generate analysis**.

With two or three comparisons, GenoLens draws a **Venn diagram** whose areas are proportional to the number of genes. With four or five, it draws an **UpSet plot**: each bar is one combination of comparisons, and the dots below show which combination. UpSet plots stay readable when a Venn diagram with four or more sets would not.

- **Click a region** or a bar to select its genes.
- **Shared by all N** selects the genes found in every selected comparison. These are often the core response.
- Download the selected genes as CSV or JSON.
- **Run functional enrichment** tests the selected genes against the functional databases, which tells you what the shared (or unique) genes do.

DEGs are defined here at padj < 0.05 and |log2FC| > 0.58, whatever the thresholds of each comparison page.

**Typical uses:**

- *Several treatments against the same control*: the shared genes are the common response; the genes unique to one treatment are its specific signature.
- *A time course*: follow which genes appear, persist or disappear over time.

## Contrast scatter: one comparison against another

> Requires the **Scientific tools** add-on. The project needs at least two comparisons.

Open **Contrast scatter** in the project sidebar. Pick **Contrast A (x-axis)** and **Contrast B (y-axis)**, adjust the **P-adj threshold** and **|Log2FC| threshold** if needed, and click **Compare contrasts**.

Each dot is a gene, placed by its log2 fold change in A and in B. GenoLens colours the genes by class:

- **Concordant**: significant in both, in the same direction.
- **Discordant**: significant in both, in opposite directions.
- **Specific to A** / **Specific to B**: significant in one only.
- **Not significant** in either.

The **Spearman ρ** correlation sums up how similar the two responses are: close to 1, they are alike; close to 0, unrelated; negative, opposite. The plot is thinned out for speed; the CSV download contains every gene.

## All comparisons at a glance

The **Comparisons** page of the sidebar lists every comparison of every project, with its number of **Up**, **Down** and **Total** DEGs, whether enrichment results exist, and when it was last updated. Search by comparison or project name, filter by project, and sort by name, DEG count or date.

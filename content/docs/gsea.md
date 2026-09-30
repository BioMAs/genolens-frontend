---
title: Gene Set Enrichment Analysis (GSEA)
description: Detect coordinated shifts in whole pathways, including modest changes that no single-gene cut-off would catch.
category: enrichment
order: 20
---

# Gene Set Enrichment Analysis (GSEA)

> Requires the **Scientific tools** add-on.

Over-representation analysis (ORA) looks only at the genes that pass a cut-off. **GSEA** uses **every gene**, ranked from the most up-regulated to the most down-regulated, and asks whether the genes of a pathway gather at the top or at the bottom of that ranking.

It can detect a pathway in which fifty genes each rise by 20%, which ORA would miss because none of those genes passes the DEG threshold.

## When to use it

- You have **few DEGs**, but suspect a biological effect.
- You expect **modest, coordinated** changes, such as metabolic adaptation.
- You want a result that does not depend on an arbitrary threshold.

## Running GSEA

On the comparison's **Understand** screen, choose **GSEA (ranked)**.

| Setting | Options | Default | Advice |
|---|---|---|---|
| **Gene sets** | GO BP, GO MF, GO CC, KEGG, Reactome, Hallmark, Custom (this project) | GO BP | Hallmark gives a quick, readable overview. |
| **Ranking** | Signed P-value, Log2 Fold Change, Signal to Noise | Signed P-value (recommended) | Signed p-value combines the direction and the strength of the evidence. |
| **Min / max size** | — | 15 / 500 genes | Excludes gene sets too small to be reliable or too broad to be informative. |
| **Permutations** | 100 to 10,000 | 1,000 | More permutations give more precise p-values but take longer. |
| **FDR** | 0.05 to 0.50 | 0.25 | 0.25 is the standard GSEA cut-off for exploration. |

Click **Run GSEA**. The computation runs in the background and can take several minutes. You can keep working meanwhile.

**Custom (this project)** tests the gene sets you created for the project (**Custom gene sets** in the project menu, Scientific tools add-on). Use it to check a published signature in your own data.

## Reading the results

- **NES** (normalised enrichment score): positive when the gene set gathers among the **up-regulated** genes, negative when it gathers among the **down-regulated** ones. The larger the absolute value, the stronger the effect. Filter with **Positive NES** / **Negative NES**.
- **FDR**: the confidence in the result. The usual threshold is 0.25, higher than elsewhere, because GSEA tests whole gene sets that overlap heavily.
- **Leading edge**: the genes that drive the enrichment. These are the genes to follow up.

Export the table as CSV, JSON or HTML.

## No significant results?

- Check the sample map: if the conditions overlap, no method will find much.
- Try **Hallmark**, whose 50 well-separated gene sets have more power than thousands of overlapping GO terms.
- An FDR of 0.25 is already permissive. Beyond it, consider the result negative.

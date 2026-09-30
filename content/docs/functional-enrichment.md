---
title: Functional enrichment
description: Which biological processes and pathways your differential genes point to, and how to read the results.
category: enrichment
order: 10
---

# Functional enrichment

A list of several hundred genes is hard to read gene by gene. Functional enrichment asks a simpler question: **which biological functions are over-represented among my differential genes?** If 40 of your 300 up-regulated genes belong to *inflammatory response*, while chance would predict 5, that function is *enriched*.

## When enrichment is computed

Enrichment runs **automatically at the end of every analysis**, for each comparison, using the species you chose. It covers three directions:

- **All** differential genes;
- **Up**-regulated genes only;
- **Down**-regulated genes only.

Look at the directions separately: up- and down-regulated genes often point to different biology, which is blurred when they are pooled.

Genes enter the enrichment at the thresholds set for the analysis: by default **FDR < 0.05** and a **1.5-fold change** (|log2FC| ≥ 0.58). Only terms with an adjusted p-value below 0.05 are kept. The **Filter** panel on the Understand screen shows the thresholds your analysis used.

If the enrichment step fails, the analysis still succeeds: you keep your differential genes, and the enrichment section says no results are available.

## The databases

| Database | What it describes |
|---|---|
| **GO BP** (Gene Ontology, Biological Process) | Processes such as *cell cycle* or *immune response*. Usually the most informative. |
| **GO MF** (Molecular Function) | Activities such as *kinase activity* or *DNA binding*. |
| **GO CC** (Cellular Component) | Locations such as *mitochondrion* or *synapse*. |
| **KEGG** | Curated metabolic and signalling pathways. |
| **Reactome** | Detailed reactions and pathways. |
| **MSigDB Hallmark, C5, C7** | Curated gene-set collections: 50 well-defined biological states (Hallmark), ontology sets (C5), immunological signatures (C7). |

## Reading the results

On the comparison's **Understand** screen, choose **Over-representation (ORA)**, then a database and a direction (**All DEGs**, **Upregulated Only**, **Downregulated Only**). Four views are available:

- **Dot Plot** (default): the top 20 terms. Dot size is the number of your genes in the term; colour is the significance (−log10 FDR).
- **Histogram** and **Radar Chart**: the same terms, drawn differently.
- **Table**: every term, with its genes. Export it as CSV, JSON or HTML.

Enrichment is computed once, during the analysis. The **Filter** panel only narrows the stored results. It does not start a new computation:

- **Database / Category** and **Regulation** choose which stored enrichment you see;
- **Show terms with adj. p-value ≤** hides terms above a stricter cut-off than the one used for the analysis;
- **Min / Max term size** hide terms annotated to too few or too many genes (the second number in the table's **Genes** column). Lowering the maximum drops broad, generic terms.

To enrich with other thresholds, run a new analysis with different settings.

The project's enrichment page (open the enrichment dataset from the **Datasets** tab) offers the same results with a **Max p-adj** filter (0.01 to 0.25; values above 0.05 only matter for enrichment files you uploaded, since the analysis keeps terms below 0.05) and a **Radar Plot**. Click **Show genes** to see the genes of a term with their fold changes, or **View in GO browser** to read the definition of a GO term.

## Interpreting enrichment well

- **Trust themes, not single terms.** Ten related terms pointing to the same process weigh more than one very significant isolated term.
- **Big, generic terms** (*metabolic process*, *cellular process*) are almost always enriched and say little. Prefer specific ones.
- **Few DEGs, few results.** With fewer than about 50 differential genes, over-representation has little power. Try [GSEA](/docs/gsea), which does not need a cut-off.
- **Enrichment is a hypothesis**, not a proof: it tells you where to look. Validate the key genes of the key terms.

## Enriching your own gene set

Select genes in the volcano plot and click **Enrich these** (Pro plan), or use **Run functional enrichment** in [Multi-comparison](/docs/multi-comparison) to enrich shared or unique genes.

## Browsing Gene Ontology

**Tools → Gene Ontology Browser** lets you search a GO term by name or identifier (for example `mitochondrion` or `GO:0005739`), read its definition, and move up to its parents or down to its children.

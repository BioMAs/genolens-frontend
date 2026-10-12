---
title: Analysis settings explained
description: What each setting of the wizard changes, its default value, and when to change it.
category: analysis
order: 20
---

# Analysis settings explained

The defaults suit most bulk RNA-seq studies. Switch to **Advanced** in the *Analysis Settings* step to change them. The values used for each analysis are saved and shown in its **Parameters** module.

## Statistical thresholds

These two thresholds decide which genes count as **differentially expressed** (DEG).

| Setting | Default | What it means |
|---|---|---|
| **FDR threshold (p-adj)** | 0.05 | Maximum adjusted p-value. With 0.05, you accept that about 5% of the genes called significant are false positives. The range is 0.001 to 0.2. |
| **Fold-change** | 1.5 | Minimum size of the change, as a ratio. 1.5 means +50% or −33%, which is a log2 fold change of about ±0.58. The range is 1 to 10. |

A gene is a DEG when it passes **both** thresholds. Genes passing these thresholds are stored with the results. On the results screens you can then **tighten** the thresholds, but you cannot loosen them. To look at weaker effects, run a new analysis with wider thresholds. See [What counts as a differentially expressed gene](/docs/deg-thresholds).

## Statistical method

**DEA method** chooses how differential expression is tested:

- **All three, DESeq2 decides (recommended)**, the default. GenoLens runs **DESeq2**, **edgeR** and **limma-voom** on each comparison. **DESeq2** decides which genes are DEGs: its adjusted p-value and its log2 fold change are the ones compared with the thresholds. edgeR and limma do not change the list. They show, gene by gene, how many methods agree.
- **DESeq2 only**, **limma-voom only** or **edgeR only**: runs one method, which then decides alone. Choose this to match a published analysis, or when a reviewer asks for a specific tool.

With all three methods, the p-value of each method stays available on the comparison page (**Method statistics**) and as a download, along with a Stouffer combination of the three. That combination is shown for information only and never decides. Stouffer's method assumes independent tests, but the three methods analyse the same counts, so their p-values move together and the combination overstates the evidence: three p-values of 0.05 combine to about 0.002.

## Design formula

The design tells the model what explains the differences between samples.

- **Auto-detect** (default): GenoLens accounts for batch when your sample sheet has a batch column **and** the samples of the comparison come from more than one batch. Otherwise it uses the condition alone. The choice is made separately for each comparison.
- **~ condition**: compares conditions only.
- **~ batch + condition**: compares conditions after accounting for batch, meaning samples processed on different days, runs or lanes. This requires a `batch`, `run` or `lane` column in the sample sheet.

Account for batch when your samples were processed in several rounds. Do so only if each batch contains samples from several conditions: when a batch holds a single condition, the batch effect cannot be separated from the biology.

## Filtering

Filtering removes samples and genes that carry too little information. It runs before the statistics.

| Setting | Default | Effect |
|---|---|---|
| **Min reads / sample** | 100,000 | Samples with fewer reads in total are dropped. |
| **Min genes / sample** | 500 | Samples with fewer detected genes are dropped. |
| **Min count (per gene)** | 10 | Reads a gene needs in enough samples (next setting) to be kept. |
| **Samples reaching min count** | Auto | **Auto** asks for as many samples as the smallest compared condition holds, the rule of edgeR's `filterByExpr`. With three replicates per condition, a gene needs 10 reads in at least three samples: a gene expressed in a single condition is kept, a gene seen in only two samples is not. Above ten samples per condition the requirement is relaxed (17 samples for groups of 20). You can also set a fixed number from 2 to 6. |

At least two samples are always kept. The **Samples kept** and **Genes retained** tiles of the analysis page show the effect of the filters.

## Species and enrichment

**Species** (Human, Mouse, Rat, Zebrafish, Pig) selects the annotation used for functional enrichment. Gene Ontology, KEGG and Reactome enrichment runs automatically at the end of the analysis, for every comparison. See [Functional enrichment](/docs/functional-enrichment).

The clustering and enrichment database settings shown in this step apply when you explore the results after the analysis. You can change them at that point.

## Choosing settings: quick guide

| Situation | Suggestion |
|---|---|
| First look at a new study | Keep the defaults. |
| Too many DEGs to interpret (several thousand) | Tighten the thresholds on the results screen: FDR 0.01, fold change 2×. No new analysis is needed. |
| Very few DEGs | Check the number of replicates and the sample map first. Then consider an FDR of 0.1 in a new analysis. |
| Samples processed in several batches | **~ batch + condition**. |
| Low-depth samples, such as degraded material | Lower **Min reads / sample** with care, and check Quality control. |

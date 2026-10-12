---
title: Signature score, drug targets and CosmOmics
description: The Apply screen turns a comparison into scores, therapeutic targets and cosmetic claims.
category: enrichment
order: 50
---

# Signature score, drug targets and CosmOmics

The **Apply** screen of a comparison holds modules that turn a result into something actionable. Each belongs to an **add-on** that an administrator enables on your account. When an add-on is not enabled, the module shows what it does and a button to request access.

## Signature score

> Requires the **Scientific tools** add-on and an expression matrix.

A *signature* is a set of genes that together mark a state: a cell type, a pathway, a response published in a paper. The signature score measures how strongly each of your samples expresses that set.

1. Choose one of the project's gene lists with **Select a gene list…**, or paste genes.
2. Choose a method:
   - **Mean z-score (recommended)**: averages the standardised expression of the genes. Simple and easy to read.
   - **Mean rank (AUCell-like)**: based on the rank of the genes within each sample. It is less sensitive to a few very highly expressed genes.
3. Click **Score signature**.

You get one score per sample, grouped by condition. A signature that scores higher in the treated samples indicates that its state is induced by the treatment.

> **Tip:** save gene sets you want to score from the volcano plot with **Save list**, or create them in **Gene lists** (see [Bookmarks and gene lists](/docs/bookmarks-and-gene-lists)).

## Drug targets

> Requires the **Drug Discovery** add-on.

This module matches the genes of your comparison against a ranking of therapeutic targets built from public evidence.

1. Set the filters: **Max adjusted p-value**, **Min |log2FC|**, **Directions** (up, down or both) and **Max genes per arm**.
2. Click **Run against the ranking**.

**Hits** lists your genes that are ranked targets, with their score. **Report** details the evidence and its sources.

The full ranking can also be browsed on its own, by indication and weighting profile (*Oncology*, *First-in-class*, *Fast-follower*, *Safety first*), from the [Drug Discovery page](/tools/drug-discovery).

## CosmOmics

> Requires the **Skin claims** (cosmetics) add-on.

For skin studies, the CosmOmics **pathway nova** shows which pathways support or contradict each cosmetic claim. Each sector is a claim, as wide as the evidence behind it; each bubble is a group of related ontology terms (a pathway), further out when more significant, green when its terms move in the direction the claim expects, coral when they move against it. Hatching marks the evidence against a claim. Click a sector for the claim card; hover a bubble for its terms. The nova exports as SVG or PNG. Without the add-on, the module appears as a locked card with a request-access action.

---
title: Signature score, drug targets and CosmOmics
description: The Apply screen turns a comparison into scores, therapeutic targets and pathway evidence for cosmetic claims.
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

For skin studies, the CosmOmics **pathway nova** shows which pathways go for or against each cosmetic claim. It reads the enrichment already computed for the comparison; it does not compute anything new, and it does not prove a claim.

### Reading the nova

- Each **sector** is a claim, as wide as the evidence behind it. Each **bubble** is a group of related ontology terms (a pathway sub-group), further out when more significant. Green means its terms move in the direction the claim expects, coral against it, grey that the evidence for and against **cancels** (a *balanced* sub-group, counted neither for nor against and never hatched). **Hatching** marks the evidence against a claim.
- The arrow on a sub-group (↑ or ↓) is the direction in which it is observed. It is never coloured: up or down is not good or bad.
- Click a sector for the **claim card**: its counts (for, against, balanced), whether its evidence is for only, against only or both, and its **coherence**, the share of the evidence weight that goes for the claim. Coherence is not a probability. Hover a bubble for the terms behind it.
- A claim whose evidence is **for only** (no contrary term at all) is not thereby confirmed: only terms present in the enrichment results can count against a claim, and no contrary term is not a confirmation. A claim can show **0 against** (no sub-group against it) and still carry contrary terms inside sub-groups that go for it: its state then reads "evidence both for and against".
- Claims of the referential with no significant term in the comparison are listed as **not evaluated** (n.e.): there is no significant term for them in the enrichment results, so nothing was evaluated.

### What the p-values are

A term's p is its **adjusted p** (Benjamini–Hochberg for the enrichment GenoLens runs; the adjusted column of the tables you uploaded otherwise). A sub-group's p is the **combined p** of its terms (Stouffer): it is not an adjusted p. A term that is not significant at the threshold α is drawn faded, and still contributes with its weight. **How this was computed**, under the nova, gives the dataset, α, the enrichment cut-off, the version of the claim referential, the sources and the date.

The decorative dots of the background are not data: they are off by default, and never in an export.

### Export

The nova exports as SVG or PNG with its legend, the claims not evaluated, how many of the not-linked sub-groups are drawn (the strongest twelve), and what it was computed from. The export of a demonstration dataset is marked DEMO.

### AI reading

An AI reading of the nova is written **only when you ask for it**, and the first time in a visit the panel says what is sent before anything leaves: the names of the claims and of their pathway sub-groups, their direction and side, the counts and the p-values. The comparison name, gene lists and raw data are not sent. The text carries the label *AI-generated text (model …, generated …)*. A saved reading is shown without calling the model; when the results it was written from have changed (another threshold, referential or enrichment), it is marked **out of date** and can be regenerated. It requires a plan with AI access, and each new reading uses one AI request.

Without the add-on, the module appears as a locked card with a request-access action.

---
title: Bookmarks and gene lists
description: Keep track of genes of interest and build reusable gene lists for signatures and enrichment.
category: collaboration
order: 20
---

# Bookmarks and gene lists

GenoLens has two ways to keep genes: **bookmarks**, to mark individual genes you want to come back to, and **gene lists**, to save a set of genes you want to reuse.

## Bookmarks

A bookmark marks one gene in one project, with your notes.

**To bookmark a gene**, click the star (**Bookmark**) next to it in the gene table, in an enrichment table or on the gene card. To bookmark a whole selection, click **Bookmark all** on the selection card.

**To see your bookmarks**, open the project menu and choose **Bookmarks**. For each gene you can:

- add **notes**, such as *validated by qPCR* or *check isoform*;
- add **tags** to group genes (*candidate*, *to validate*, *literature*…);
- give it a colour.

Export your bookmarks as CSV or JSON.

Bookmarks are **private**: other members of the project do not see them.

## Gene lists

A gene list is a named set of genes in a project.

**To create one from a selection**, select genes in the volcano plot (shift-click or lasso), type a name under **Gene list name** and click **Save list**.

**To create one by hand**, open the project menu and choose **Gene lists**, then **Create New Gene List**:

- **Name**, for example *Interferon response*;
- **Description**, optional;
- the genes, one per line;
- a **Color**;
- **Make public** makes the list visible to the other members of the project. Without it, only you see it.

Lists can be edited, renamed, deleted and exported as CSV or JSON.

## What to do with a gene list

- **Score it** in each sample with the [signature score](/docs/apply-modules) (Scientific tools add-on).
- **Enrich it**: select its genes and click **Enrich these** (Pro plan).
- **Share it**: the address of a comparison page can carry a gene list. Anyone with access to the project who opens that link gets the same selection.

**Custom gene sets** (project menu, Scientific tools add-on) are different: they are gene sets you add to the [GSEA](/docs/gsea) databases of the project, to test a published signature against your ranking.

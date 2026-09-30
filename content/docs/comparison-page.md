---
title: Finding your way around a comparison
description: The four screens of a comparison (Explore, Understand, Apply, Share) and what each one is for.
category: explore
order: 10
---

# Finding your way around a comparison

Each comparison, for example *Treated vs Control*, has its own results page. To open one, go to the analysis page and click a card under **Comparisons**. You can also open the **Comparisons** tab of the project overview, or the **Comparisons** page of the sidebar, which lists every comparison from all your projects.

## The summary at the top

Every screen starts with the same summary card. It says in one sentence how many genes respond in the test condition, split into **↑ up** and **↓ down**, out of how many genes were tested and on how many samples.

The header also holds:

- **AI Assistant**: a chat you can ask about this comparison (see [AI interpretation and assistants](/docs/ai-interpretation)).
- The PDF report buttons, if your account has the Reporting add-on (see [Exports and PDF reports](/docs/exports-and-reports)).
- A menu with **Reprocess DEG**, which rebuilds this comparison's results from the stored data.

## The four screens

The screens follow the questions you ask about a result, in order.

| Screen | The question it answers | What you find there |
|---|---|---|
| **Explore** | *Which genes moved, and what does each one do?* | Top regulated genes and pathways, the threshold control, the volcano plot, the gene table, method statistics, the heatmap, a database lookup and free-form charts. |
| **Understand** | *What do those genes mean together?* | The AI reading, functional enrichment (over-representation and GSEA) and the interaction network. |
| **Apply** | *What can I do with this comparison?* | Drug targets, signature score and skin claims. These are add-on modules. |
| **Share** | *How do I take the results out of the app?* | Downloads and report branding. |

## Modules you cannot open yet

Some sections of a screen may be greyed out, with one of two messages:

- **Needs an expression matrix**: the module works from the normalised expression of each sample. That matrix exists for analyses run in GenoLens. It is missing for results imported as a finished table of differential genes.
- **Add-on module**: the module belongs to an add-on that is not enabled on your account. Click it to send an access request. See [Plans, quotas and add-ons](/docs/plans-and-quotas).

## Your selection follows you

A gene or a set of genes you select in the volcano plot also filters the table and seeds the interaction network. The thresholds you set apply to the volcano plot, the table, the network and the summary counts together.

The selection and the thresholds are written into the page address. **Copy the URL to share the exact view** with a colleague who has access to the project: they will see the same genes at the same thresholds.

On the **Understand** screen, you can focus on one pathway and send its genes back to **Explore** as a selection.

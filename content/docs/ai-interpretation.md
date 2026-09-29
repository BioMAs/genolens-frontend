---
title: AI interpretation and assistants
description: Get a written biological reading of a comparison, ask questions about it, and know the limits of the AI.
category: enrichment
order: 40
---

# AI interpretation and assistants

> Available on the **Pro** and **Enterprise** plans.

GenoLens includes a language model that reads your results and writes about them in plain English. It helps you get a first reading quickly and put a result into words. It is **not** a substitute for your own analysis.

## AI Biological Interpretation

On the comparison's **Understand** screen, open **AI reading** and click **Generate Interpretation**. The first generation can take up to a few minutes.

The AI is given a summary of the comparison: the number of up- and down-regulated genes, the **20 genes with the largest fold change** and the **15 most significant enriched pathways**. It does not see your raw data, your sample sheet or the rest of the project.

It writes a biological interpretation: the processes involved, what the top genes are known for, and hypotheses to test. The date of generation is shown under the text. Once the interpretation exists, **Ask a Question** opens a chat about it.

Each comparison has **one** interpretation, which is kept and shown again on your next visit.

## The other assistants

- **AI Assistant**, in the header of a comparison: a chat about the comparison as a whole.
- **Ask AI**, next to the volcano plot, heatmap, PCA, UMAP and enrichment charts: explains what the chart shows and how to read it.

## Using the AI responsibly

- **Check every claim.** Language models can state wrong facts with confidence, including made-up gene functions or references. Check anything you plan to publish against the literature.
- **It sees a summary only.** It knows nothing about your experimental design, your controls or your sample quality unless you tell it in the chat.
- **Hypotheses, not conclusions.** Use the text to decide what to look at next, not as a result in itself.
- **What leaves the page.** Only the summary described above is sent to the model, an open model deployed for GenoLens. It is not a public chatbot service, and your files are never sent to it.

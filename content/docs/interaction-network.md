---
title: Interaction networks and STRING lookup
description: See how your differential genes connect through known protein–protein interactions.
category: enrichment
order: 30
---

# Interaction networks and STRING lookup

Genes that change together often work together. The interaction network places your differential genes on the map of known protein–protein interactions from the **STRING** database, so that hubs and functional modules stand out.

## The interaction network

On the comparison's **Understand** screen, scroll to **Interaction network**. It loads when you reach it, or when you click **Load this section**.

**Which genes it starts from:**

1. the genes you selected in the volcano plot, if any;
2. otherwise, the genes of the pathway you focused on;
3. otherwise, the **60 differential genes with the largest fold change**.

| Setting | Options | Default |
|---|---|---|
| **Partners per gene** | 1, 5, 10, 25, 50 | 10 |
| **Maximum nodes by degree** | Top 50, 100, 300, All | 300 |

Only high-confidence interactions (STRING score ≥ 700 out of 1,000) are drawn. **Click a node** to select the gene everywhere on the page, and use **Full screen** for large networks.

**What to look for:** densely connected clusters, which are often protein complexes or pathways, and highly connected genes (hubs), which are candidate regulators of the response.

> **Note:** the network currently uses the **human** interaction map, whatever the species of the analysis. For mouse or rat data, most genes map to their human counterparts by name, but check key interactions in STRING directly with **Open in STRING** on the gene card.

## Database lookup

On the **Explore** screen, **Database lookup** sends a list of genes to STRING's own enrichment service.

1. Paste your genes, one per line or separated by commas.
2. Choose the **Organism**: human (default), mouse, rat, zebrafish, fly or yeast.
3. Click **Run STRING enrichment**.

Results cover GO, KEGG, Reactome and WikiPathways. The screen shows the first 200 terms; the CSV export has them all. Use it as an independent check of GenoLens' own enrichment.

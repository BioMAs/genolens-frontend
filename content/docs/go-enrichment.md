---
title: Gene Ontology enrichment
description: Test your gene lists against Gene Ontology terms and read the results.
category: enrichment
order: 10
---

# Gene Ontology (GO) Enrichment

Guide complet : enrichissement GO, hiérarchie ontologique, et chargement des bases de données gene sets.

## Overview

- **Hypergeometric testing** avec correction FDR (Benjamini-Hochberg)
- **True path rule** : propagation des annotations vers les termes ancêtres
- **3 namespaces** : Biological Process (BP), Molecular Function (MF), Cellular Component (CC)
- **~45,000 termes GO** avec relations hiérarchiques
- **Visualisation interactive** de la hiérarchie GO

---

## Database Schema

### `go_terms`

| Colonne | Type | Description |
|---------|------|-------------|
| `go_id` | VARCHAR(20) | GO identifier (e.g., GO:0008150) |
| `name` | VARCHAR | Nom du terme |
| `namespace` | VARCHAR(50) | BP, MF, ou CC |
| `definition` | TEXT | Définition |
| `is_a` | JSON | Termes parents (relation is_a) |
| `part_of` | JSON | Termes parents (relation part_of) |
| `level` | INTEGER | Profondeur depuis la racine |
| `gene_count` | INTEGER | Gènes annotés |

Indexes : `go_id` (unique), `namespace`, `name` GIN (fuzzy search)

### `go_annotations`

| Colonne | Type | Description |
|---------|------|-------------|
| `gene_symbol` | VARCHAR | Symbole du gène |
| `go_id` | VARCHAR(20) | FK → go_terms |
| `evidence_code` | VARCHAR(10) | IEA, IDA, IMP, etc. |
| `source_db` | VARCHAR(50) | UniProt, MGI… |
| `organism` | VARCHAR(100) | Homo sapiens, Mus musculus… |

Indexes : `gene_symbol`, `go_id`, `organism`, `evidence_code`

### `gene_sets` (pour GSEA)

```sql
CREATE TABLE gene_sets (
    id UUID PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    database VARCHAR(50) NOT NULL,   -- GO_BP, KEGG, HALLMARK, CUSTOM…
    genes JSON NOT NULL,
    size INTEGER NOT NULL,
    organism VARCHAR(100) DEFAULT 'Homo sapiens',
    version VARCHAR(50)
);
CREATE UNIQUE INDEX ix_gene_sets_name_database ON gene_sets(name, database);
```

---

## Loading GO Data

### Téléchargement et chargement ontologie + annotations

```bash
# Human GO data (download auto depuis geneontology.org)
docker-compose exec api python scripts/load_go_ontology.py --organism human --download

# Mouse
docker-compose exec api python scripts/load_go_ontology.py --organism mouse --download --clear

# Depuis fichiers locaux
python scripts/load_go_ontology.py \
  --obo-file go-basic.obo \
  --gaf-file goa_human.gaf.gz \
  --organism human
```

**Sources :**
- OBO : `http://purl.obolibrary.org/obo/go/go-basic.obo`
- Human GAF : `http://current.geneontology.org/annotations/goa_human.gaf.gz`
- Mouse GAF : `http://current.geneontology.org/annotations/mgi.gaf.gz`

**Durée typique :** ~30s pour l'ontologie (45k termes), ~5 min pour les annotations (600k+ pour human)

### Chargement des Gene Sets (MSigDB / KEGG / Reactome)

```bash
# Télécharger depuis https://www.gsea-msigdb.org/gsea/register.jsp
mkdir -p backend/data/genesets

# Charger Hallmark
python scripts/load_gene_sets.py \
  --file data/genesets/h.all.v2024.1.Hs.symbols.gmt \
  --database HALLMARK \
  --version 2024.1

# Charger GO Biological Process
python scripts/load_gene_sets.py \
  --file data/genesets/c5.go.bp.v2024.1.Hs.symbols.gmt \
  --database GO_BP \
  --version 2024.1

# Vérifier
python scripts/load_gene_sets.py --stats
python scripts/load_gene_sets.py --search "immune"
```

### Databases supportées

| Database | Description | Taille typique |
|----------|-------------|----------------|
| `GO_BP/MF/CC` | Gene Ontology namespaces | ~5,000 / ~1,000 / ~500 |
| `KEGG` | KEGG Pathways | ~300 |
| `REACTOME` | Reactome Pathways | ~2,000 |
| `HALLMARK` | MSigDB Hallmark | ~50 |
| `C2_CURATED` | MSigDB C2 | ~6,000 |
| `C7_IMMUNOLOGIC` | MSigDB C7 | ~5,000 |
| `CUSTOM` | Gene sets définis par l'utilisateur | Variable |

### Ajout d'un organisme

```python
# Dans load_go_ontology.py
ORGANISM_NAMES = {
    "human": "Homo sapiens",
    "mouse": "Mus musculus",
    "rat": "Rattus norvegicus"  # nouveau
}
GO_ANNOTATION_URLS = {
    "rat": "http://current.geneontology.org/annotations/rgd.gaf.gz"
}
```

---

## API Endpoints

### Lancer l'enrichissement GO

```http
POST /datasets/{dataset_id}/comparisons/{comparison_name}/go-enrichment
```

```json
{
  "namespace": "BP",
  "regulation": "UP",
  "padj_threshold": 0.05,
  "log_fc_threshold": 0.5,
  "min_term_size": 5,
  "max_term_size": 500,
  "pvalue_threshold": 0.05,
  "fdr_method": "fdr_bh",
  "propagate_annotations": true,
  "organism": "Homo sapiens"
}
```

Réponse : liste de `{ go_id, go_name, namespace, pvalue, fdr, enrichment_ratio, study_count, study_genes, level }`

### Rechercher des termes GO

```http
GET /go-terms/search?q=apoptosis&namespace=BP&limit=10
```

### Détails d'un terme

```http
GET /go-terms/{go_id}?include_ancestors=true&include_descendants=false
```

### Gènes annotés à un terme

```http
GET /go-terms/{go_id}/genes?organism=Homo%20sapiens&propagate=true
```

---

## Frontend Components

`frontend/src/components/GOEnrichmentAnalysis.tsx`

```tsx
<GOEnrichmentAnalysis 
  dataset={dataset} 
  comparisonName="Treated_vs_Control" 
/>
```

**Sub-composants :**
- `GOEnrichmentTable` — tableau avec tri/recherche, lignes expandables avec gènes
- `GOHierarchyGraph` — hiérarchie avec indentation par niveau, barres d'enrichissement
- `GOForceGraph` — graphe D3 force-directed (phase1, `src/components/GOForceGraph.tsx`)
- `GOTreePanel` — vue arbre navigable (phase1, `src/components/GOTreePanel.tsx`)

---

## Algorithme d'enrichissement

### Test hypergéométrique

```
P(X ≥ k) = 1 - Σ(i=0 to k-1) C(K,i) × C(N-K, n-i) / C(N,n)

N = gènes background totaux
K = gènes annotés au terme (background)
n = gènes DEG (study set)
k = gènes DEG annotés au terme
```

```python
from scipy.stats import hypergeom
pvalue = hypergeom.sf(k - 1, N, K, n)
```

### Correction FDR (Benjamini-Hochberg)

```python
fdr_values = [min(1.0, pval * m / (i + 1)) for i, pval in enumerate(sorted_pvalues)]
for i in range(len(fdr_values) - 2, -1, -1):
    fdr_values[i] = min(fdr_values[i], fdr_values[i + 1])
```

### True Path Rule

Propagation ascendante : les gènes annotés à un terme sont implicitement annotés à tous ses ancêtres.

```python
async def _propagate_annotations(self, db, go_id):
    descendants = await self._get_descendants(db, go_id)
    all_go_ids = [go_id] + descendants
    annotations = await db.execute(
        select(GOAnnotation).where(GOAnnotation.go_id.in_(all_go_ids))
    )
    return annotations.scalars().all()
```

---

## Evidence Codes

| Code | Type | Fiabilité |
|------|------|-----------|
| IDA, IMP | Expérimental (direct assay, mutant) | ⭐⭐⭐⭐⭐ |
| IGI, IPI | Expérimental (interaction) | ⭐⭐⭐⭐ |
| ISS, ISO | Computationnel (similarité séquence) | ⭐⭐⭐ |
| IEA | Automatique (electronic annotation) | ⭐⭐ |

```python
# Filtrer sur les preuves expérimentales uniquement
annotations = await go_service.get_gene_annotations(
    db=db, go_id="GO:0006915",
    evidence_codes=["IDA", "IMP", "IGI", "IPI"]
)
```

---

## Cas d'usage

```python
# Processus biologiques enrichis dans les gènes up-régulés
POST /go-enrichment { "namespace": "BP", "regulation": "UP", "log_fc_threshold": 1.0 }

# Fonctions moléculaires des gènes down-régulés
{ "namespace": "MF", "regulation": "DOWN", "min_term_size": 10 }

# Localisation cellulaire (tous DEGs)
{ "namespace": "CC", "regulation": null, "propagate_annotations": true }

# Enrichissement haute confiance (preuves expérimentales seulement)
{ "namespace": null, "pvalue_threshold": 0.001, "evidence_codes": ["IDA", "IMP", "IGI"] }
```

---

## Troubleshooting

**Aucun terme trouvé** — vérifier `SELECT COUNT(*) FROM go_terms` et `go_annotations`, relâcher les seuils (`pvalue_threshold` → 0.1), vérifier le nom d'organisme exact (ex: "Homo sapiens").

**Enrichissement lent** — réduire `max_term_size` à 300, désactiver `propagate_annotations`, filtrer par namespace, vérifier l'index `idx_go_annotations_gene_symbol`.

**Gènes manquants dans résultats** — activer `propagate_annotations=true`, utiliser des gene symbols (pas des IDs Ensembl), vérifier l'organisme.

**GSEA "No gene sets found"** — charger les gene sets avec `python scripts/load_gene_sets.py --file your.gmt --database GO_BP`.

---

## Schedule de mise à jour gene sets

| Database | Fréquence recommandée |
|----------|----------------------|
| GO | Mensuel |
| MSigDB | Annuel ou bi-annuel |
| KEGG | Trimestriel |
| Reactome | Trimestriel |

```bash
python scripts/load_gene_sets.py \
  --file h.all.v2024.2.Hs.symbols.gmt \
  --database HALLMARK --version 2024.2 --clear
```

---

## Références

- [Gene Ontology Consortium](http://geneontology.org)
- [OBO Format](http://owlcollab.github.io/oboformat/)
- [GAF Format Guide](http://geneontology.org/docs/go-annotation-file-gaf-format-2.2/)
- [MSigDB](https://www.gsea-msigdb.org)

---

**Last Updated**: Mai 2026 — GenoLens V2

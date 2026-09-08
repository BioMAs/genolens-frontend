---
title: Filtering differential genes
description: Combine thresholds with AND/OR logic to isolate the genes that matter.
category: analysis
order: 10
---

# Advanced DEG Filtering with AND/OR Logic

## Overview

The Advanced DEG Filtering feature provides a powerful, flexible interface for querying differentially expressed genes using complex boolean logic. Unlike simple threshold-based filtering, advanced filters allow you to combine multiple criteria with AND/OR operators to create sophisticated queries.

**Key Features:**
- ✅ Multiple filter conditions with AND/OR logic
- ✅ Group conditions into logical blocks
- ✅ Support for numeric, text, and list-based filters
- ✅ Save and reuse custom filters
- ✅ Real-time query building with visual feedback
- ✅ Fast database-backed filtering

---

## Use Cases

### 1. Finding Highly Significant, Highly Expressed Genes

**Goal**: Identify genes with strong differential expression AND high statistical significance

**Filter Logic**:
```
(padj < 0.001) AND (|logFC| > 2.0)
```

**How to Create**:
1. Add condition: padj < 0.001
2. Click "AND" (should be default)
3. Add condition: logFC > 2.0
4. Apply filter

**Result**: Only genes passing BOTH criteria are returned (intersection)

---

### 2. Multiple Gene Lists Comparison

**Goal**: Find genes from a target list OR a pathway-related list

**Filter Logic**:
```
(gene_id IN list_A) OR (gene_id IN list_B)
```

**How to Create**:
1. Add condition: gene_id → "in list" → paste gene IDs
2. Toggle to "OR"
3. Add condition: gene_id → "in list" → paste second list
4. Apply filter

**Result**: Genes from either list are returned (union)

---

### 3. Excluding Low-Confidence Genes

**Goal**: Filter out genes with marginal significance OR very low fold change

**Filter Logic**:
```
(padj < 0.01) AND (|logFC| > 1.0) AND (gene_id NOT contains "LOC")
```

**How to Create**:
1. Add condition: padj < 0.01
2. Add condition: logFC > 1.0 (with AND)
3. Add condition: gene_id → "does not contain" → "LOC"
4. Apply filter

**Result**: High-confidence genes excluding predicted/provisional annotations

---

### 4. Complex Multi-Group Queries

**Goal**: (High upregulation OR specific gene list) AND (very significant)

**Filter Logic**:
```
Group 1 (OR): (logFC > 3.0) OR (gene_id IN my_candidates)
AND
Group 2: (padj < 0.0001)
```

**How to Create**:
1. **Group 1**:
   - Add condition: logFC > 3.0
   - Toggle to OR
   - Add condition: gene_id IN list
2. Click "Add Filter Group"
3. **Group 2**:
   - Add condition: padj < 0.0001
4. Ensure group operator is "AND"
5. Apply filter

**Result**: Very significant genes that are either highly upregulated or in your candidate list

---

## Filter Components

### 1. Filter Fields

| Field | Type | Description | Example Operators |
|-------|------|-------------|-------------------|
| **Log2 Fold Change** | Number | Differential expression magnitude | >, <, >=, <=, =, != |
| **Adjusted P-value** | Number | Statistical significance (FDR) | >, <, >=, <=, =, != |
| **Gene ID** | Text | Ensembl or gene identifier | equals, contains, not contains, in list |
| **Gene Name** | Text | Human-readable gene symbol | equals, contains, not contains, in list |
| **Regulation** | Select | Up or down regulation | = (select from dropdown) |

### 2. Operators

#### Numeric Operators
- `>` Greater than
- `<` Less than
- `>=` Greater than or equal
- `<=` Less than or equal
- `=` Equals
- `!=` Not equals

#### Text Operators
- `equals` - Exact match (case-insensitive)
- `not equals` - Not exact match
- `contains` - Substring match (case-insensitive)
- `does not contain` - Substring exclusion
- `in list` - Match any from list

### 3. Logical Operators

#### AND (Intersection)
- **Behavior**: ALL conditions must be true
- **Use when**: You want to narrow results (more restrictive)
- **Example**: `(padj < 0.05) AND (logFC > 1)` → genes passing BOTH criteria

#### OR (Union)
- **Behavior**: ANY condition can be true
- **Use when**: You want to broaden results (less restrictive)
- **Example**: `(logFC > 2) OR (logFC < -2)` → highly up OR highly down

### 4. Filter Groups

**Purpose**: Combine multiple conditions into logical units

**Example Structure**:
```
Group 1 (AND):
  - padj < 0.01
  - logFC > 1

AND (between groups)

Group 2 (OR):
  - gene_id contains "BRCA"
  - gene_id in list
```

**Interpretation**: Significant upregulated genes that are also either BRCA-related or in my list

---

## User Interface Guide

### Opening Advanced Filters

1. Navigate to a comparison page with DEG table
2. Click **"Advanced Filters"** button above the table
3. Filter builder interface will expand

### Building a Filter

**Step 1: Add Conditions**
- Click **"+ Add condition"** to create a new rule
- Select field from dropdown (e.g., "Log2 Fold Change")
- Select operator (e.g., ">")
- Enter value (e.g., "1.5")

**Step 2: Set Logic Within Group**
- Click the **"AND"** or **"OR"** button to toggle between operators
- Blue = AND, Purple = OR

**Step 3: Add More Groups (Optional)**
- Click **"+ Add Filter Group"** to create a new group
- Each group can have its own internal logic (AND/OR)

**Step 4: Set Logic Between Groups**
- Click the **"AND (between groups)"** or **"OR (between groups)"** button
- This controls how different groups relate to each other

**Step 5: Apply Filter**
- Click **"Apply Filters"** button
- Table will update with filtered results
- Filter badge will show number of active groups

### Saving Filters

1. Build your filter
2. Click **"Save"** button
3. Enter a descriptive name (e.g., "Highly significant upregulated")
4. Click "Save" in dialog
5. Filter is stored in browser localStorage

### Loading Saved Filters

1. Click **"Load"** button
2. Select from list of saved filters
3. Filter will be loaded into builder
4. Click "Apply Filters" to use it

### Clearing Filters

- **Clear current filter**: Click "Clear All" in builder
- **Reset to default view**: Click "Clear Filters" button (when filter is active)

---

## Advanced Examples

### Example 1: Immune Response Genes

**Goal**: Find immune-related genes with strong upregulation

**Filter**:
```
Group 1 (AND):
  - gene_name contains "IL"
  - logFC > 1.5
  - padj < 0.01

OR

Group 2 (AND):
  - gene_name contains "TNF"
  - logFC > 1.5
  - padj < 0.01
```

**Result**: Interleukin OR TNF genes with strong upregulation

---

### Example 2: Exclude Ribosomal and Mitochondrial Genes

**Goal**: Filter out common housekeeping genes

**Filter**:
```
Group 1 (AND):
  - padj < 0.05
  - logFC >= 0.58
  - gene_id does not contain "RP"
  - gene_id does not contain "MT-"
```

**Result**: Significant DEGs excluding ribosomal (RP*) and mitochondrial (MT-*) genes

---

### Example 3: Candidate Gene Validation

**Goal**: Check if your candidate genes are differentially expressed

**Filter**:
```
Group 1:
  - gene_id in list:
    ENSG00000139618
    ENSG00000141510
    ENSG00000134086
    ...

AND

Group 2:
  - padj < 0.05
```

**Result**: Only your candidates that are significant DEGs

---

### Example 4: Extreme Changers

**Goal**: Find genes with extreme fold changes in either direction

**Filter**:
```
Group 1 (AND):
  - logFC > 4.0
  - padj < 0.001

OR

Group 2 (AND):
  - logFC < -4.0
  - padj < 0.001
```

**Result**: Genes with >16-fold change (up or down) and very significant

---

## Technical Details

### Backend Implementation

**Endpoint**: `POST /datasets/{dataset_id}/advanced-filter`

**Request Body**:
```json
{
  "filter_data": {
    "groups": [
      {
        "operator": "AND",
        "conditions": [
          {
            "field": "logFC",
            "operator": ">",
            "value": 1.5
          },
          {
            "field": "padj",
            "operator": "<",
            "value": 0.01
          }
        ]
      }
    ],
    "groupOperator": "AND"
  },
  "comparison_name": "Treated_vs_Control",
  "page": 1,
  "page_size": 50
}
```

**Response**:
```json
{
  "genes": [
    {
      "gene_id": "ENSG00000139618",
      "log_fc": 2.5,
      "padj": 0.001,
      "regulation": "up",
      "gene_name": "BRCA2"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 50,
    "total": 245,
    "total_pages": 5
  },
  "filter_summary": {
    "groups": 1,
    "total_conditions": 2,
    "group_operator": "AND"
  }
}
```

### SQL Query Generation

The backend dynamically builds SQL WHERE clauses:

**Example Filter**:
```
(log_fc > 1.5 AND padj < 0.01) OR (gene_id IN ('GENE1', 'GENE2'))
```

**Generated SQL**:
```sql
SELECT gene_id, log_fc, padj, regulation, gene_name
FROM deg_genes
WHERE dataset_id = :dataset_id
  AND comparison_name = :comparison_name
  AND ((log_fc > :log_fc_0 AND padj < :padj_1) OR (gene_id IN (:gene_0, :gene_1)))
ORDER BY padj ASC, ABS(log_fc) DESC
LIMIT :limit OFFSET :offset
```

### Performance

- **Query speed**: <200ms for most filters
- **Indexing**: Uses `deg_genes` table indexes on `dataset_id`, `comparison_name`, `padj`, `log_fc`
- **Pagination**: Server-side pagination prevents large data transfers
- **Optimization**: Parameterized queries prevent SQL injection

---

## Data Persistence

### Where Filters Are Stored

- **Location**: Browser localStorage
- **Scope**: Per-project (filters saved under project ID)
- **Format**: JSON
- **Persistence**: Survives browser refresh, not shared between devices

### localStorage Structure

```json
{
  "genolens_saved_filters": {
    "project-uuid-1": [
      {
        "name": "Highly significant",
        "groups": [...],
        "groupOperator": "AND"
      }
    ],
    "project-uuid-2": [...]
  }
}
```

### Managing Stored Filters

**View stored filters**:
```javascript
localStorage.getItem('genolens_saved_filters')
```

**Clear all filters**:
```javascript
localStorage.removeItem('genolens_saved_filters')
```

---

## Best Practices

### 1. Start Simple, Then Refine

- Begin with a single condition
- Apply filter and review results
- Add more conditions iteratively
- Save working filters for reuse

### 2. Use Descriptive Names

**Good**:
- "Highly significant upregulated (padj<0.001, logFC>2)"
- "Immune genes (IL* and TNF*)"
- "Candidate validation list"

**Bad**:
- "Filter 1"
- "Test"
- "My filter"

### 3. Understand AND vs OR

| Goal | Operator | Example |
|------|----------|---------|
| Narrow results | AND | Significant AND strong effect |
| Broaden results | OR | Upregulated OR downregulated |
| Exclude | AND NOT | Significant AND NOT ribosomal |
| Include multiple | OR | Gene list OR pathway members |

### 4. Combine Groups for Complex Logic

For logic like: `(A AND B) OR (C AND D)`
- Create Group 1 with A AND B
- Create Group 2 with C AND D
- Set group operator to OR

### 5. Test with Known Genes

Before applying complex filters:
1. Include a known positive control gene in "gene_id in list"
2. Verify it appears in results
3. Confirms filter is working as expected

### 6. Export Filtered Results

After applying filters:
1. Click "Export CSV"
2. Save for downstream analysis (enrichment, etc.)
3. Document filter settings in your analysis notes

---

## Troubleshooting

### No Results Returned

**Possible Causes**:
1. Filters are too restrictive (too many AND conditions)
2. Threshold values are outside data range
3. Gene IDs don't match (check format: ENSG vs gene names)

**Solutions**:
- Simplify filter (remove some conditions)
- Check value ranges (use broader thresholds)
- Verify gene ID format matches database

### Filter Seems Slow

**Expected Performance**:
- Simple filters (1-2 conditions): <100ms
- Complex filters (5+ conditions, multiple groups): <500ms

**If slower**:
- Check database indexes: `SELECT * FROM pg_indexes WHERE tablename = 'deg_genes'`
- Reduce page size
- Simplify filter logic

### Saved Filter Not Loading

**Causes**:
- localStorage cleared
- Different browser/device
- Project ID mismatch

**Solutions**:
- Re-create and re-save filter
- Export filter definition (copy JSON) for backup
- Use same browser/device

### Unexpected Results

**Debugging Steps**:
1. Click "Clear All" and start fresh
2. Add conditions one at a time
3. Check after each addition
4. Identify which condition causes unexpected behavior
5. Verify operator (AND vs OR)
6. Check group operator (between groups)

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Apply Filters | `Ctrl+Enter` (future) |
| Clear Filters | `Esc` (future) |

---

## API Reference

### Apply Advanced Filter

**Endpoint**: `POST /datasets/{dataset_id}/advanced-filter`

**Parameters**:
- `filter_data` (required): Filter structure
- `comparison_name` (required): Comparison identifier
- `page` (optional, default: 1): Page number
- `page_size` (optional, default: 50): Results per page

**Returns**:
- `genes`: Array of matching genes
- `pagination`: Page metadata
- `filter_summary`: Filter statistics

### Frontend Components

**AdvancedFilterBuilder**:
```typescript
import AdvancedFilterBuilder from '@/components/AdvancedFilterBuilder';

<AdvancedFilterBuilder
  onApplyFilter={(filter) => handleApply(filter)}
  onClearFilter={() => handleClear()}
  savedFilters={savedFilters}
  onSaveFilter={(filter, name) => save(filter, name)}
  onLoadFilter={(filter) => load(filter)}
  onDeleteFilter={(name) => remove(name)}
/>
```

**useSavedFilters Hook**:
```typescript
import { useSavedFilters } from '@/hooks/useSavedFilters';

const { savedFilters, saveFilter, deleteFilter, loadFilter } = useSavedFilters(projectId);
```

---

## File Locations

### Frontend
- **Filter Builder**: `frontend/src/components/AdvancedFilterBuilder.tsx`
- **DEG Table Integration**: `frontend/src/components/DEGTableWithAdvancedFilters.tsx`
- **Persistence Hook**: `frontend/src/hooks/useSavedFilters.ts`

### Backend
- **API Endpoint**: `backend/app/api/endpoints/datasets.py` (lines 1231-1453)
- **Function**: `apply_advanced_filter()`

### Database
- **Table**: `deg_genes`
- **Indexes**: 7 indexes for optimized filtering

---

## Future Enhancements

Planned improvements:

1. **Pathway filtering**: Filter by genes in specific pathways
2. **Expression level filtering**: Filter by raw expression in specific samples
3. **Filter templates**: Pre-built common filters
4. **Filter sharing**: Export/import filters between projects
5. **SQL preview**: Show generated SQL for debugging
6. **Filter history**: Undo/redo for filter changes
7. **Batch operations**: Apply same filter to multiple comparisons

---

## Examples Repository

Common filter templates you can copy and adapt:

### Template 1: Standard Significance
```json
{
  "groups": [{
    "operator": "AND",
    "conditions": [
      {"field": "padj", "operator": "<", "value": 0.05},
      {"field": "logFC", "operator": ">=", "value": 0.58}
    ]
  }],
  "groupOperator": "AND"
}
```

### Template 2: High Confidence
```json
{
  "groups": [{
    "operator": "AND",
    "conditions": [
      {"field": "padj", "operator": "<", "value": 0.001},
      {"field": "logFC", "operator": ">", "value": 2.0}
    ]
  }],
  "groupOperator": "AND"
}
```

### Template 3: Gene List Intersection
```json
{
  "groups": [{
    "operator": "AND",
    "conditions": [
      {"field": "gene_id", "operator": "in_list", "value": "ENSG00000139618\nENSG00000141510\n..."},
      {"field": "padj", "operator": "<", "value": 0.05}
    ]
  }],
  "groupOperator": "AND"
}
```

---

## Support

For questions or issues:
1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common problems
2. Review filter syntax in this document
3. Test with simpler filters to isolate issues
4. Contact technical support with:
   - Filter configuration (JSON)
   - Expected vs actual results
   - Error messages (if any)

---

**Last Updated**: 2025-12-30
**Version**: GenoLens v2.0
**Feature Status**: Production Ready

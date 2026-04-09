/**
 * Types for gene bookmarks and custom gene lists
 */

export interface GeneBookmark {
  id: string;
  user_id: string;
  project_id: string;
  gene_symbol: string;
  gene_id?: string;
  notes?: string;
  tags: string[];
  color?: string;
  is_favorite: boolean;
  extra_data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface GeneBookmarkCreate {
  gene_symbol: string;
  gene_id?: string;
  notes?: string;
  tags?: string[];
  color?: string;
  is_favorite?: boolean;
}

export interface GeneBookmarkUpdate {
  notes?: string;
  tags?: string[];
  color?: string;
  is_favorite?: boolean;
}

export interface GeneList {
  id: string;
  name: string;
  description?: string;
  user_id: string;
  project_id: string;
  genes: string[];
  gene_count: number;
  color?: string;
  is_public: boolean;
  tags: string[];
  extra_data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface GeneListCreate {
  name: string;
  description?: string;
  genes?: string[];
  color?: string;
  is_public?: boolean;
  tags?: string[];
}

export interface GeneListUpdate {
  name?: string;
  description?: string;
  genes?: string[];
  color?: string;
  is_public?: boolean;
  tags?: string[];
}

export interface GeneListAddGenes {
  genes: string[];
}

export interface GeneListRemoveGenes {
  genes: string[];
}

export interface BookmarkBatchCreate {
  gene_symbols: string[];
  tags?: string[];
  notes?: string;
  color?: string;
  is_favorite?: boolean;
}

export interface BookmarkBatchResponse {
  created: number;
  skipped: number;
  bookmarks: GeneBookmark[];
}

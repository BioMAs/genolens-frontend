import { useState } from 'react';
import { AdvancedFilter } from '@/components/AdvancedFilterBuilder';

const STORAGE_KEY = 'genolens_saved_filters';

type StoredFilters = Record<string, AdvancedFilter[]>;

function readStoredFilters(): StoredFilters {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as StoredFilters) : {};
  } catch (error) {
    console.error('Failed to load saved filters:', error);
    return {};
  }
}

function getFiltersForProject(projectId?: string): AdvancedFilter[] {
  const allFilters = readStoredFilters();
  if (projectId) {
    return allFilters[projectId] || [];
  }
  return Object.values(allFilters).flat();
}

export function useSavedFilters(projectId?: string) {
  const [revision, setRevision] = useState(0);
  void revision;
  const savedFilters = getFiltersForProject(projectId);

  const saveFilter = (filter: AdvancedFilter, name: string) => {
    try {
      const allFilters = readStoredFilters();

      const filterWithName = { ...filter, name };

      if (projectId) {
        // Save under project ID
        if (!allFilters[projectId]) {
          allFilters[projectId] = [];
        }

        // Check if filter with same name exists
        const existingIndex = allFilters[projectId].findIndex(
          (f: AdvancedFilter) => f.name === name
        );

        if (existingIndex >= 0) {
          // Update existing
          allFilters[projectId][existingIndex] = filterWithName;
        } else {
          // Add new
          allFilters[projectId].push(filterWithName);
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(allFilters));
      } else {
        // Global filter (no project context)
        if (!allFilters.global) {
          allFilters.global = [];
        }
        allFilters.global.push(filterWithName);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allFilters));
      }
      setRevision((r) => r + 1);
    } catch (error) {
      console.error('Failed to save filter:', error);
    }
  };

  const deleteFilter = (name: string) => {
    try {
      const allFilters = readStoredFilters();

      if (projectId && allFilters[projectId]) {
        allFilters[projectId] = allFilters[projectId].filter(
          (f: AdvancedFilter) => f.name !== name
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allFilters));
      } else if (!projectId && allFilters.global) {
        allFilters.global = allFilters.global.filter(
          (f: AdvancedFilter) => f.name !== name
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allFilters));
      }
      setRevision((r) => r + 1);
    } catch (error) {
      console.error('Failed to delete filter:', error);
    }
  };

  const loadFilter = (name: string): AdvancedFilter | null => {
    const filter = savedFilters.find(f => f.name === name);
    return filter || null;
  };

  const clearAllFilters = () => {
    try {
      const allFilters = readStoredFilters();

      if (projectId) {
        delete allFilters[projectId];
      } else {
        delete allFilters.global;
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(allFilters));
      setRevision((r) => r + 1);
    } catch (error) {
      console.error('Failed to clear filters:', error);
    }
  };

  return {
    savedFilters,
    saveFilter,
    deleteFilter,
    loadFilter,
    clearAllFilters
  };
}

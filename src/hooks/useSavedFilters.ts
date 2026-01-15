import { useState, useEffect } from 'react';
import { AdvancedFilter } from '@/components/AdvancedFilterBuilder';

const STORAGE_KEY = 'genolens_saved_filters';

export function useSavedFilters(projectId?: string) {
  const [savedFilters, setSavedFilters] = useState<AdvancedFilter[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const allFilters = JSON.parse(stored);

        // If projectId is provided, filter by project
        if (projectId && allFilters[projectId]) {
          setSavedFilters(allFilters[projectId] || []);
        } else if (!projectId) {
          // Return all filters across all projects
          setSavedFilters(Object.values(allFilters).flat() as AdvancedFilter[]);
        }
      }
    } catch (error) {
      console.error('Failed to load saved filters:', error);
    }
  }, [projectId]);

  const saveFilter = (filter: AdvancedFilter, name: string) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const allFilters = stored ? JSON.parse(stored) : {};

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
        setSavedFilters(allFilters[projectId]);
      } else {
        // Global filter (no project context)
        if (!allFilters.global) {
          allFilters.global = [];
        }
        allFilters.global.push(filterWithName);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allFilters));
        setSavedFilters(allFilters.global);
      }
    } catch (error) {
      console.error('Failed to save filter:', error);
    }
  };

  const deleteFilter = (name: string) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const allFilters = JSON.parse(stored);

      if (projectId && allFilters[projectId]) {
        allFilters[projectId] = allFilters[projectId].filter(
          (f: AdvancedFilter) => f.name !== name
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allFilters));
        setSavedFilters(allFilters[projectId] || []);
      } else if (!projectId && allFilters.global) {
        allFilters.global = allFilters.global.filter(
          (f: AdvancedFilter) => f.name !== name
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allFilters));
        setSavedFilters(allFilters.global || []);
      }
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
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const allFilters = JSON.parse(stored);

      if (projectId) {
        delete allFilters[projectId];
      } else {
        delete allFilters.global;
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(allFilters));
      setSavedFilters([]);
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

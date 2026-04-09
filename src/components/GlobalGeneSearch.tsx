/**
 * GlobalGeneSearch - Omnipresent gene search with autocomplete.
 * 
 * Features:
 * - Real-time search across all user's projects
 * - Debounced input to avoid excessive API calls
 * - Dropdown results with project/dataset context
 * - Click to navigate to gene location
 * - Keyboard navigation (arrows, enter, escape)
 */
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronRight } from "lucide-react";
import { useGeneSearch } from "@/hooks/useGeneSearch";
import { GeneSearchResult } from "@/types/gene-search";

export default function GlobalGeneSearch() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Fetch search results
  const { data, isLoading } = useGeneSearch({
    query: debouncedQuery,
    enabled: debouncedQuery.trim().length >= 2,
  });

  const results = data?.results || [];

  // Show dropdown when query is active and results exist
  useEffect(() => {
    setIsOpen(debouncedQuery.trim().length >= 2 && (isLoading || results.length > 0));
  }, [debouncedQuery, isLoading, results.length]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelectResult(results[selectedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  // Navigate to gene location
  const handleSelectResult = (result: GeneSearchResult) => {
    setIsOpen(false);
    setQuery("");
    
    // Build navigation URL
    let url = `/projects/${result.project_id}`;
    
    if (result.comparison_name) {
      // Navigate to comparison detail with gene search
      url += `/datasets/${result.dataset_id}/comparisons/${encodeURIComponent(
        result.comparison_name
      )}`;
    }
    
    router.push(url);
  };

  return (
    <div className="relative w-full max-w-md">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (debouncedQuery.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          placeholder="Search genes across projects..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        />
      </div>

      {/* Results Dropdown */}
      {isOpen && (
        <div
          ref={resultsRef}
          className="absolute z-50 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-96 overflow-y-auto"
        >
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No results found for "{debouncedQuery}"
            </div>
          ) : (
            <div className="py-2">
              {results.map((result, index) => (
                <button
                  key={`${result.project_id}-${result.dataset_id}-${result.comparison_name || "none"}`}
                  onClick={() => handleSelectResult(result)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                    index === selectedIndex ? "bg-gray-100 dark:bg-gray-700" : ""
                  }`}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-brand-primary">
                          {result.gene_symbol}
                        </span>
                        {result.gene_id && (
                          <span className="text-xs text-gray-500">
                            {result.gene_id}
                          </span>
                        )}
                      </div>
                      
                      <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {result.project_name}
                      </div>
                      
                      <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                        <span>{result.dataset_name}</span>
                        {result.comparison_name && (
                          <>
                            <ChevronRight className="h-3 w-3" />
                            <span className="font-medium">{result.comparison_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 ml-2" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

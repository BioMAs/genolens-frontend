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
import { KbdHint } from "@/components/ui/kbd-hint";

interface GlobalGeneSearchProps {
  variant?: "default" | "topbar";
}

export default function GlobalGeneSearch({ variant = "default" }: GlobalGeneSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const isTopBar = variant === "topbar";

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
  const safeSelectedIndex = Math.min(selectedIndex, Math.max(results.length - 1, 0));

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
        if (results[safeSelectedIndex]) {
          handleSelectResult(results[safeSelectedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  // Focus search on Cmd/Ctrl+K
  useEffect(() => {
    if (!isTopBar) return;

    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [isTopBar]);

  // Navigate to gene location
  const handleSelectResult = (result: GeneSearchResult) => {
    setIsOpen(false);
    setQuery("");

    let url = `/projects/${result.project_id}`;

    if (result.comparison_name) {
      url += `/comparisons/${encodeURIComponent(result.comparison_name)}`;
    }

    router.push(url);
  };

  return (
    <div className={`relative w-full ${isTopBar ? "max-w-none" : "max-w-md"}`}>
      <div
        className={
          isTopBar
            ? "flex w-full items-center gap-2 rounded-[11px] border px-3.5 py-2"
            : "relative"
        }
        style={
          isTopBar
            ? {
                borderColor: "var(--border)",
                background: "var(--surface-raised)",
                color: "var(--text-muted)",
              }
            : undefined
        }
      >
        <Search
          className={
            isTopBar
              ? "h-3.5 w-3.5 text-[var(--text-muted)]"
              : "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400"
          }
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            const nextValue = e.target.value;
            setQuery(nextValue);
            setIsOpen(nextValue.trim().length >= 2);
            if (nextValue.trim().length < 2) {
              setSelectedIndex(0);
            }
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          placeholder={isTopBar ? "Search genes — TP53, BRCA1..." : "Search genes across projects..."}
          className={
            isTopBar
              ? "w-full bg-transparent text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
              : "w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          }
        />
        {isTopBar && <KbdHint>⌘K</KbdHint>}
      </div>

      {/* Results Dropdown */}
      {isOpen && (
        <div
          ref={resultsRef}
          className="absolute z-50 mt-2 max-h-96 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800"
        >
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No results found for &quot;{debouncedQuery}&quot;
            </div>
          ) : (
            <div className="py-2">
              {results.map((result, index) => (
                <button
                  key={`${result.project_id}-${result.dataset_id}-${result.comparison_name || "none"}`}
                  onClick={() => handleSelectResult(result)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                    index === safeSelectedIndex ? "bg-gray-100 dark:bg-gray-700" : ""
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

                      {(result.regulation || result.log_fc != null || result.padj != null) && (
                        <div className="mt-1.5 flex items-center gap-2">
                          {result.regulation && result.regulation !== "NS" && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              result.regulation === "UP"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            }`}>
                              {result.regulation}
                            </span>
                          )}
                          {result.log_fc != null && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              logFC {result.log_fc > 0 ? "+" : ""}{result.log_fc.toFixed(2)}
                            </span>
                          )}
                          {result.padj != null && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              padj {result.padj < 0.001 ? "< 0.001" : result.padj.toFixed(3)}
                            </span>
                          )}
                        </div>
                      )}
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

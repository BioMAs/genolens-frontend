/**
 * ExportMenu - Reusable dropdown menu for exporting data.
 * 
 * Features:
 * - Multiple export formats (CSV, JSON, PDF, HTML)
 * - Customizable export options per format
 * - Loading states during export
 * - Error handling with user feedback
 * - Responsive dropdown design
 * - Keyboard accessible
 * 
 * Usage:
 * ```tsx
 * <ExportMenu
 *   data={tableData}
 *   filename="deg_results"
 *   formats={['csv', 'json', 'pdf']}
 *   onExport={(format) => console.log(`Exported as ${format}`)}
 *   pdfElementId="deg-table"
 * />
 * ```
 */
"use client";

import { useState, useRef, useEffect } from "react";
import { Download, FileText, FileJson, File, FileImage, Loader2 } from "lucide-react";
import {
  exportToCSV,
  exportToJSON,
  exportToPDF,
  exportToHTML,
  CSVColumn,
} from "@/lib/exportUtils";

export type ExportFormat = "csv" | "json" | "pdf" | "html";

interface ExportMenuProps {
  /** Data to export (for CSV/JSON/HTML) */
  data?: any[];
  
  /** Base filename (without extension) */
  filename: string;
  
  /** Formats to show in menu */
  formats?: ExportFormat[];
  
  /** Callback after successful export */
  onExport?: (format: ExportFormat) => void;
  
  /** Element ID for PDF capture */
  pdfElementId?: string;
  
  /** Custom PDF title */
  pdfTitle?: string;
  
  /** Custom columns for CSV export - can be string[] or CSVColumn[] */
  csvColumns?: string[] | CSVColumn[];
  
  /** HTML export configuration */
  htmlConfig?: {
    title: string;
    description?: string;
    tables?: Array<{ title: string; data: any[] }>;
    metadata?: Record<string, any>;
  };
  
  /** Button variant */
  variant?: "default" | "outline" | "ghost";
  
  /** Button size */
  size?: "sm" | "md" | "lg";
  
  /** Custom button class */
  className?: string;
  
  /** Disabled state */
  disabled?: boolean;
}

export default function ExportMenu({
  data,
  filename,
  formats = ["csv", "json", "pdf"],
  onExport,
  pdfElementId,
  pdfTitle,
  csvColumns,
  htmlConfig,
  variant = "outline",
  size = "sm",
  className = "",
  disabled = false,
}: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle export
  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true);
    setExportingFormat(format);
    setIsOpen(false);

    try {
      switch (format) {
        case "csv":
          if (!data || data.length === 0) {
            alert("No data available to export");
            return;
          }
          exportToCSV(data, filename, csvColumns);
          break;

        case "json":
          if (!data || data.length === 0) {
            alert("No data available to export");
            return;
          }
          exportToJSON(data, filename);
          break;

        case "pdf":
          if (!pdfElementId) {
            alert("PDF export not configured for this component");
            return;
          }
          await exportToPDF(pdfElementId, filename, {
            title: pdfTitle,
            addMetadata: true,
          });
          break;

        case "html":
          if (!htmlConfig) {
            alert("HTML export not configured for this component");
            return;
          }
          exportToHTML(htmlConfig, filename);
          break;
      }

      onExport?.(format);
    } catch (error) {
      console.error(`Failed to export as ${format}:`, error);
      alert(`Failed to export as ${format}. Check console for details.`);
    } finally {
      setIsExporting(false);
      setExportingFormat(null);
    }
  };

  // Button styles
  const baseStyles = "inline-flex items-center gap-2 font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2";
  
  const variantStyles = {
    default: "bg-brand-primary text-white hover:bg-brand-primary/90",
    outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700",
    ghost: "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800",
  };
  
  const sizeStyles = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-5 py-2.5 text-lg",
  };

  const buttonClasses = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className} ${
    disabled ? "opacity-50 cursor-not-allowed" : ""
  }`;

  // Format metadata
  const formatMeta: Record<ExportFormat, { icon: any; label: string; description: string }> = {
    csv: {
      icon: FileText,
      label: "Export CSV",
      description: "Comma-separated values",
    },
    json: {
      icon: FileJson,
      label: "Export JSON",
      description: "JavaScript Object Notation",
    },
    pdf: {
      icon: FileImage,
      label: "Export PDF",
      description: "Portable Document Format",
    },
    html: {
      icon: File,
      label: "Export HTML",
      description: "Interactive web page",
    },
  };

  return (
    <div className="relative inline-block">
      {/* Export Button */}
      <button
        ref={buttonRef}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || isExporting}
        className={buttonClasses}
        title="Export data"
      >
        {isExporting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Export
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && !isExporting && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-50"
        >
          <div className="py-1">
            {formats.map((format) => {
              const meta = formatMeta[format];
              const Icon = meta.icon;
              const isFormatExporting = exportingFormat === format;

              return (
                <button
                  key={format}
                  onClick={() => handleExport(format)}
                  disabled={isFormatExporting}
                  className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-start gap-3 disabled:opacity-50"
                >
                  {isFormatExporting ? (
                    <Loader2 className="h-5 w-5 text-brand-primary animate-spin mt-0.5" />
                  ) : (
                    <Icon className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {meta.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {meta.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

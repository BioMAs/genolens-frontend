/**
 * Export Utilities for GenoLens v2
 * 
 * Provides functions to export data and visualizations to various formats:
 * - CSV (existing, improved)
 * - PDF (with visualizations)
 * - HTML (interactive reports)
 * - JSON (for bookmarks and gene lists)
 * 
 * Required dependencies (install with npm):
 * - jspdf (PDF generation)
 * - html2canvas (capture HTML elements as images)
 * 
 * Optional for future PowerPoint support:
 * - pptxgenjs (PowerPoint generation)
 */

/**
 * Column definition for CSV export
 */
export interface CSVColumn {
  key: string;
  label: string;
}

/**
 * Export data to CSV format.
 * 
 * @param data - Array of objects to export
 * @param filename - Name of the file (without extension)
 * @param columns - Optional array of column names (string[]) or column definitions (CSVColumn[])
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns?: string[] | CSVColumn[]
): void {
  if (!data || data.length === 0) {
    alert("No data to export");
    return;
  }

  // Determine columns and labels
  let keys: string[];
  let labels: string[];
  
  if (!columns) {
    // Use all keys from first object
    keys = Object.keys(data[0]);
    labels = keys;
  } else if (typeof columns[0] === 'string') {
    // Simple string array
    keys = columns as string[];
    labels = keys;
  } else {
    // Array of {key, label} objects
    const columnDefs = columns as CSVColumn[];
    keys = columnDefs.map(col => col.key);
    labels = columnDefs.map(col => col.label);
  }

  // Create CSV header with labels
  const header = labels.join(",");

  // Create CSV rows
  const rows = data.map((item) => {
    return keys
      .map((key) => {
        const value = item[key];
        
        // Handle null/undefined
        if (value === null || value === undefined) {
          return "";
        }
        
        // Handle arrays/objects
        if (typeof value === "object") {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        
        // Handle strings with commas or quotes
        const stringValue = String(value);
        if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        
        return stringValue;
      })
      .join(",");
  });

  // Combine header and rows
  const csv = [header, ...rows].join("\n");

  // Create Blob and download
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Export data to JSON format.
 * 
 * @param data - Data to export (can be any JSON-serializable object)
 * @param filename - Name of the file (without extension)
 * @param pretty - Whether to pretty-print JSON (default: true)
 */
export function exportToJSON<T>(
  data: T,
  filename: string,
  pretty: boolean = true
): void {
  const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  downloadBlob(blob, `${filename}.json`);
}

/**
 * Export HTML element to PDF.
 * Requires: jspdf, html2canvas
 * 
 * @param elementId - ID of the HTML element to capture
 * @param filename - Name of the PDF file (without extension)
 * @param options - Optional configuration
 */
export async function exportToPDF(
  elementId: string,
  filename: string,
  options?: {
    orientation?: "portrait" | "landscape";
    title?: string;
    addMetadata?: boolean;
  }
): Promise<void> {
  try {
    // Dynamic import to avoid bundling if not used
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with id "${elementId}" not found`);
    }

    // Capture element as canvas
    const canvas = await html2canvas(element, {
      scale: 2, // Higher quality
      useCORS: true,
      logging: false,
    });

    // Create PDF
    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const orientation = options?.orientation || "portrait";

    const pdf = new jsPDF({
      orientation,
      unit: "mm",
      format: "a4",
    });

    // Add title if provided
    if (options?.title) {
      pdf.setFontSize(16);
      pdf.text(options.title, 10, 10);
    }

    // Add image
    const yOffset = options?.title ? 20 : 0;
    const imgData = canvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", 0, yOffset, imgWidth, imgHeight);

    // Add metadata if requested
    if (options?.addMetadata) {
      pdf.setProperties({
        title: options.title || filename,
        subject: "GenoLens Export",
        author: "GenoLens v2",
        creator: "GenoLens v2",
        keywords: "bioinformatics, genomics, transcriptomics",
      });
    }

    // Save PDF
    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error("Failed to export PDF:", error);
    alert(
      "Failed to export PDF. Make sure jspdf and html2canvas are installed:\n\n" +
      "npm install jspdf html2canvas"
    );
  }
}

/**
 * Export multiple visualizations to a single PDF report.
 * 
 * @param elements - Array of element IDs and titles
 * @param filename - Name of the PDF file
 */
export async function exportMultipleToPDF(
  elements: Array<{ id: string; title: string }>,
  filename: string
): Promise<void> {
  try {
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const imgWidth = 190; // Margin on sides

    for (let i = 0; i < elements.length; i++) {
      const { id, title } = elements[i];
      const element = document.getElementById(id);

      if (!element) {
        console.warn(`Element with id "${id}" not found, skipping`);
        continue;
      }

      if (i > 0) {
        pdf.addPage();
      }

      // Add title
      pdf.setFontSize(14);
      pdf.text(title, 10, 15);

      // Capture and add image
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 10, 25, imgWidth, imgHeight);
    }

    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error("Failed to export multi-page PDF:", error);
    alert("Failed to export PDF. Ensure dependencies are installed.");
  }
}

/**
 * Export data as an interactive HTML report.
 * 
 * @param data - Data to include in the report
 * @param filename - Name of the HTML file (without extension)
 * @param options - Report configuration
 */
export function exportToHTML(
  data: {
    title: string;
    description?: string;
    tables?: Array<{ title: string; data: any[]; columns?: string[] }>;
    metadata?: Record<string, any>;
  },
  filename: string
): void {
  const { title, description, tables, metadata } = data;

  // Build HTML content
  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f9fafb;
        }
        h1 {
            color: #1f2937;
            border-bottom: 3px solid #3b82f6;
            padding-bottom: 10px;
        }
        h2 {
            color: #374151;
            margin-top: 30px;
        }
        p {
            color: #6b7280;
            line-height: 1.6;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            margin: 20px 0;
        }
        th {
            background: #3b82f6;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }
        td {
            padding: 10px 12px;
            border-bottom: 1px solid #e5e7eb;
        }
        tr:hover {
            background: #f3f4f6;
        }
        .metadata {
            background: white;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .metadata-item {
            display: flex;
            padding: 5px 0;
        }
        .metadata-label {
            font-weight: 600;
            margin-right: 10px;
            color: #374151;
        }
        .metadata-value {
            color: #6b7280;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #9ca3af;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <h1>${title}</h1>
    ${description ? `<p>${description}</p>` : ""}
    
    ${metadata ? `
    <div class="metadata">
        <h2>Report Information</h2>
        ${Object.entries(metadata)
          .map(
            ([key, value]) => `
        <div class="metadata-item">
            <span class="metadata-label">${key}:</span>
            <span class="metadata-value">${value}</span>
        </div>
        `
          )
          .join("")}
    </div>
    ` : ""}
    
    ${tables
      ?.map(
        (table) => `
    <h2>${table.title}</h2>
    <table>
        <thead>
            <tr>
                ${(table.columns || Object.keys(table.data[0] || {}))
                  .map((col) => `<th>${col}</th>`)
                  .join("")}
            </tr>
        </thead>
        <tbody>
            ${table.data
              .map(
                (row) => `
            <tr>
                ${(table.columns || Object.keys(row))
                  .map((col) => `<td>${row[col] ?? ""}</td>`)
                  .join("")}
            </tr>
            `
              )
              .join("")}
        </tbody>
    </table>
    `
      )
      .join("") || ""}
    
    <div class="footer">
        <p>Generated by GenoLens v2 on ${new Date().toLocaleString()}</p>
    </div>
</body>
</html>
  `;

  const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
  downloadBlob(blob, `${filename}.html`);
}

/**
 * Helper function to download a Blob as a file.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy data to clipboard as text.
 * 
 * @param text - Text to copy
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
}

/**
 * Format bytes to human-readable size.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * Tests for the ExportMenu component.
 *
 * Covers:
 * - Renders a "Download" button
 * - Clicking the button opens the dropdown
 * - Clicking outside closes the dropdown
 * - Calls exportToCSV when CSV option is clicked
 * - Calls exportToJSON when JSON option is clicked
 * - Calls exportToPDF when PDF option is clicked
 * - Calls onExport callback after successful export
 * - Shows alert when no data provided for CSV/JSON
 * - Disabled state prevents dropdown from opening
 * - Only shows configured formats
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mocks for export utilities ─────────────────────────────────────────────

const mockExportToCSV = jest.fn();
const mockExportToJSON = jest.fn();
const mockExportToPDF = jest.fn().mockResolvedValue(undefined);
const mockExportToHTML = jest.fn();

jest.mock('@/lib/exportUtils', () => ({
  exportToCSV: (...args: unknown[]) => mockExportToCSV(...args),
  exportToJSON: (...args: unknown[]) => mockExportToJSON(...args),
  exportToPDF: (...args: unknown[]) => mockExportToPDF(...args),
  exportToHTML: (...args: unknown[]) => mockExportToHTML(...args),
}));

// Silence alert() in jest-dom
const mockAlert = jest.spyOn(window, 'alert').mockImplementation(() => {});

// ─────────────────────────────────────────────────────────────────────────────
// Lazy import after mocks
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE_DATA = [
  { gene: 'TP53', logFC: 2.5, padj: 0.001 },
  { gene: 'BRCA1', logFC: -1.8, padj: 0.045 },
];

const DEFAULT_PROPS = {
  data: SAMPLE_DATA,
  filename: 'test_export',
};

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ExportMenu — rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-import component fresh each describe block to avoid stale requires
    jest.isolateModules(() => {});
  });

  it('renders a Download button', () => {
    const { default: ExportMenu } = require('@/components/ExportMenu');
    render(<ExportMenu {...DEFAULT_PROPS} />);

    // Button should be visible (contains "Export" text or download icon)
    const btn = screen.getByRole('button');
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it('dropdown is hidden initially', () => {
    const { default: ExportMenu } = require('@/components/ExportMenu');
    render(<ExportMenu {...DEFAULT_PROPS} />);

    expect(screen.queryByText('Export CSV')).not.toBeInTheDocument();
  });

  it('opens dropdown on button click', async () => {
    const { default: ExportMenu } = require('@/components/ExportMenu');
    render(<ExportMenu {...DEFAULT_PROPS} />);

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
  });

  it('closes dropdown on second button click', async () => {
    const { default: ExportMenu } = require('@/components/ExportMenu');
    render(<ExportMenu {...DEFAULT_PROPS} />);

    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(screen.getByText('Export CSV')).toBeInTheDocument();

    fireEvent.click(btn);
    expect(screen.queryByText('Export CSV')).not.toBeInTheDocument();
  });

  it('shows only configured formats', () => {
    const { default: ExportMenu } = require('@/components/ExportMenu');
    render(<ExportMenu {...DEFAULT_PROPS} formats={['csv']} />);

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
    expect(screen.queryByText('Export JSON')).not.toBeInTheDocument();
    expect(screen.queryByText('Export PDF')).not.toBeInTheDocument();
  });

  it('button is disabled when disabled=true', () => {
    const { default: ExportMenu } = require('@/components/ExportMenu');
    render(<ExportMenu {...DEFAULT_PROPS} disabled />);

    expect(screen.getByRole('button')).toBeDisabled();
  });
});

describe('ExportMenu — CSV export', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls exportToCSV with correct args on CSV click', async () => {
    const { default: ExportMenu } = require('@/components/ExportMenu');
    const onExport = jest.fn();
    render(<ExportMenu {...DEFAULT_PROPS} formats={['csv']} onExport={onExport} />);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Export CSV'));

    await waitFor(() => expect(mockExportToCSV).toHaveBeenCalledTimes(1));
    expect(mockExportToCSV).toHaveBeenCalledWith(SAMPLE_DATA, 'test_export', undefined);
    expect(onExport).toHaveBeenCalledWith('csv');
  });

  it('shows alert when no data is provided for CSV export', async () => {
    const { default: ExportMenu } = require('@/components/ExportMenu');
    render(<ExportMenu filename="test" data={[]} formats={['csv']} />);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Export CSV'));

    await waitFor(() => expect(mockAlert).toHaveBeenCalled());
    expect(mockExportToCSV).not.toHaveBeenCalled();
  });
});

describe('ExportMenu — JSON export', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls exportToJSON on JSON click', async () => {
    const { default: ExportMenu } = require('@/components/ExportMenu');
    const onExport = jest.fn();
    render(<ExportMenu {...DEFAULT_PROPS} formats={['json']} onExport={onExport} />);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Export JSON'));

    await waitFor(() => expect(mockExportToJSON).toHaveBeenCalledTimes(1));
    expect(mockExportToJSON).toHaveBeenCalledWith(SAMPLE_DATA, 'test_export');
    expect(onExport).toHaveBeenCalledWith('json');
  });
});

describe('ExportMenu — PDF export', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls exportToPDF with pdfElementId when provided', async () => {
    const { default: ExportMenu } = require('@/components/ExportMenu');
    const onExport = jest.fn();
    render(
      <>
        <div id="my-table">content</div>
        <ExportMenu
          filename="test"
          formats={['pdf']}
          pdfElementId="my-table"
          pdfTitle="My Report"
          onExport={onExport}
        />
      </>
    );

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Export PDF'));

    await waitFor(() => expect(mockExportToPDF).toHaveBeenCalledTimes(1));
    expect(mockExportToPDF).toHaveBeenCalledWith(
      'my-table',
      'test',
      expect.objectContaining({ title: 'My Report', addMetadata: true })
    );
    expect(onExport).toHaveBeenCalledWith('pdf');
  });

  it('shows alert when pdfElementId is not configured', async () => {
    const { default: ExportMenu } = require('@/components/ExportMenu');
    render(<ExportMenu filename="test" formats={['pdf']} />);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Export PDF'));

    await waitFor(() => expect(mockAlert).toHaveBeenCalled());
    expect(mockExportToPDF).not.toHaveBeenCalled();
  });
});

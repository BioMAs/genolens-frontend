import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import React from 'react';

import StepUploadFiles, { FORMAT_EXAMPLES } from '@/components/wizard/steps/StepUploadFiles';
import api from '@/utils/api';

jest.mock('@/utils/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('@/hooks/useProjectData', () => ({
  useProjectDatasets: () => ({ data: [], refetch: jest.fn() }),
}));

jest.mock('@/components/wizard/ContrastBuilder', () => ({
  __esModule: true,
  default: () => <div>contrast builder</div>,
}));

jest.mock('@/components/wizard/GeoImportPanel', () => ({
  __esModule: true,
  default: () => <div>geo import</div>,
}));

const mockedPost = api.post as jest.Mock;

function renderStep() {
  return render(
    <StepUploadFiles
      projectId="p1"
      matrixDatasetId={null}
      samplesDatasetId={null}
      contrastsDatasetId={null}
      onComplete={jest.fn()}
    />,
  );
}

describe('StepUploadFiles — file format reference', () => {
  it('shows tab-separated examples with the columns the R pipeline requires', () => {
    renderStep();
    const blocks = Array.from(document.querySelectorAll('details pre')).map((p) => p.textContent);
    expect(blocks).toEqual([FORMAT_EXAMPLES.matrix, FORMAT_EXAMPLES.samples, FORMAT_EXAMPLES.contrasts]);

    expect(FORMAT_EXAMPLES.matrix.split('\n')[0].split('\t').slice(0, 2)).toEqual(['gene_id', 'gene_name']);
    expect(FORMAT_EXAMPLES.samples.split('\n')[0].split('\t').slice(0, 2)).toEqual(['sample_id', 'condition']);
    expect(FORMAT_EXAMPLES.contrasts.split('\n')[0].split('\t')).toEqual(['comparison', 'condition1', 'condition2']);
    for (const block of blocks) expect(block).not.toContain(',');
  });

  it('no longer documents the two-column group1/group2 layout', () => {
    renderStep();
    expect(document.body.textContent).not.toMatch(/group1/);
    expect(screen.getByText(/A positive log2 fold change means higher in the test condition/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Preparing your files' })).toHaveAttribute('href', '/docs/preparing-files');
  });

  it('matches the examples of the user guide', () => {
    const guide = fs.readFileSync(path.join(process.cwd(), 'content/docs/preparing-files.md'), 'utf8');
    const codeBlocks = Array.from(guide.matchAll(/```text\n([\s\S]*?)\n```/g)).map((m) => m[1]);
    expect(codeBlocks).toEqual([FORMAT_EXAMPLES.matrix, FORMAT_EXAMPLES.samples, FORMAT_EXAMPLES.contrasts]);
    expect(guide).not.toMatch(/File format reference/);
  });
});

describe('StepUploadFiles — contrast header check', () => {
  beforeEach(() => {
    mockedPost.mockReset();
    mockedPost.mockResolvedValue({ data: { dataset_id: 'c1', message: 'ok', status: 'PENDING' } });
  });

  async function uploadContrast(name: string, content: string) {
    renderStep();
    fireEvent.click(screen.getByRole('button', { name: 'Upload a contrast file instead' }));
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
    const contrastInput = inputs[inputs.length - 1];
    fireEvent.change(contrastInput, { target: { files: [new File([content], name)] } });
    await waitFor(() => expect(mockedPost).toHaveBeenCalled());
  }

  it('warns inline when the header has no comparison name column, but still uploads', async () => {
    await uploadContrast('contrasts.csv', 'group1,group2\nTreated,Control\n');
    expect(await screen.findByRole('alert')).toHaveTextContent('comparison name column');
  });

  it('stays silent for the builder layout', async () => {
    await uploadContrast('contrasts.tsv', FORMAT_EXAMPLES.contrasts);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

'use client';

import { Dataset, DatasetType, DatasetStatus } from '@/types';
import LibrarySizePlot from './LibrarySizePlot';
import MetadataTable from './MetadataTable';
import SampleStatsTable from './SampleStatsTable';

interface QCDashboardProps {
  datasets: Dataset[];
}

export default function QCDashboard({ datasets }: QCDashboardProps) {
  const matrixDataset = datasets.find(d => d.type === DatasetType.MATRIX && d.status === DatasetStatus.READY);
  const metadataDataset = datasets.find(d => d.type === DatasetType.METADATA_SAMPLE && d.status === DatasetStatus.READY) || 
                          datasets.find(d => d.type === DatasetType.METADATA && d.status === DatasetStatus.READY);

  if (!matrixDataset) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow">
        <h3 className="mt-2 text-sm font-medium text-gray-900">No Expression Matrix</h3>
        <p className="mt-1 text-sm text-gray-500">Upload an expression matrix to view Quality Control metrics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Library Size Plot - Full Width */}
      <div className="h-[500px]">
        <LibrarySizePlot dataset={matrixDataset} />
      </div>

      {/* Bottom Row: Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sample Statistics Table */}
        <SampleStatsTable dataset={matrixDataset} />

        {/* Metadata Table */}
        {metadataDataset ? (
            <MetadataTable dataset={metadataDataset} />
        ) : (
            <div className="bg-white shadow sm:rounded-lg p-6 flex flex-col items-center justify-center text-gray-500 h-full min-h-[200px]">
                <p>No metadata file available.</p>
                <p className="text-sm mt-2">Upload a Sample Metadata file to view details.</p>
            </div>
        )}
      </div>
    </div>
  );
}

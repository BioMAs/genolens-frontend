'use client';

import { memo } from 'react';
import DEGTable from './DEGTable';
import { Dataset } from '@/types';

interface DEGTableMemoProps {
  dataset: Dataset;
  comparisonName: string;
}

// Memoized version of DEGTable for performance
// Only re-renders if dataset ID or comparison name changes
const DEGTableMemo = memo(
  DEGTable,
  (prevProps, nextProps) => {
    return (
      prevProps.dataset.id === nextProps.dataset.id &&
      prevProps.comparisonName === nextProps.comparisonName
    );
  }
);

DEGTableMemo.displayName = 'DEGTableMemo';

export default DEGTableMemo;

'use client';

/**
 * Resolves a `?geneList=<id>` link into a selection.
 *
 * A set of genes is the one thing on this screen the URL cannot carry directly — three hundred
 * symbols do not belong in a query string, and a lasso is not a stable artifact anyway. Saving
 * the set gives it an id, and that id is what travels. The cost is that the link cannot be
 * resolved during render like the thresholds and the focused gene: the genes live in the API.
 *
 * Hence a fetch, and hence a component rather than a line in the provider. It renders nothing.
 * The provider stops offering the pending id as soon as anything is selected, so applying the
 * list is a one-shot — the user is then free to change the selection without the link dragging
 * it back on the next render.
 */

import { useEffect } from 'react';
import { useComparisonActions, usePendingGeneListId } from '@/contexts/ComparisonSelectionContext';
import { useGeneLists } from '@/hooks/useBookmarks';

export default function GeneListDeepLink({ projectId }: { projectId: string }) {
  const pendingId = usePendingGeneListId();
  const { selectGeneList } = useComparisonActions();

  // The lists endpoint returns them all; there is no fetch-one route, and the payload is small.
  const { data: lists } = useGeneLists(projectId, true, !!pendingId);
  const list = pendingId ? lists?.find((candidate) => candidate.id === pendingId) : undefined;

  // Syncing state in from a source outside React is what an effect is for — the genes simply
  // are not knowable at render time.
  useEffect(() => {
    if (!list || list.genes.length === 0) return;
    selectGeneList(list.id, list.name, list.genes);
  }, [list, selectGeneList]);

  return null;
}

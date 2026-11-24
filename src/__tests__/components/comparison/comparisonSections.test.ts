/**
 * The contract between the comparison module catalogue and the comparison screen.
 *
 * **Every anchor the catalogue emits has a section to land on**: a link to `#network` when nothing
 * renders `id="network"` scrolls nowhere and looks broken, and it is the single most likely defect
 * in a screen built from anchors. This guard used to live next to the comparison sidebar nav; it
 * stays here now that the nav is gone, because the catalogue (`comparisonModules`) still drives
 * the panel tabs and the anchors they scroll to.
 */
import {
  buildComparisonModules,
  groupModulesByView,
} from '@/components/comparison/comparisonModules';

/** Every `id` the comparison screen actually renders, read from the component's source. */
function renderedSectionIds(): Set<string> {
  // Reading the source is deliberate: the alternative is mounting ComparisonDetail with its
  // fifteen fetches, and this assertion is about the contract between two files, not about
  // rendering. A missing target is exactly what the source can prove.
  const fs = jest.requireActual<typeof import('fs')>('fs');
  const path = jest.requireActual<typeof import('path')>('path');
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/components/ComparisonDetail.tsx'),
    'utf8'
  );
  return new Set([...source.matchAll(/<section id="([a-z-]+)"/g)].map((m) => m[1]));
}

describe('every anchor has a target', () => {
  // The single most likely defect in an anchor-driven screen.
  it('emits no panel link whose section the comparison screen does not render', () => {
    const ids = renderedSectionIds();
    const groups = groupModulesByView(
      buildComparisonModules({
        hasMatrix: true,
        hasEnrichmentFile: true,
        cosmeticsUnlocked: true,
        reportUnlocked: true,
        scienceUnlocked: true,
        drugDiscoveryUnlocked: true,
        stats: null,
      })
    );

    const missing = groups
      .flatMap((g) => g.modules)
      .filter((m) => m.state === 'ready' && !ids.has(m.panel))
      .map((m) => `${m.id} → #${m.panel}`);

    expect(missing).toEqual([]);
  });

  it('finds a section for every view, so no group opens onto nothing', () => {
    const ids = renderedSectionIds();
    const groups = groupModulesByView(
      buildComparisonModules({
        hasMatrix: true,
        hasEnrichmentFile: true,
        cosmeticsUnlocked: true,
        reportUnlocked: true,
        scienceUnlocked: true,
        drugDiscoveryUnlocked: true,
        stats: null,
      })
    );

    for (const group of groups) {
      const rendered = group.modules.filter((m) => ids.has(m.panel));
      expect(rendered.length).toBeGreaterThan(0);
    }
  });
});

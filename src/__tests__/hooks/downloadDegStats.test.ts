/**
 * Le CSV des p-values par méthode : même requête et même nom de fichier que l'écran d'avant
 * (`ComparisonDetail.downloadDegStats`), maintenant partagés par la vue Genes de la lecture.
 */
import api from '@/utils/api';
import { downloadDegStats } from '@/hooks/useDegGenes';

jest.mock('@/utils/api', () => ({ __esModule: true, default: { get: jest.fn() } }));

const mockGet = api.get as jest.Mock;

describe('downloadDegStats', () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  let clickSpy: jest.SpyInstance;

  beforeEach(() => {
    URL.createObjectURL = jest.fn(() => 'blob:deg-stats');
    URL.revokeObjectURL = jest.fn();
    clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    mockGet.mockReset();
  });

  afterEach(() => {
    clickSpy.mockRestore();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });

  it('asks the stats export of the dataset, for the comparison, as a blob', async () => {
    mockGet.mockResolvedValue({ data: 'csv' });
    await downloadDegStats('deg-1', 'KO_vs_WT');
    expect(mockGet).toHaveBeenCalledWith('/datasets/deg-1/deg-stats/export', {
      params: { comparison: 'KO_vs_WT' },
      responseType: 'blob',
    });
  });

  it('saves the file as deg_stats_<comparison>.csv and frees the object URL', async () => {
    mockGet.mockResolvedValue({ data: 'csv' });
    await downloadDegStats('deg-1', 'KO_vs_WT');
    // `mock.contexts` : l'ancre sur laquelle `click()` a été appelé.
    const [anchor] = clickSpy.mock.contexts as HTMLAnchorElement[];
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(anchor.download).toBe('deg_stats_KO_vs_WT.csv');
    expect(anchor.href).toBe('blob:deg-stats');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:deg-stats');
  });

  it('logs a failure instead of throwing, and saves nothing', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGet.mockRejectedValue(new Error('boom'));
    await expect(downloadDegStats('deg-1', 'KO_vs_WT')).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith('DEG stats download failed', expect.any(Error));
    expect(clickSpy).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

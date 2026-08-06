import {
  hasSeenTour,
  markTourSeen,
  clearTourSeen,
  tourStorageKey,
} from '@/lib/tours/storage';

describe('tour storage', () => {
  beforeEach(() => localStorage.clear());

  it('builds a versioned key', () => {
    expect(tourStorageKey('dashboard', 1)).toBe('genolens.tour.dashboard.v1');
  });

  it('reports unseen tours as not seen', () => {
    expect(hasSeenTour('dashboard', 1)).toBe(false);
  });

  it('marks a tour seen and reads it back', () => {
    markTourSeen('dashboard', 1);
    expect(hasSeenTour('dashboard', 1)).toBe(true);
  });

  it('treats a new version as unseen', () => {
    markTourSeen('dashboard', 1);
    expect(hasSeenTour('dashboard', 2)).toBe(false);
  });

  it('clears a seen tour', () => {
    markTourSeen('dashboard', 1);
    clearTourSeen('dashboard', 1);
    expect(hasSeenTour('dashboard', 1)).toBe(false);
  });

  it('does not throw when localStorage getItem fails', () => {
    const spy = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    expect(hasSeenTour('dashboard', 1)).toBe(false);
    spy.mockRestore();
  });
});

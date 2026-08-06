import { render, screen, fireEvent } from '@testing-library/react';
import HelpTourButton from '@/components/onboarding/HelpTourButton';

const restartCurrentTour = jest.fn();
let currentTourId: string | null = 'dashboard';
jest.mock('@/contexts/TourContext', () => ({
  useTour: () => ({ restartCurrentTour, currentTourId, startTour: jest.fn() }),
}));

describe('HelpTourButton', () => {
  beforeEach(() => restartCurrentTour.mockClear());

  it('restarts the current tour on click', () => {
    currentTourId = 'dashboard';
    render(<HelpTourButton />);
    fireEvent.click(screen.getByRole('button', { name: /guide/i }));
    expect(restartCurrentTour).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when the route has no tour', () => {
    currentTourId = null;
    const { container } = render(<HelpTourButton />);
    expect(container.firstChild).toBeNull();
  });
});

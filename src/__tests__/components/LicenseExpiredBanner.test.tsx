/**
 * Le bandeau de licence expiree et la barre du haut collee.
 *
 * Le bandeau etait `fixed top-0 z-[9999]` : pose sur le bord haut de la fenetre,
 * il recouvrait la barre du haut des qu'elle y est collee — la marque, la
 * navigation et le menu du compte disparaissaient sous un bandeau rouge. Il est
 * maintenant dans le flux, `sticky` SOUS la barre : toujours visible, jamais par
 * dessus elle, et toujours sous la palette de commandes et les dialogues
 * (z-[10000]).
 */
import { render, screen } from '@testing-library/react';

let license: { valid: boolean; expires_at?: number } | undefined = { valid: false, expires_at: 1767225600 };
jest.mock('@/hooks/useLicenseStatus', () => ({
  useLicenseStatus: () => ({ data: license, isLoading: false }),
}));

import LicenseExpiredBanner from '@/components/LicenseExpiredBanner';

beforeEach(() => {
  license = { valid: false, expires_at: 1767225600 };
});

describe('LicenseExpiredBanner', () => {
  it('renders nothing for a valid license', () => {
    license = { valid: true };
    const { container } = render(<LicenseExpiredBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('sticks under the top bar instead of fixing itself over it', () => {
    render(<LicenseExpiredBanner />);
    const banner = screen.getByRole('alert');

    expect(banner).toHaveClass('sticky');
    expect(banner).not.toHaveClass('fixed');
    expect(banner.className).toContain('top-[var(--topbar-height)]');
  });

  it('stacks below the top bar (z-40) and far below the palette and dialogs (z-10000)', () => {
    render(<LicenseExpiredBanner />);
    const banner = screen.getByRole('alert');

    expect(banner).toHaveClass('z-30');
    expect(banner.className).not.toContain('z-[9999]');
  });

  it('still says what expired and who to contact', () => {
    render(<LicenseExpiredBanner />);
    expect(screen.getByRole('alert')).toHaveTextContent(/license expired/i);
    expect(screen.getByRole('link')).toHaveAttribute('href', expect.stringMatching(/^mailto:/));
  });
});

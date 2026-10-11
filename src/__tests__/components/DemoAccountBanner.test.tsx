/**
 * The discreet demo-account notice mounted in AppFrame.
 *
 * It says until when the demo runs and what is left of its AI requests. It is
 * silent for any other account, and once the access period has ended — the
 * read-only banner takes over then, and two notices would repeat each other.
 */
import { render, screen } from '@testing-library/react';

import DemoAccountBanner from '@/components/DemoAccountBanner';

const mockProfile = jest.fn();

// `useQuotas` composes the same hook, so both read this one profile.
jest.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => mockProfile(),
}));

const DEMO = {
  id: 'u1',
  email: 'demo@prospect.com',
  role: 'USER',
  subscription_plan: 'TEAM',
  ai_interpretations_used: 0,
  ai_tokens_purchased: 0,
  ai_tokens_used: 0,
  analyses_quota: 3,
  analyses_remaining: 2,
  is_demo: true,
  // Midday UTC: the date renders in local time, like the read-only banner's.
  subscription_ends_at: '2026-10-31T12:00:00Z',
  subscription_expired: false,
  ai_requests_limit: 20,
  ai_requests_used: 15,
  ai_requests_remaining: 5,
};

function withProfile(data: Record<string, unknown> | undefined, isLoading = false) {
  mockProfile.mockReturnValue({ data, isLoading, isError: false });
}

beforeEach(() => jest.clearAllMocks());

it('says until when the demo runs and how many AI requests are left', () => {
  withProfile(DEMO);
  render(<DemoAccountBanner />);
  expect(screen.getByTestId('demo-account-banner')).toHaveTextContent(
    'Demo account — access until 31 October 2026 · 5 AI requests left',
  );
});

it('uses the singular for the last AI request', () => {
  withProfile({ ...DEMO, ai_requests_used: 19, ai_requests_remaining: 1 });
  render(<DemoAccountBanner />);
  expect(screen.getByTestId('demo-account-banner')).toHaveTextContent('1 AI request left');
});

it('leaves the AI part out when the demo has no AI cap', () => {
  withProfile({ ...DEMO, ai_requests_limit: null, ai_requests_remaining: null });
  render(<DemoAccountBanner />);
  const banner = screen.getByTestId('demo-account-banner');
  expect(banner).toHaveTextContent('Demo account — access until 31 October 2026');
  expect(banner).not.toHaveTextContent(/AI/);
});

it('renders nothing for an account that is not a demo', () => {
  withProfile({ ...DEMO, is_demo: false });
  const { container } = render(<DemoAccountBanner />);
  expect(container).toBeEmptyDOMElement();
});

it('renders nothing when the backend does not serve the flag yet', () => {
  const { is_demo: _omit, ...withoutFlag } = DEMO;
  void _omit;
  withProfile(withoutFlag);
  const { container } = render(<DemoAccountBanner />);
  expect(container).toBeEmptyDOMElement();
});

it('gives way to the read-only banner once the access period has ended', () => {
  withProfile({ ...DEMO, subscription_expired: true });
  const { container } = render(<DemoAccountBanner />);
  expect(container).toBeEmptyDOMElement();
});

it('renders nothing while the profile is loading', () => {
  withProfile(undefined, true);
  const { container } = render(<DemoAccountBanner />);
  expect(container).toBeEmptyDOMElement();
});

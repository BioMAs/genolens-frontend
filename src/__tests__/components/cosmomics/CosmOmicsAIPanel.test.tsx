/**
 * The AI reading of the nova: it asks before the first call and says what leaves,
 * labels the text with its model and date, shows a saved text without calling the
 * model, flags a stale one, and is closed to accounts without AI access.
 *
 * The real hooks run on a mocked HTTP client, so what is asserted is what would
 * reach the server: no POST before the user agrees.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import api from '@/utils/api';
import CosmOmicsAIPanel from '@/components/cosmomics/CosmOmicsAIPanel';
import { PLAN_GATE_COPY } from '@/utils/plan';

jest.mock('@/utils/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
const mockProfile = jest.fn();
jest.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => mockProfile(),
  invalidateUserProfile: jest.fn(),
}));

const get = api.get as jest.Mock;
const post = api.post as jest.Mock;

const BASE = '/datasets/ds-1/comparisons/A_vs_B/cosmomics-nova';
const TEAM = { data: { role: 'USER', subscription_plan: 'TEAM' }, isLoading: false };
const STARTER = { data: { role: 'USER', subscription_plan: 'STARTER' }, isLoading: false };

const reading = {
  interpretation: '## Claim-by-claim reading\nThe reading text.',
  cached: true,
  stale: false,
  model: 'model-1',
  generated_at: '2026-11-05T09:30:00+00:00',
  inputs_sha256: 'abc',
  claims_sent: 2,
  claims_total: 2,
  claims_count: 2,
};

const notFound = () => Promise.reject({ response: { status: 404, data: { detail: 'No AI reading' } } });

function renderPanel(props: Partial<React.ComponentProps<typeof CosmOmicsAIPanel>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CosmOmicsAIPanel datasetId="ds-1" comparisonName="A_vs_B" alpha={0.05} {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  mockProfile.mockReset().mockReturnValue(TEAM);
});

describe('CosmOmicsAIPanel', () => {
  it('AI panel asks before the first call and labels model and date', async () => {
    get.mockImplementation(notFound);
    post.mockResolvedValue({ data: { ...reading, cached: false } });
    renderPanel();

    const generate = await screen.findByRole('button', { name: 'Generate interpretation' });
    await waitFor(() => expect(generate).toBeEnabled());
    fireEvent.click(generate);

    // The consent says what leaves, and what does not. Nothing has been sent yet.
    const consent = screen.getByRole('region', { name: 'Before the AI is called' });
    expect(consent).toHaveTextContent('names of the claims and of their pathway sub-groups');
    expect(consent).toHaveTextContent('direction');
    expect(consent).toHaveTextContent('counts');
    expect(consent).toHaveTextContent('p-values');
    expect(consent).toHaveTextContent(/Not sent: the comparison name, any gene list/);
    expect(consent).toHaveTextContent('raw data');
    expect(consent).toHaveTextContent('one AI request');
    expect(consent).toHaveTextContent('named on the text once it is written');
    expect(post).not.toHaveBeenCalled();

    fireEvent.click(within(consent).getByRole('button', { name: 'Agree and generate' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith(`${BASE}/interpret`, null, {
      params: { force_regenerate: false, alpha: 0.05 },
    });
    expect(await screen.findByText('AI-generated text (model model-1, generated 2026-11-05)')).toBeInTheDocument();
    expect(screen.getByText(/The reading text\./)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Before the AI is called' })).toBeNull();
  });

  it('lets the user back out of the consent without any call', async () => {
    get.mockImplementation(notFound);
    renderPanel();
    const generate = await screen.findByRole('button', { name: 'Generate interpretation' });
    await waitFor(() => expect(generate).toBeEnabled());
    fireEvent.click(generate);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('region', { name: 'Before the AI is called' })).toBeNull();
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Generate interpretation' })).toBeInTheDocument();
  });

  it('AI panel shows a cached text without calling the LLM', async () => {
    get.mockResolvedValue({ data: reading });
    renderPanel({ alpha: 0.1 });

    expect(await screen.findByText(/The reading text\./)).toBeInTheDocument();
    expect(screen.getByText('AI-generated text (model model-1, generated 2026-11-05)')).toBeInTheDocument();
    // The saved text is read, never generated: a GET, with the nova's alpha, and no POST.
    expect(get).toHaveBeenCalledWith(`${BASE}/interpretation`, { params: { alpha: 0.1 } });
    expect(post).not.toHaveBeenCalled();
    expect(screen.queryByText(/out of date/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeInTheDocument();
  });

  it('AI panel says when the text is stale', async () => {
    get.mockResolvedValue({ data: { ...reading, stale: true } });
    post.mockResolvedValue({ data: { ...reading, cached: false, model: 'model-2' } });
    renderPanel();

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('Out of date');
    expect(notice).toHaveTextContent('written from other results');
    // Still readable, but labelled as the text it is, and a new one is offered.
    expect(screen.getByText(/The reading text\./)).toBeInTheDocument();
    expect(screen.getByText('AI-generated text (model model-1, generated 2026-11-05)')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }));
    // The model that wrote the saved text is named in the consent.
    const consent = screen.getByRole('region', { name: 'Before the AI is called' });
    expect(consent).toHaveTextContent('model-1');
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(within(consent).getByRole('button', { name: 'Agree and generate' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][2]).toEqual({ params: { force_regenerate: true, alpha: 0.05 } });
    // The fresh text replaces the stale one, and the notice goes.
    expect(await screen.findByText('AI-generated text (model model-2, generated 2026-11-05)')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('asks once per visit: a second generation does not ask again', async () => {
    get.mockResolvedValue({ data: reading });
    post.mockResolvedValue({ data: { ...reading, cached: false } });
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Regenerate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agree and generate' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Regenerate' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('region', { name: 'Before the AI is called' })).toBeNull();
  });

  it('says when the reading covers fewer claims than the nova has', async () => {
    get.mockResolvedValue({ data: { ...reading, claims_sent: 9, claims_total: 12 } });
    renderPanel();
    expect(await screen.findByText('Covers 9 of 12 claims.')).toBeInTheDocument();
  });

  it('AI panel is disabled without AI access', async () => {
    mockProfile.mockReturnValue(STARTER);
    renderPanel();

    const generate = screen.getByRole('button', { name: 'Generate interpretation' });
    expect(generate).toBeDisabled();
    expect(screen.getByText(PLAN_GATE_COPY.ai)).toBeInTheDocument();
    fireEvent.click(generate);
    expect(screen.queryByRole('region', { name: 'Before the AI is called' })).toBeNull();
    // Neither the saved text nor the model is asked for.
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('is disabled while the parent says so, even with AI access', async () => {
    get.mockImplementation(notFound);
    renderPanel({ disabled: true });
    expect(await screen.findByRole('button', { name: 'Generate interpretation' })).toBeDisabled();
  });

  it('shows what went wrong when the saved text cannot be read', async () => {
    get.mockRejectedValue({ response: { status: 500, data: { detail: 'Boom' } } });
    renderPanel();
    expect(await screen.findByText('Boom')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
});

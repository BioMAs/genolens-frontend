/**
 * The floating menu of the reading: one link per part, the part being read flagged, the parts
 * outside the plan marked, and below 75rem a `Sections` button that opens and closes the list.
 *
 * jsdom applies no stylesheet, so what the layout does at each width (hidden list, sticky or
 * fixed panel) is asserted on the classes that carry it; what the menu DOES is asserted on roles.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReadingMenu from '@/components/reading/ReadingMenu';
import { READING_PARTS, type ReadingPart } from '@/components/reading/readingRoutes';

const hrefFor = (part: ReadingPart) => `#${part}`;

function renderMenu(
  props: Partial<React.ComponentProps<typeof ReadingMenu>> = {}
) {
  return render(<ReadingMenu active="answers" locked={{}} hrefFor={hrefFor} {...props} />);
}

const toggle = () => screen.getByRole('button', { name: 'Sections' });

describe('ReadingMenu — the parts', () => {
  it('is a navigation landmark named for what it lists', () => {
    renderMenu();
    expect(screen.getByRole('navigation', { name: 'Parts of this result' })).toBeInTheDocument();
  });

  it('lists every part, in reading order, with the labels of the route table', () => {
    renderMenu();
    const links = within(screen.getByRole('navigation')).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(READING_PARTS.map((p) => `#${p.id}`));
    expect(links.map((a) => a.textContent)).toEqual(
      READING_PARTS.map((p) => (p.number ? `${p.number}${p.label}` : p.label))
    );
  });

  it('puts the three applications in a list nested under Applications', () => {
    renderMenu();
    const applications = screen.getByRole('link', { name: 'Applications' }).closest('li');
    expect(applications).not.toBeNull();
    const nested = within(applications as HTMLElement).getByRole('list');
    expect(within(nested).getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Drug targets',
      'Skin claims',
      'Signature score',
    ]);
    // …and only those: the other parts stay at the top level.
    expect(within(nested).queryByRole('link', { name: 'Processes' })).toBeNull();
  });

  it('shows a question\'s number before its label without adding it to the link name', () => {
    renderMenu();
    const counts = screen.getByRole('link', { name: 'Gene counts' });
    expect(counts.textContent).toBe('1Gene counts');
    expect(counts.querySelector('[aria-hidden="true"]')?.textContent).toBe('1');
    expect(screen.getByRole('link', { name: 'Answers' }).textContent).toBe('Answers');
  });

  it('builds each link from hrefFor', () => {
    renderMenu({ hrefFor: (p) => `/projects/p1/comparisons/c1#part-${p}` });
    expect(screen.getByRole('link', { name: 'Top genes' })).toHaveAttribute(
      'href',
      '/projects/p1/comparisons/c1#part-genes'
    );
  });
});

describe('ReadingMenu — the part being read and the locked ones', () => {
  it('flags the active part and the locked ones', () => {
    render(
      <ReadingMenu active="skin" locked={{ signature: true }} hrefFor={(p) => `#${p}`} />
    );
    expect(screen.getByRole('link', { name: 'Skin claims' })).toHaveAttribute(
      'aria-current',
      'location'
    );
    expect(
      screen.getByRole('link', { name: 'Signature score, not in your plan' })
    ).toBeInTheDocument();
  });

  it('flags the active part and no other', () => {
    renderMenu({ active: 'processes' });
    const current = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'location');
    expect(current.map((a) => a.getAttribute('href'))).toEqual(['#processes']);
  });

  it('fills the active part with the plum tint, and only that one', () => {
    renderMenu({ active: 'genes' });
    expect(screen.getByRole('link', { name: 'Top genes' })).toHaveClass('bg-plum-soft');
    expect(screen.getByRole('link', { name: 'Processes' })).not.toHaveClass('bg-plum-soft');
  });

  it('keeps the lock out of the accessible name and the suffix out of sight', () => {
    renderMenu({ locked: { targets: true } });
    const link = screen.getByRole('link', { name: 'Drug targets, not in your plan' });
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(within(link).getByText(', not in your plan')).toHaveClass('sr-only');
  });

  it('leaves an unlocked part with its plain name', () => {
    renderMenu({ locked: { signature: true } });
    expect(screen.getByRole('link', { name: 'Drug targets' })).toBeInTheDocument();
    // One locked part, one suffix: nothing leaks onto its neighbours.
    expect(screen.getAllByText(', not in your plan')).toHaveLength(1);
  });

  it('can be both active and locked', () => {
    renderMenu({ active: 'signature', locked: { signature: true } });
    const link = screen.getByRole('link', { name: 'Signature score, not in your plan' });
    expect(link).toHaveAttribute('aria-current', 'location');
  });
});

describe('ReadingMenu — the Sections button', () => {
  it('is a plain button wired to the list it opens', () => {
    renderMenu();
    expect(toggle()).toHaveAttribute('type', 'button');
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    const controlled = document.getElementById(toggle().getAttribute('aria-controls') ?? '');
    expect(controlled).not.toBeNull();
    expect(controlled?.tagName).toBe('UL');
    expect(within(controlled as HTMLElement).getAllByRole('link').length).toBe(READING_PARTS.length);
  });

  it('is hidden from 75rem up, where the list is always shown', () => {
    renderMenu();
    expect(toggle()).toHaveClass('min-[75rem]:hidden');
    const list = document.getElementById(toggle().getAttribute('aria-controls') ?? '');
    expect(list).toHaveClass('hidden');
    expect(list).toHaveClass('min-[75rem]:block');
  });

  it('opens and closes the list on click', async () => {
    const user = userEvent.setup();
    renderMenu();
    const list = document.getElementById(toggle().getAttribute('aria-controls') ?? '');

    await user.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(list).not.toHaveClass('hidden');

    await user.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(list).toHaveClass('hidden');
  });

  it('closes on Escape and gives the focus back to the button', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');

    // The keyboard reader tabs into the list, then changes their mind.
    await user.tab();
    expect(screen.getByRole('link', { name: 'Answers' })).toHaveFocus();
    await user.keyboard('{Escape}');

    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(toggle()).toHaveFocus();
  });

  it('closes on Escape even when the focus is not inside the menu, and leaves it where it is', async () => {
    const user = userEvent.setup();
    render(
      <>
        <input aria-label="Elsewhere" />
        <ReadingMenu active="answers" locked={{}} hrefFor={hrefFor} />
      </>
    );

    await user.click(toggle());
    await user.click(screen.getByLabelText('Elsewhere'));
    await user.keyboard('{Escape}');

    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByLabelText('Elsewhere')).toHaveFocus();
  });

  it('ignores Escape while it is already closed', async () => {
    const user = userEvent.setup();
    renderMenu();
    toggle().focus();
    await user.keyboard('{Escape}');
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes after a link is followed', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('link', { name: 'Top genes' }));
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes after a nested link is followed too', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(toggle());
    await user.click(screen.getByRole('link', { name: 'Skin claims' }));
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('stops listening for Escape once unmounted', async () => {
    const user = userEvent.setup();
    const remove = jest.spyOn(document, 'removeEventListener');
    const { unmount } = renderMenu();
    await user.click(toggle());
    unmount();
    expect(remove.mock.calls.some(([type]) => type === 'keydown')).toBe(true);
    remove.mockRestore();
  });
});

describe('ReadingMenu — where the panel sits', () => {
  it('is fixed at the bottom right below 75rem and sticky under the top bar from 75rem', () => {
    renderMenu();
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveClass('fixed', 'bottom-4', 'right-4');
    expect(nav).toHaveClass('min-[75rem]:sticky');
    // Below the top bar (z-40) and its sticky bands, never under them.
    expect(nav.className).toMatch(/min-\[75rem\]:top-\[calc\(var\(--sticky-top\)/);
    expect(nav).toHaveClass('min-[75rem]:bottom-auto', 'min-[75rem]:right-auto');
  });
});

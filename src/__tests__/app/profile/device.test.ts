/**
 * `describeDevice` turns the `User-Agent` a session opened with into a name a
 * person can recognise. The order of its checks is what these cases pin: Edge
 * and Chrome also say "Safari", an iPhone says "Mac OS X", Android says "Linux".
 */
import { describeDevice } from '@/app/profile/security/device';

it.each([
  [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Chrome on macOS',
  ],
  [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
    'Safari on macOS',
  ],
  [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    'Safari on iPhone',
  ],
  [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
    'Edge on Windows',
  ],
  ['Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0', 'Firefox on Linux'],
  [
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    'Chrome on Android',
  ],
])('names %s', (userAgent, name) => {
  expect(describeDevice(userAgent)).toBe(name);
});

it('shows what it cannot read as it came', () => {
  expect(describeDevice('curl/8.5.0')).toBe('curl/8.5.0');
});

it('has a name for a session that sent no user agent', () => {
  expect(describeDevice(null)).toBe('Unknown device');
});

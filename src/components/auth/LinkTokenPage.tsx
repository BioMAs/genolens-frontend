'use client';

import AuthFrame from '@/components/auth/AuthFrame';
import { useLinkToken } from '@/hooks/useLinkToken';

interface LinkTokenPageProps {
  title: string;
  /** What the page says when the link carries no token. */
  dead: React.ReactNode;
  /** The page proper, once the token has been read from the URL. */
  children(token: string): React.ReactNode;
}

/**
 * A page opened from an e-mailed link: reads the token (see `useLinkToken`),
 * shows nothing until it has, `dead` when the link carries none, and otherwise
 * the page, handed the token.
 */
export default function LinkTokenPage({ title, dead, children }: LinkTokenPageProps) {
  const token = useLinkToken();

  return (
    <AuthFrame title={title}>
      {token === undefined ? null : token === null ? dead : children(token)}
    </AuthFrame>
  );
}

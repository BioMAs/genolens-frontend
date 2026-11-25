'use client';

import type { ReactNode } from 'react';

import { signOut } from '@/utils/auth/client';

/**
 * Ends the session from a server-rendered page. It cannot be a link or a form
 * posting to a Next route: the refresh cookie is visible to the API only, so it
 * is the browser that has to make the call and receive the cookies' erasure.
 * (A `GET` would also sign the user out on a mere prefetch.)
 */
export default function SignOutButton({
  className,
  role,
  children,
}: {
  className?: string;
  role?: string;
  children: ReactNode;
}) {
  return (
    <button type="button" role={role} className={className} onClick={() => void signOut()}>
      {children}
    </button>
  );
}

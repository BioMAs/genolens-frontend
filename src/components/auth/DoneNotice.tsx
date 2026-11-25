import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import AuthAlert from '@/components/auth/AuthAlert';

/**
 * The end of a flow that opens no session (a password changed, an address
 * confirmed): say so, and lead to the sign-in page.
 */
export default function DoneNotice({ message }: { message: string }) {
  return (
    <>
      <AuthAlert tone="ok">{message}</AuthAlert>
      <Link href="/" className="auth-btn mt-5">
        Go to sign in
        <ArrowRight className="auth-btn-arrow h-4 w-4" aria-hidden="true" />
      </Link>
    </>
  );
}

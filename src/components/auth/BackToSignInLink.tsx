import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/** The way out of an auth card that has nothing else to offer. */
export default function BackToSignInLink() {
  return (
    <p className="mt-5 text-center text-[13px]">
      <Link href="/" className="auth-link inline-flex items-center gap-1.5">
        <ArrowLeft size={13} aria-hidden="true" />
        Back to sign in
      </Link>
    </p>
  );
}

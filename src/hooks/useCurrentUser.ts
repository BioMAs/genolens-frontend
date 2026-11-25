/**
 * Hook to get the current authenticated user.
 */
import { useMemo } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";

export interface CurrentUser {
  id: string;
  email?: string;
  name?: string;
}

/**
 * Get the current authenticated user.
 *
 * Derived from the shared `/users/me` query: the session lives in httpOnly
 * cookies the page cannot read, so there is no browser-side session to ask or
 * to listen to. Nobody (`user: null`) until the profile has been read, and
 * when it cannot be (signed out, API down).
 */
export function useCurrentUser(): { user: CurrentUser | null; loading: boolean } {
  const { data: profile, isLoading } = useUserProfile();

  const user = useMemo<CurrentUser | null>(
    () =>
      profile
        ? { id: profile.id, email: profile.email, name: profile.full_name || profile.email }
        : null,
    [profile],
  );

  return { user, loading: isLoading };
}

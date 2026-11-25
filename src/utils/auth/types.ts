/**
 * The signed-in user, as the authenticated shell needs it: what `/users/me`
 * serves, cut down to the four fields the layout, the sidebar and the profile
 * header read. The rest of the profile (plan, quotas, two-factor state) reaches
 * the pages that need it through `useUserProfile`.
 */
export interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

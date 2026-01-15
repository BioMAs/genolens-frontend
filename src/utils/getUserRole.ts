import { createClient } from './supabase/server';

/**
 * Get the user's role from Supabase profiles table (server-side only)
 */
export async function getUserRole(userId: string): Promise<string | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user role:', error);
      return null;
    }

    return data?.role || null;
  } catch (error) {
    console.error('Error in getUserRole:', error);
    return null;
  }
}

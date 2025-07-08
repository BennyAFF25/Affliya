export type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  expires: string; // <-- ✅ Add this line
  user: {
    email: string | null;
    name?: string | null;
    image?: string | null;
  };
};
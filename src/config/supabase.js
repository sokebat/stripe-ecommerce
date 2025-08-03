import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

const supabase = createClient(supabaseUrl, supabaseSecretKey);
 
// Function to create authenticated client with user token
export const createAuthenticatedClient = (accessToken) => {
  return createClient(supabaseUrl, supabaseSecretKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
};

export default supabase;
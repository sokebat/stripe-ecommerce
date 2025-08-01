import { createClient } from '@supabase/supabase-js';

/**
 * Initialize Supabase client with user token from request
 * @param {string} token - User authentication token from request headers
 * @returns {Object} Supabase client instance
 */
const initializeSupabase = (token = null) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables');
    }

    // Create client with optional auth token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: false, // Don't persist session for server-side usage
            detectSessionInUrl: false
        }
    });

    // If token is provided, set the auth session
    if (token) {
        supabase.auth.setSession({
            access_token: token,
            refresh_token: null
        });
    }

    return supabase;
};

/**
 * Extract token from request headers and initialize Supabase
 * @param {Object} req - Express request object
 * @returns {Object} Supabase client instance with user authentication
 */
const getSupabaseFromRequest = (req) => {
    // Extract token from various possible header locations
    const token = req.headers.authorization?.replace('Bearer ', '') ||
                 req.headers['x-access-token'] ||
                 req.headers['x-auth-token'] ||
                 req.headers.token;

    if (!token) {
        console.warn('No authentication token found in request headers');
    }

    return initializeSupabase(token);
};

export default initializeSupabase;
export { getSupabaseFromRequest }; 
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
    throw new Error('SUPABASE_URL must be a valid URL like https://<project>.supabase.co');
}
if (!supabaseKey) {
    throw new Error('SUPABASE_ANON_KEY is missing from environment configuration.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
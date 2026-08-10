// Copy to config.js only after creating the Supabase project.
// The anon/publishable key is safe to expose in the browser when RLS is enabled.
// NEVER put a Supabase service-role key in this file.
window.TSS_SUPABASE_CONFIG = {
  url: 'https://YOUR_PROJECT.supabase.co',
  anonKey: 'YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY'
};

-- =============================================================================
-- Removes the optional demo listings and demo accounts added by
-- supabase/demo/add-demo-listings.sql. Safe to run more than once.
-- Deleting the accounts deletes their profiles, listings and photos rows.
-- =============================================================================
delete from auth.users where email like '%@demo.campusnest.invalid';

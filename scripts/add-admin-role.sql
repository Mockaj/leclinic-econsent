-- First, let's check what columns exist in auth.users table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'auth' 
AND table_name = 'users';

-- Check if the user exists and what data is available
SELECT *
FROM auth.users 
WHERE email = 'lada.husty@gmail.com';

-- If user_metadata column exists, use this:
-- UPDATE auth.users 
-- SET user_metadata = jsonb_set(
--   COALESCE(user_metadata, '{}'),
--   '{role}',
--   '"admin"'
-- )
-- WHERE email = 'lada.husty@gmail.com';

-- If raw_user_meta_data column exists instead, use this:
-- UPDATE auth.users 
-- SET raw_user_meta_data = jsonb_set(
--   COALESCE(raw_user_meta_data, '{}'),
--   '{role}',
--   '"admin"'
-- )
-- WHERE email = 'lada.husty@gmail.com';

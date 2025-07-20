#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase configuration')
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
  process.exit(1)
}

// Create admin client with service role key
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function addAdminRole() {
  try {
    const targetEmail = 'lada.husty@gmail.com'
    
    console.log(`🔍 Looking for user: ${targetEmail}`)
    
    // First, try to find the user by email
    const { data: users, error: listError } = await supabase.auth.admin.listUsers()
    
    if (listError) {
      console.error('❌ Error listing users:', listError.message)
      return
    }
    
    const user = users.users.find(u => u.email === targetEmail)
    
    if (!user) {
      console.error(`❌ User ${targetEmail} not found`)
      console.log('Available users:')
      users.users.forEach(u => console.log(`  - ${u.email}`))
      return
    }
    
    console.log(`✅ Found user: ${user.email} (ID: ${user.id})`)
    
    // Update user metadata to add admin role
    const { data, error } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...user.user_metadata,
          role: 'admin'
        }
      }
    )
    
    if (error) {
      console.error('❌ Error updating user:', error.message)
      return
    }
    
    console.log(`🎉 Successfully added admin role to ${targetEmail}`)
    console.log('Updated user metadata:', JSON.stringify(data.user.user_metadata, null, 2))
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
  }
}

// Run the script
addAdminRole()

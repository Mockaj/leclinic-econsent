'use server'

import { createAdminClient } from '@/lib/supabase-admin'
import { User } from '@supabase/supabase-js'

export async function getUsers(): Promise<User[]> {
  const supabase = createAdminClient()

  const { data: { users }, error } = await supabase.auth.admin.listUsers()

  if (error) {
    console.error('Error fetching users:', error)
    return []
  }

  return users
}

export async function createUser(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const isAdmin = formData.get('isAdmin') === 'true'

  const supabase = createAdminClient()

  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // User will be asked to confirm their email
    user_metadata: {
      role: isAdmin ? 'admin' : 'staff',
    },
  })

  if (error) {
    return { success: false, message: error.message }
  }

  return { success: true, message: 'Uživatel byl úspěšně vytvořen.' }
}

export async function deleteUser(userId: string) {
  const supabase = createAdminClient()

  const { error } = await supabase.auth.admin.deleteUser(userId)

  if (error) {
    return { success: false, message: error.message }
  }

  return { success: true, message: 'Uživatel byl úspěšně smazán.' }
}

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      templates: {
        Row: {
          id: string
          name: string
          file_path: string
          page_count: number
          uploaded_at: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          id?: string
          name: string
          file_path: string
          page_count: number
          uploaded_at?: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          id?: string
          name?: string
          file_path?: string
          page_count?: number
          uploaded_at?: string
          updated_at?: string
          uploaded_by?: string
        }
      }
      completed_consents: {
        Row: {
          id: string
          template_id: string
          name: string
          file_path: string | null
          status: 'pending' | 'completed'
          created_at: string
          completed_at: string | null
          created_by: string
          auth_token: string
        }
        Insert: {
          id?: string
          template_id: string
          name: string
          file_path?: string | null
          status?: 'pending' | 'completed'
          created_at?: string
          completed_at?: string | null
          created_by: string
          auth_token: string
        }
        Update: {
          id?: string
          template_id?: string
          name?: string
          file_path?: string | null
          status?: 'pending' | 'completed'
          created_at?: string
          completed_at?: string | null
          created_by?: string
          auth_token?: string
        }
      }
    }
  }
}

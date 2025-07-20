'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'
import { LogOut, FileText, CheckSquare, Users } from 'lucide-react'
import Link from 'next/link'
import { User } from '@supabase/supabase-js'

interface DashboardLayoutProps {
  children: React.ReactNode
  activeTab?: 'templates' | 'completed' | 'users'
}

export function DashboardLayout({ children, activeTab }: DashboardLayoutProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      // Check if user is admin (you can implement your admin logic here)
      // For now, we'll check if the user's email contains 'admin' or has a specific role
      if (user?.email?.includes('admin') || user?.user_metadata?.role === 'admin') {
        setIsAdmin(true)
      }
    }
    
    getUser()
  }, [supabase.auth])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold text-sidebar-foreground">
            E-Consent Forms
          </h1>
          <p className="text-sm text-sidebar-foreground/70 mt-1">
            Systém elektronických souhlasů
          </p>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <div className="space-y-1">
            <Link href="/dashboard">
              <div className={`flex items-center px-3 py-2 rounded-md text-sm font-medium cursor-pointer ${
                activeTab === 'templates' || activeTab === 'completed' 
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground' 
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`}>
                <FileText className="mr-3 h-4 w-4" />
                Přehled
              </div>
            </Link>
            
            {isAdmin && (
              <Link href="/dashboard/users">
                <div className={`flex items-center px-3 py-2 rounded-md text-sm font-medium cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground' 
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}>
                  <Users className="mr-3 h-4 w-4" />
                  Správa uživatelů
                </div>
              </Link>
            )}
          </div>
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-sidebar-foreground">
              <div className="font-medium">{user?.email}</div>
              <div className="text-sidebar-foreground/70">
                {isAdmin ? 'Administrátor' : 'Zaměstnanec'}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Odhlásit se
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

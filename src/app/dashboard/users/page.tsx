'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Loader2, Users, Shield } from 'lucide-react'
import { User } from '@supabase/supabase-js'

interface UserWithMetadata extends User {
  role?: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserWithMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [deleteUser, setDeleteUser] = useState<UserWithMetadata | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  
  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  const checkAdminAccess = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    // Check if user is admin
    const isUserAdmin = user.email?.includes('admin') || user.user_metadata?.role === 'admin';
    if (!isUserAdmin) {
      router.push('/dashboard');
      return;
    }
  }, [router, supabase]);

  const fetchUsers = useCallback(async () => {
    try {
      // Note: In a real implementation, you'd need to use Supabase Admin API
      // or create a server-side API endpoint to list users
      // For now, we'll show a placeholder implementation
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Mock data for demonstration
        setUsers([
          {
            ...user,
            role: 'admin'
          }
        ]);
      }
    } catch (err) {
      setError('Chyba při načítání uživatelů');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    checkAdminAccess();
    fetchUsers();
  }, [checkAdminAccess, fetchUsers]);



  const handleCreateUser = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Vyplňte všechna povinná pole')
      return
    }

    if (password !== confirmPassword) {
      setError('Hesla se neshodují')
      return
    }

    if (password.length < 6) {
      setError('Heslo musí mít alespoň 6 znaků')
      return
    }

    setCreating(true)
    setError(null)

    try {
      // Note: In a real implementation, you'd need to use Supabase Admin API
      // or create a server-side API endpoint to create users
      // This is just a placeholder implementation
      
      const { data: _data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            role: isAdmin ? 'admin' : 'staff'
          }
        }
      })

      if (error) throw error

      // Reset form
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setIsAdmin(false)
      setShowCreateDialog(false)
      
      await fetchUsers()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Chyba při vytváření uživatele');
      }
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!deleteUser) return

    setDeleting(true)
    try {
      // Note: In a real implementation, you'd need to use Supabase Admin API
      // or create a server-side API endpoint to delete users
      // This is just a placeholder implementation
      
      setError('Mazání uživatelů není v demo verzi implementováno')
      setDeleteUser(null)
    } catch (err) {
      setError('Chyba při mazání uživatele')
      console.error(err)
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <DashboardLayout activeTab="users">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout activeTab="users">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Správa uživatelů</h1>
            <p className="text-muted-foreground">
              Vytvářejte a spravujte uživatelské účty pro zaměstnance
            </p>
          </div>
          
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Přidat uživatele
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {users.length === 0 ? (
          <div className="text-center py-8">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-semibold">Žádní uživatelé</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Začněte vytvořením prvního uživatelského účtu
            </p>
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Vytvořeno</TableHead>
                  <TableHead>Poslední přihlášení</TableHead>
                  <TableHead className="text-right">Akce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {user.role === 'admin' ? (
                          <>
                            <Shield className="h-4 w-4 text-blue-600" />
                            <span>Administrátor</span>
                          </>
                        ) : (
                          <>
                            <Users className="h-4 w-4 text-gray-600" />
                            <span>Zaměstnanec</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(user.created_at)}</TableCell>
                    <TableCell>
                      {user.last_sign_in_at ? formatDate(user.last_sign_in_at) : 'Nikdy'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteUser(user)}
                        disabled={user.role === 'admin'} // Prevent deleting admin users
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Create User Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Přidat nového uživatele</DialogTitle>
              <DialogDescription>
                Vytvořte nový účet pro zaměstnance
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="user-email">Email</Label>
                <Input
                  id="user-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="uzivatel@example.com"
                  disabled={creating}
                />
              </div>
              
              <div>
                <Label htmlFor="user-password">Heslo</Label>
                <Input
                  id="user-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={creating}
                />
              </div>
              
              <div>
                <Label htmlFor="confirm-password">Potvrdit heslo</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={creating}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is-admin"
                  checked={isAdmin}
                  onChange={(e) => setIsAdmin(e.target.checked)}
                  disabled={creating}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="is-admin">Administrátorské oprávnění</Label>
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowCreateDialog(false)}
                disabled={creating}
              >
                Zrušit
              </Button>
              <Button onClick={handleCreateUser} disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Vytvořit uživatele
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete User Dialog */}
        <Dialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Smazat uživatele</DialogTitle>
              <DialogDescription>
                Opravdu chcete smazat uživatele "{deleteUser?.email}"? Tato akce je nevratná.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setDeleteUser(null)}
                disabled={deleting}
              >
                Zrušit
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeleteUser}
                disabled={deleting}
              >
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Smazat
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}

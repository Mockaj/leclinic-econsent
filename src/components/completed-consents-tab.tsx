'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Edit, Trash2, Download, Loader2, FileText, ArrowUpDown } from 'lucide-react'
import { Database } from '@/lib/supabase'

type CompletedConsent = Database['public']['Tables']['completed_consents']['Row'] & {
  templates: {
    name: string
  } | null
}

type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc'

export function CompletedConsentsTab() {
  const [consents, setConsents] = useState<CompletedConsent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingConsent, setEditingConsent] = useState<CompletedConsent | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteConsent, setDeleteConsent] = useState<CompletedConsent | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('date-desc')
  const [downloading, setDownloading] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchConsents()
  }, [sortBy])

  const fetchConsents = async () => {
    try {
      let query = supabase
        .from('completed_consents')
        .select(`
          *,
          templates (
            name
          )
        `)

      // Apply sorting
      switch (sortBy) {
        case 'date-desc':
          query = query.order('completed_at', { ascending: false, nullsFirst: false })
          break
        case 'date-asc':
          query = query.order('completed_at', { ascending: true, nullsFirst: true })
          break
        case 'name-asc':
          query = query.order('name', { ascending: true })
          break
        case 'name-desc':
          query = query.order('name', { ascending: false })
          break
      }

      const { data, error } = await query

      if (error) throw error
      setConsents(data || [])
    } catch (err) {
      setError('Chyba při načítání souhlasů')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleEditConsent = async () => {
    if (!editingConsent || !editName.trim()) return

    try {
      const { error } = await supabase
        .from('completed_consents')
        .update({ name: editName.trim() })
        .eq('id', editingConsent.id)

      if (error) throw error

      await fetchConsents()
      setEditingConsent(null)
      setEditName('')
    } catch (err) {
      setError('Chyba při úpravě souhlasu')
      console.error(err)
    }
  }

  const handleDeleteConsent = async () => {
    if (!deleteConsent) return

    try {
      // Delete file from storage if it exists
      if (deleteConsent.file_path) {
        const { error: storageError } = await supabase.storage
          .from('completed-consents')
          .remove([deleteConsent.file_path])

        if (storageError) {
          console.warn('Warning: Could not delete file from storage:', storageError)
        }
      }

      // Delete consent record
      const { error: dbError } = await supabase
        .from('completed_consents')
        .delete()
        .eq('id', deleteConsent.id)

      if (dbError) throw dbError

      await fetchConsents()
      setDeleteConsent(null)
    } catch (err) {
      setError('Chyba při mazání souhlasu')
      console.error(err)
    }
  }

  const handleDownload = async (consent: CompletedConsent) => {
    if (!consent.file_path) {
      setError('Soubor není k dispozici pro stažení')
      return
    }

    setDownloading(consent.id)
    try {
      const { data, error } = await supabase.storage
        .from('completed-consents')
        .download(consent.file_path)

      if (error) throw error

      // Create download link
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${consent.name}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError('Chyba při stahování souboru')
      console.error(err)
    } finally {
      setDownloading(null)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nevyplněno'
    return new Date(dateString).toLocaleDateString('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string, completedAt: string | null) => {
    if (status === 'completed' && completedAt) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Dokončeno
        </span>
      )
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          Čeká na vyplnění
        </span>
      )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Vyplněné souhlasy</h2>
          <p className="text-muted-foreground">
            Přehled všech vyplněných a čekających souhlasů
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Nejnovější první</SelectItem>
              <SelectItem value="date-asc">Nejstarší první</SelectItem>
              <SelectItem value="name-asc">Podle názvu A-Z</SelectItem>
              <SelectItem value="name-desc">Podle názvu Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {consents.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-semibold">Žádné souhlasy</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Vyplněné souhlasy se zobrazí zde po jejich dokončení
          </p>
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Název</TableHead>
                <TableHead>Šablona</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead>Datum vytvoření</TableHead>
                <TableHead>Datum dokončení</TableHead>
                <TableHead className="text-right">Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consents.map((consent) => (
                <TableRow key={consent.id}>
                  <TableCell className="font-medium">{consent.name}</TableCell>
                  <TableCell>{consent.templates?.name || 'Neznámá šablona'}</TableCell>
                  <TableCell>{getStatusBadge(consent.status, consent.completed_at)}</TableCell>
                  <TableCell>{formatDate(consent.created_at)}</TableCell>
                  <TableCell>{formatDate(consent.completed_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {consent.status === 'completed' && consent.file_path && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(consent)}
                          disabled={downloading === consent.id}
                        >
                          {downloading === consent.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingConsent(consent)
                          setEditName(consent.name)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConsent(consent)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Consent Dialog */}
      <Dialog open={!!editingConsent} onOpenChange={() => setEditingConsent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upravit souhlas</DialogTitle>
            <DialogDescription>
              Změňte název souhlasu
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="consent-name">Název souhlasu</Label>
              <Input
                id="consent-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Zadejte název souhlasu"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingConsent(null)}>
              Zrušit
            </Button>
            <Button onClick={handleEditConsent}>
              Uložit změny
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Consent Dialog */}
      <Dialog open={!!deleteConsent} onOpenChange={() => setDeleteConsent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Smazat souhlas</DialogTitle>
            <DialogDescription>
              Opravdu chcete smazat souhlas "{deleteConsent?.name}"? Tato akce je nevratná.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConsent(null)}>
              Zrušit
            </Button>
            <Button variant="destructive" onClick={handleDeleteConsent}>
              Smazat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Edit, Trash2, Download, Loader2, FileText, ArrowUpDown, Package, PenTool } from 'lucide-react'
import { Database } from '@/lib/supabase'
import JSZip from 'jszip'
import { useRouter } from 'next/navigation'

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
  const [selectedConsents, setSelectedConsents] = useState<string[]>([])
  const [isDownloadingZip, setIsDownloadingZip] = useState(false)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const fetchConsents = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('completed_consents')
        .select(`
          *,
          templates (
            name
          )
        `);

      // Apply sorting
      switch (sortBy) {
        case 'date-desc':
          query = query.order('completed_at', { ascending: false, nullsFirst: false });
          break;
        case 'date-asc':
          query = query.order('completed_at', { ascending: true, nullsFirst: true });
          break;
        case 'name-asc':
          query = query.order('name', { ascending: true });
          break;
        case 'name-desc':
          query = query.order('name', { ascending: false });
          break;
      }

      const { data, error } = await query;

      if (error) throw error;
      setConsents(data || []);
    } catch (err: unknown) {
      setError('Chyba při načítání souhlasů');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [sortBy, supabase]);

  useEffect(() => {
    fetchConsents();
  }, [fetchConsents]);

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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
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
      // Determine file extension based on file path
      const fileExtension = consent.file_path?.endsWith('.png') ? '.png' : '.pdf'
      a.download = `${consent.name}${fileExtension}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedConsents(consents.map((c) => c.id))
    } else {
      setSelectedConsents([])
    }
  }

  const handleSelectOne = (consentId: string, checked: boolean) => {
    if (checked) {
      setSelectedConsents((prev) => [...prev, consentId])
    } else {
      setSelectedConsents((prev) => prev.filter((id) => id !== consentId))
    }
  }

  const handleDownloadSelected = async () => {
    if (selectedConsents.length === 0) return

    setIsDownloadingZip(true)
    setError(null)
    try {
      const zip = new JSZip()
      const consentsToDownload = consents.filter((c) => selectedConsents.includes(c.id))

      for (const consent of consentsToDownload) {
        if (consent.file_path) {
          const { data, error } = await supabase.storage
            .from('completed-consents')
            .download(consent.file_path)

          if (error) {
            throw new Error(`Chyba při stahování souboru pro ${consent.name}: ${error.message}`)
          }

          if (data) {
            const fileExtension = consent.file_path.endsWith('.png') ? '.png' : '.pdf'
            zip.file(`${consent.name}${fileExtension}`, data)
          }
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'souhlasy.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při vytváření ZIP archivu')
      console.error(err)
    } finally {
      setIsDownloadingZip(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedConsents.length === 0) return

    setIsBulkDeleting(true)
    try {
      // Delete files from storage first
      for (const consentId of selectedConsents) {
        const consent = consents.find(c => c.id === consentId)
        if (consent?.file_path) {
          try {
            await supabase.storage
              .from('completed-consents')
              .remove([consent.file_path])
          } catch (storageError) {
            console.warn(`Failed to delete file for consent ${consent.id}:`, storageError)
            // Continue with database deletion even if file deletion fails
          }
        }
      }

      // Delete records from database
      const { error: deleteError } = await supabase
        .from('completed_consents')
        .delete()
        .in('id', selectedConsents)

      if (deleteError) throw deleteError

      // Update local state
      setConsents(prevConsents => 
        prevConsents.filter(consent => !selectedConsents.includes(consent.id))
      )
      setSelectedConsents([])
      setBulkDeleteDialogOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při mazání souhlasů')
      console.error(err)
    } finally {
      setIsBulkDeleting(false)
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
        <div className="flex items-center space-x-4">
          <div>
            <Label htmlFor="sort-by">Seřadit podle</Label>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger id="sort-by" className="w-[180px]">
                <SelectValue placeholder="Seřadit podle..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Datum (nejnovější)</SelectItem>
                <SelectItem value="date-asc">Datum (nejstarší)</SelectItem>
                <SelectItem value="name-asc">Jméno (A-Z)</SelectItem>
                <SelectItem value="name-desc">Jméno (Z-A)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleDownloadSelected}
              disabled={selectedConsents.length === 0 || isDownloadingZip}
            >
              {isDownloadingZip ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Package className="mr-2 h-4 w-4" />
              )}
              Stáhnout vybrané ({selectedConsents.length})
            </Button>
            <Button
              variant="destructive"
              onClick={() => setBulkDeleteDialogOpen(true)}
              disabled={selectedConsents.length === 0 || isBulkDeleting}
            >
              {isBulkDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Smazat vybrané ({selectedConsents.length})
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedConsents.length === consents.length && consents.length > 0}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Jméno</TableHead>
              <TableHead>Šablona</TableHead>
              <TableHead>Stav</TableHead>
              <TableHead>Datum dokončení</TableHead>
              <TableHead>Akce</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {consents.length > 0 ? (
              consents.map((consent) => (
                <TableRow key={consent.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedConsents.includes(consent.id)}
                      onCheckedChange={(checked) => handleSelectOne(consent.id, !!checked)}
                      aria-label={`Select consent ${consent.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{consent.name}</TableCell>
                  <TableCell>{consent.templates?.name || 'N/A'}</TableCell>
                  <TableCell>{getStatusBadge(consent.status, consent.completed_at)}</TableCell>
                  <TableCell>{formatDate(consent.completed_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(consent)}
                        disabled={!consent.file_path || downloading === consent.id}
                      >
                        {downloading === consent.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-2 h-4 w-4" />
                        )}
                        Stáhnout
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingConsent(consent)
                          setEditName(consent.name)
                        }}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Přejmenovat
                      </Button>
                      {(consent.status === 'completed' || consent.status === 'pending') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/consent-edit/${consent.id}`)}
                        >
                          <PenTool className="mr-2 h-4 w-4" />
                          Upravit PDF
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteConsent(consent)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Smazat
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  Žádné dokončené souhlasy.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingConsent} onOpenChange={() => setEditingConsent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upravit jméno souhlasu</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Jméno
              </Label>
              <Input
                id="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingConsent(null)}>Zrušit</Button>
            <Button onClick={handleEditConsent}>Uložit změny</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConsent} onOpenChange={() => setDeleteConsent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Opravdu smazat souhlas?</DialogTitle>
            <DialogDescription>
              Tato akce je nevratná. Souhlas bude trvale smazán.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConsent(null)}>Zrušit</Button>
            <Button variant="destructive" onClick={handleDeleteConsent}>Smazat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Opravdu smazat vybrané souhlasy?</DialogTitle>
            <DialogDescription>
              Chystáte se smazat {selectedConsents.length} souhlasů. Tato akce je nevratná a všechny vybrané souhlasy budou trvale smazány.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setBulkDeleteDialogOpen(false)}
              disabled={isBulkDeleting}
            >
              Zrušit
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
            >
              {isBulkDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Smazat všechny ({selectedConsents.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Plus, QrCode, Edit, Trash2, Upload, Loader2 } from 'lucide-react'
import { QRCodeModal } from '@/components/qr-code-modal'
import { Database } from '@/lib/supabase'

type Template = Database['public']['Tables']['templates']['Row']

export function TemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [editName, setEditName] = useState('')
  const [qrTemplate, setQrTemplate] = useState<Template | null>(null)
  const [deleteTemplate, setDeleteTemplate] = useState<Template | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('uploaded_at', { ascending: false })

      if (error) throw error
      setTemplates(data || [])
    } catch (err: unknown) {
      console.error('Fetch Templates Error:', err);
      if (err instanceof Error) {
        setError(`Chyba při načítání šablon: ${err.message}`);
      } else {
        setError('Chyba při načítání šablon: Vyskytla se neznámá chyba.');
      }
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Uživatel není přihlášen')

      for (const file of Array.from(files)) {
        if (file.type !== 'application/pdf') {
          setError('Lze nahrát pouze PDF soubory')
          continue
        }

        // Upload PDF to storage
        const fileExt = 'pdf'
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `templates/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('consent-templates')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        // Convert PDF to image (client-side only)
        let imagePath: string | null = null
        if (typeof window !== 'undefined') {
          try {
            // Dynamic import of pdfjs-dist to avoid SSR issues
            const pdfjsLib = await import('pdfjs-dist')
            
            // Setup worker
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
            
            const arrayBuffer = await file.arrayBuffer()
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise
            const page = await pdf.getPage(1)
            
            // Get desired width and height
            const viewport = page.getViewport({ scale: 2.0 })
            
            // Create canvas
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')!
            canvas.width = viewport.width
            canvas.height = viewport.height
            
            // Render PDF page to canvas
            await page.render({ canvasContext: ctx, viewport }).promise
            
            // Convert to PNG blob
            const pngBlob = await new Promise<Blob>((resolve, reject) => {
              canvas.toBlob((blob) => {
                if (blob) resolve(blob)
                else reject(new Error('Failed to create PNG blob'))
              }, 'image/png')
            })
            
            // Upload PNG to storage
            const imageFileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.png`
            imagePath = `images/${imageFileName}`
            
            const { error: imageUploadError } = await supabase.storage
              .from('consent-templates')
              .upload(imagePath, pngBlob, { contentType: 'image/png' })
              
            if (imageUploadError) {
              console.warn('Failed to upload image:', imageUploadError)
              imagePath = null
            }
          } catch (err) {
            console.warn('Failed to convert PDF to image:', err)
            imagePath = null
          }
        }

        // Get page count
        const pageCount = 1

        // Create template record
        const { error: insertError } = await supabase
          .from('templates')
          .insert({
            name: file.name.replace('.pdf', ''),
            file_path: filePath,
            image_path: imagePath,
            page_count: pageCount,
            uploaded_by: user.id
          })

        if (insertError) throw insertError
      }

      await fetchTemplates()
    } catch (err: unknown) {
      console.error('File Upload Error:', err);
      console.error('Error details:', JSON.stringify(err, null, 2));
      if (err instanceof Error) {
        console.error('Error message:', err.message);
        console.error('Error stack:', err.stack);
        setError(`Chyba při nahrávání souboru: ${err.message}`);
      } else {
        console.error('Non-Error thrown:', typeof err, err);
        setError(`Chyba při nahrávání souboru: ${JSON.stringify(err)}`);
      }
    } finally {
      setUploading(false)
      // Reset file input
      event.target.value = ''
    }
  }

  const handleEditTemplate = async () => {
    if (!editingTemplate || !editName.trim()) return

    try {
      const { error } = await supabase
        .from('templates')
        .update({ name: editName.trim() })
        .eq('id', editingTemplate.id)

      if (error) throw error

      await fetchTemplates()
      setEditingTemplate(null)
      setEditName('')
    } catch (err: unknown) {
      console.error('Edit Template Error:', err);
      if (err instanceof Error) {
        setError(`Chyba při úpravě šablony: ${err.message}`);
      } else {
        setError('Chyba při úpravě šablony: Vyskytla se neznámá chyba.');
      }
    }
  }

  const handleDeleteTemplate = async () => {
    if (!deleteTemplate) return

    try {
      // Delete files from storage (both PDF and PNG)
      const filesToDelete = [deleteTemplate.file_path]
      if (deleteTemplate.image_path) {
        filesToDelete.push(deleteTemplate.image_path)
      }
      
      const { error: storageError } = await supabase.storage
        .from('consent-templates')
        .remove(filesToDelete)

      if (storageError) {
        console.warn('Storage deletion error:', storageError)
        // Don't throw here, continue with database deletion
      }

      // Delete template record
      const { error: dbError } = await supabase
        .from('templates')
        .delete()
        .eq('id', deleteTemplate.id)

      if (dbError) throw dbError

      await fetchTemplates()
      setDeleteTemplate(null)
    } catch (err: unknown) {
      console.error('Delete Template Error:', err);
      if (err instanceof Error) {
        setError(`Chyba při mazání šablony: ${err.message}`);
      } else {
        setError('Chyba při mazání šablony: Vyskytla se neznámá chyba.');
      }
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
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Šablony souhlasů</h2>
          <p className="text-muted-foreground">
            Správa PDF šablon pro elektronické souhlasy
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".pdf"
            multiple
            onChange={handleFileUpload}
            className="hidden"
            id="file-upload"
            disabled={uploading}
          />
          <Button asChild disabled={uploading}>
            <label htmlFor="file-upload" className="cursor-pointer">
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Přidat šablonu
            </label>
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {templates.length === 0 ? (
        <div className="text-center py-8">
          <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-semibold">Žádné šablony</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Začněte nahráním PDF šablony souhlasu
          </p>
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Název šablony</TableHead>
                <TableHead>Počet stran</TableHead>
                <TableHead>Datum přidání</TableHead>
                <TableHead>Naposledy upraveno</TableHead>
                <TableHead className="text-left">Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>{template.page_count}</TableCell>
                  <TableCell>{formatDate(template.uploaded_at)}</TableCell>
                  <TableCell>{formatDate(template.updated_at)}</TableCell>
                  <TableCell className="text-left">
                    <div className="flex justify-start gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setQrTemplate(template)}
                      >
                        <QrCode className="h-4 w-4" />
                        QR
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingTemplate(template)
                          setEditName(template.name)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                        Přejmenovat
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteTemplate(template)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Smazat
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Template Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upravit šablonu</DialogTitle>
            <DialogDescription>
              Změňte název šablony souhlasu
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="template-name">Název šablony</Label>
              <Input
                id="template-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Zadejte název šablony"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>
              Zrušit
            </Button>
            <Button onClick={handleEditTemplate}>
              Uložit změny
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Template Dialog */}
      <Dialog open={!!deleteTemplate} onOpenChange={() => setDeleteTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Smazat šablonu</DialogTitle>
            <DialogDescription>
              Opravdu chcete smazat šablonu "{deleteTemplate?.name}"? Tato akce je nevratná.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTemplate(null)}>
              Zrušit
            </Button>
            <Button variant="destructive" onClick={handleDeleteTemplate}>
              Smazat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Modal */}
      {qrTemplate && (
        <QRCodeModal
          template={qrTemplate}
          onClose={() => setQrTemplate(null)}
          onSuccess={fetchTemplates}
        />
      )}
    </div>
  )
}

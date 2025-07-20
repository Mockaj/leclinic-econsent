'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { PDFAnnotator } from '@/components/pdf-annotator'
import { Database } from '@/lib/supabase'

type ConsentRecord = Database['public']['Tables']['completed_consents']['Row'] & {
  templates: {
    name: string
    file_path: string
  } | null
}

export default function ConsentFillPage() {
  const params = useParams()
  const token = params.token as string
  
  const [consent, setConsent] = useState<ConsentRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (token) {
      loadConsent()
    }
  }, [token])

  const loadConsent = async () => {
    try {
      // Find consent record by token
      const { data: consentData, error: consentError } = await supabase
        .from('completed_consents')
        .select(`
          *,
          templates (
            name,
            file_path
          )
        `)
        .eq('auth_token', token)
        .single()

      if (consentError) {
        if (consentError.code === 'PGRST116') {
          setError('Odkaz není platný nebo již byl použit.')
        } else {
          throw consentError
        }
        return
      }

      if (!consentData) {
        setError('Formulář nebyl nalezen.')
        return
      }

      if (consentData.status === 'completed') {
        setError('Tento formulář již byl vyplněn.')
        return
      }

      if (!consentData.templates) {
        setError('Šablona formuláře nebyla nalezena.')
        return
      }

      setConsent(consentData as ConsentRecord)

      // Get signed URL for PDF template
      const { data: urlData, error: urlError } = await supabase.storage
        .from('consent-templates')
        .createSignedUrl(consentData.templates.file_path, 3600) // 1 hour expiry

      if (urlError) throw urlError

      setPdfUrl(urlData.signedUrl)
    } catch (err) {
      setError('Chyba při načítání formuláře.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveForm = async (annotatedPdfBlob: Blob) => {
    if (!consent) return

    setSaving(true)
    try {
      // Upload the annotated PDF to storage
      const fileName = `${consent.id}-${Date.now()}.pdf`
      const filePath = `completed/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('completed-consents')
        .upload(filePath, annotatedPdfBlob, {
          contentType: 'application/pdf'
        })

      if (uploadError) throw uploadError

      // Update consent record
      const { error: updateError } = await supabase
        .from('completed_consents')
        .update({
          status: 'completed',
          file_path: filePath,
          completed_at: new Date().toISOString()
        })
        .eq('id', consent.id)

      if (updateError) throw updateError

      setCompleted(true)
    } catch (err) {
      setError('Chyba při ukládání formuláře. Zkuste to prosím znovu.')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin mb-4" />
          <p className="text-muted-foreground">Načítání formuláře...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center">
          <XCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-2">Chyba</h1>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-600 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Formulář byl uložen</h1>
          <p className="text-muted-foreground mb-6">
            Děkujeme, formulář "{consent?.name}" byl úspěšně vyplněn a uložen.
          </p>
          <Button onClick={() => window.location.href = '/form-complete'}>
            Hotovo
          </Button>
        </div>
      </div>
    )
  }

  if (!pdfUrl || !consent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">Formulář není k dispozici.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">{consent.name}</h1>
              <p className="text-sm text-muted-foreground">
                Šablona: {consent.templates?.name}
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              Vyplňte formulář a podepište se pomocí pera nebo prstu
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-4">
        <PDFAnnotator
          pdfUrl={pdfUrl}
          onSave={handleSaveForm}
          saving={saving}
        />
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react'
import { PDFAnnotator } from '@/components/pdf-annotator'
import { Database } from '@/lib/supabase'

type ConsentRecord = Database['public']['Tables']['completed_consents']['Row'] & {
  templates: {
    name: string
    file_path: string
  } | null
}

export default function ConsentEditPage() {
  const params = useParams()
  const router = useRouter()
  const consentId = params.id as string
  
  const [consent, setConsent] = useState<ConsentRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const supabase = createClient()

  const loadConsent = useCallback(async () => {
    setLoading(true)
    try {
      const { data: consentData, error: consentError } = await supabase
        .from('completed_consents')
        .select(`
          *,
          templates (
            name,
            file_path
          )
        `)
        .eq('id', consentId)
        .single()

      if (consentError) {
        throw new Error('Formulář nebyl nalezen.')
      }

      if (!consentData) {
        throw new Error('Formulář nebyl nalezen.')
      }

      setConsent(consentData as ConsentRecord)

      // Get the original template PDF URL
      if (consentData.templates?.file_path) {
        const { data: urlData } = supabase.storage
          .from('templates')
          .getPublicUrl(consentData.templates.file_path)
        
        setPdfUrl(urlData.publicUrl)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [supabase, consentId])

  useEffect(() => {
    if (consentId) {
      loadConsent()
    }
  }, [consentId, loadConsent])

  const handleSaveForm = async (annotatedPdfBlob: Blob) => {
    if (!consent) return

    setSaving(true)
    try {
      // Upload the updated annotated form
      const fileName = `${consent.id}-${Date.now()}.png`
      const filePath = `completed/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('completed-consents')
        .upload(filePath, annotatedPdfBlob, {
          contentType: 'image/png'
        })

      if (uploadError) throw uploadError

      // Update the consent record with the new file path and status
      const updateData: any = {
        file_path: filePath,
        updated_at: new Date().toISOString()
      }
      
      // If this was a pending consent, mark it as completed
      if (consent.status === 'pending') {
        updateData.status = 'completed'
        updateData.completed_at = new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from('completed_consents')
        .update(updateData)
        .eq('id', consent.id)

      if (updateError) throw updateError

      setSaveSuccess(true)
      setTimeout(() => {
        router.push('/dashboard?tab=completed')
      }, 2000)
    } catch (err: any) {
      setError(`Chyba při ukládání: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Načítání formuláře...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button 
            className="mt-4 w-full" 
            onClick={() => router.push('/dashboard?tab=completed')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zpět na dashboard
          </Button>
        </div>
      </div>
    )
  }

  if (saveSuccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Formulář byl úspěšně uložen!</h2>
          <p className="text-muted-foreground mb-4">
            Přesměrování zpět na dashboard...
          </p>
        </div>
      </div>
    )
  }

  if (!consent || !pdfUrl) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertDescription>Formulář nebo PDF soubor nebyl nalezen.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button 
          variant="outline" 
          onClick={() => router.push('/dashboard?tab=completed')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zpět
        </Button>
        <h1 className="text-2xl font-bold mb-2">
          {consent.status === 'pending' ? 'Vyplnění formuláře' : 'Úprava formuláře'}: {consent.name}
        </h1>
        <p className="text-muted-foreground">
          Šablona: {consent.templates?.name || 'N/A'}
        </p>
        {consent.status === 'pending' && (
          <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded mt-2">
            Tento formulář ještě nebyl dokončen. Po uložení bude označen jako dokončený.
          </div>
        )}
      </div>

      <PDFAnnotator
        pdfUrl={pdfUrl}
        onSave={handleSaveForm}
        saving={saving}
      />
    </div>
  )
}

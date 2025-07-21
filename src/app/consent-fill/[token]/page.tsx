'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { ImageAnnotator } from '@/components/image-annotator'
import { Database } from '@/lib/supabase'

type ConsentRecord = Database['public']['Tables']['completed_consents']['Row'] & {
  templates: {
    name: string
    file_path: string
    image_path: string | null
  } | null
}

export default function ConsentFillPage() {
  const params = useParams()
  const token = params.token as string
  
  const [consent, setConsent] = useState<ConsentRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState(false)
  const supabase = createClient()

  const loadConsent = useCallback(async () => {
    setLoading(true);
    try {
      // Find consent record by token
      const { data: consentData, error: consentError } = await supabase
        .from('completed_consents')
        .select(`
          *,
          templates (
            name,
            file_path,
            image_path
          )
        `)
        .eq('auth_token', token)
        .single();

      if (consentError) {
        if (consentError.code === 'PGRST116') {
          throw new Error('Odkaz není platný nebo již byl použit.');
        } else {
          throw consentError;
        }
      }

      if (!consentData) {
        throw new Error('Formulář nebyl nalezen.');
      }

      // Check if consent is already completed
      if (consentData.status === 'completed') {
        setCompleted(true);
        return;
      }

      setConsent(consentData as ConsentRecord);

      // Get public URL for the template image
      console.log('ConsentFillPage: Template data:', consentData.templates)
      if (consentData.templates?.image_path) {
        console.log('ConsentFillPage: Found image_path:', consentData.templates.image_path)
        const { data: urlData } = supabase.storage
          .from('consent-templates')
          .getPublicUrl(consentData.templates.image_path);
        
        console.log('ConsentFillPage: Got public URL:', urlData.publicUrl)
        setImageUrl(urlData.publicUrl);
      } else {
        console.log('ConsentFillPage: No image_path found, falling back to file_path if available')
        if (consentData.templates?.file_path) {
          console.log('ConsentFillPage: Using file_path as fallback:', consentData.templates.file_path)
          const { data: urlData } = supabase.storage
            .from('consent-templates')
            .getPublicUrl(consentData.templates.file_path);
          setImageUrl(urlData.publicUrl);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase, token]);

  useEffect(() => {
    if (token) {
      loadConsent();
    }
  }, [token, loadConsent]);

  const handleSaveForm = async (annotatedPdfBlob: Blob) => {
    if (!consent) return

    setSaving(true)
    try {
      // Upload the annotated form to storage (as PNG image)
      const fileName = `${consent.id}-${Date.now()}.png`
      const filePath = `completed/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('completed-consents')
        .upload(filePath, annotatedPdfBlob, {
          contentType: 'image/png'
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

  if (!imageUrl || !consent) {
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
        <ImageAnnotator
          imageUrl={imageUrl}
          onSave={handleSaveForm}
          saving={saving}
        />
      </div>
    </div>
  )
}

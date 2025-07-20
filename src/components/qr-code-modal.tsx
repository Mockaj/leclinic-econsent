'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { Database } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import { useEffect, useRef } from 'react'
import { QRCodeCanvas } from '@/components/qr-code-canvas'

type Template = Database['public']['Tables']['templates']['Row']

interface QRCodeModalProps {
  template: Template
  onClose: () => void
  onSuccess: () => void
}

export function QRCodeModal({ template, onClose, onSuccess }: QRCodeModalProps) {
  const [step, setStep] = useState<'name' | 'qr'>('name')
  const [consentName, setConsentName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qrUrl, setQrUrl] = useState('')
  const supabase = createClient()

  const generateQRCode = async () => {
    if (!consentName.trim()) {
      setError('Zadejte název souhlasu')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Uživatel není přihlášen')

      // Generate unique token
      const authToken = uuidv4()

      // Create pending consent record
      const { data, error } = await supabase
        .from('completed_consents')
        .insert({
          template_id: template.id,
          name: consentName.trim(),
          status: 'pending',
          created_by: user.id,
          auth_token: authToken
        })
        .select()
        .single()

      if (error) throw error

      // Generate URL for form filling
      const baseUrl = window.location.origin
      const fillUrl = `${baseUrl}/consent-fill/${authToken}`
      setQrUrl(fillUrl)
      setStep('qr')
      onSuccess()
    } catch (err: unknown) {
      console.error('QR Code Generation Error:', err);
      if (err instanceof Error) {
        setError(`Chyba při vytváření QR kódu: ${err.message}`);
      } else {
        setError('Chyba při vytváření QR kódu: Vyskytla se neznámá chyba.');
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setStep('name')
    setConsentName('')
    setQrUrl('')
    setError(null)
    onClose()
  }

  return (
    <Dialog open={true} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {step === 'name' ? (
          <>
            <DialogHeader>
              <DialogTitle>Vytvořit QR kód</DialogTitle>
              <DialogDescription>
                Zadejte název pro nový souhlas na základě šablony "{template.name}"
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="consent-name">Název souhlasu</Label>
                <Input
                  id="consent-name"
                  value={consentName}
                  onChange={(e) => setConsentName(e.target.value)}
                  placeholder="např. Souhlas - Jan Novák"
                  disabled={loading}
                />
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Zrušit
              </Button>
              <Button onClick={generateQRCode} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Vytvořit QR kód
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>QR kód pro vyplnění</DialogTitle>
              <DialogDescription>
                Naskenujte tento QR kód tabletem pro vyplnění formuláře
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                  <QRCodeCanvas url={qrUrl} />
                </div>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Nebo použijte odkaz přímo:
                </p>
                <div className="bg-muted p-2 rounded text-xs font-mono break-all">
                  {qrUrl}
                </div>
              </div>
              
              <Alert>
                <AlertDescription>
                  Naskenujte QR kód tabletem s perem pro vyplnění a podepsání formuláře. 
                  Po dokončení se formulář automaticky uloží.
                </AlertDescription>
              </Alert>
            </div>
            
            <DialogFooter>
              <Button onClick={handleClose}>
                Hotovo
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

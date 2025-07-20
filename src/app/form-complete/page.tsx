'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Camera, CheckCircle, QrCode, Scan } from 'lucide-react'

export default function FormCompletePage() {
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)

  const startCamera = async () => {
    try {
      setCameraError(null)
      setIsScanning(true)

      // Detect device type
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      
      if (isMobile) {
        // On mobile devices, try multiple approaches
        try {
          // First, try to open native camera/QR scanner
          if (navigator.userAgent.includes('Android')) {
            // Try to open Android QR scanner intent
            window.location.href = 'intent://scan/#Intent;scheme=zxing;package=com.google.zxing.client.android;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.google.zxing.client.android;end'
          } else if (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) {
            // For iOS, try to open camera or suggest QR scanner
            alert('Otevřete aplikaci Fotoaparát ve vašem iPhone/iPad a naskenujte QR kód, nebo si stáhněte QR čtečku z App Store.')
          } else {
            // Generic mobile fallback
            alert('Otevřete aplikaci fotoaparátu ve vašem telefonu a naskenujte QR kód.')
          }
        } catch (_mobileErr) {
          throw new Error('Nepodařilo se otevřít aplikaci kamery')
        }
      } else {
        // Desktop/tablet - try to access camera
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Kamera není k dispozici v tomto prohlížeči')
        }

        // Request camera permission
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        })

        // Stop the stream and show instructions
        stream.getTracks().forEach(track => track.stop())
        
        // Show desktop instructions
        alert('Kamera je dostupná. Použijte QR čtečku nebo aplikaci kamery k naskenovanie QR kódu.')
      }
      
    } catch (err: unknown) {
      console.error('Camera error:', err);
      let errorMessage = 'Chyba při aktivaci kamery.';

      if (err instanceof Error) {
        errorMessage = `Chyba při aktivaci kamery: ${err.message}`;
        if (err.name === 'NotAllowedError') {
          errorMessage = 'Přístup ke kameře byl odepřen. Povolte přístup v nastavení prohlížeče.';
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'Kamera nebyla nalezena. Zkontrolujte, zda je kamera připojena.';
        }
      }
      
      setCameraError(errorMessage);
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Success Message */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-green-800 text-2xl font-bold">
              Formulář byl úspěšně uložen!
            </CardTitle>
            <CardDescription className="text-green-700">
              Váš souhlas byl dokončen a odeslán.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Instructions for Next Steps */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <QrCode className="w-5 h-5" />
              Další formuláře
            </CardTitle>
            <CardDescription>
              Pokud potřebujete vyplnit další formuláře, postupujte podle následujících kroků:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                  1
                </div>
                <p className="text-sm text-gray-600">
                  Požádejte personál o vytvoření nového QR kódu pro další formulář
                </p>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                  2
                </div>
                <p className="text-sm text-gray-600">
                  Naskenujte QR kód pomocí kamery svého zařízení
                </p>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                  3
                </div>
                <p className="text-sm text-gray-600">
                  Vyplňte a podepište nový formulář
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Camera Activation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Camera className="w-5 h-5" />
              Skenování QR kódu
            </CardTitle>
            <CardDescription>
              Aktivujte kameru pro skenování dalšího QR kódu
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={startCamera} 
              disabled={isScanning}
              size="lg" 
              className="w-full"
            >
              {isScanning ? (
                <>
                  <Scan className="w-4 h-4 mr-2 animate-pulse" />
                  Aktivuji kameru...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  Aktivovat kameru
                </>
              )}
            </Button>
            
            {cameraError && (
              <Alert className="mt-4 border-yellow-200 bg-yellow-50">
                <AlertDescription className="text-yellow-800">
                  {cameraError}
                  <br />
                  <span className="text-sm">
                    Použijte aplikaci kamery ve vašem telefonu a nasměrujte ji na QR kód.
                  </span>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Additional Help */}
        <div className="text-center text-sm text-gray-500">
          <p>
            Pokud máte problémy s kamerou, požádejte personál o pomoc
            nebo použijte aplikaci QR čtečky ve svém telefonu.
          </p>
        </div>
      </div>
    </div>
  )
}

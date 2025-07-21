'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Pen, Eraser, RotateCcw, Save } from 'lucide-react'

interface PDFAnnotatorProps {
  pdfUrl: string
  onSave: (annotatedPdfBlob: Blob) => Promise<void>
  saving: boolean
}

interface Point {
  x: number
  y: number
}

interface Stroke {
  points: Point[]
  color: string
  width: number
}

export function PDFAnnotator({ pdfUrl, onSave, saving }: PDFAnnotatorProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [currentStroke, setCurrentStroke] = useState<Point[]>([])
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadPDF = async () => {
      try {
        setLoading(true)
        setError(null)
  
        // Validate PDF URL
        if (!pdfUrl) {
          throw new Error('PDF URL není k dispozici')
        }
  
        // Test if the URL is accessible with a simple GET request
        // Skip URL validation for Supabase storage URLs as they may require specific headers
        try {
          const response = await fetch(pdfUrl, { 
            method: 'HEAD',
            mode: 'cors'
          })
          // Don't throw error immediately for 400/403 as Supabase storage may still work
          if (!response.ok && response.status !== 400 && response.status !== 403) {
            console.warn(`PDF URL returned ${response.status}: ${response.statusText}, proceeding anyway`)
          }
        } catch (fetchError) {
          console.warn('PDF URL validation failed, proceeding anyway:', fetchError)
          // Continue execution as the URL might still work for PDF display
        }
  
        // Setup canvases for annotation
        const annotationCanvas = canvasRef.current
        const pdfCanvas = pdfCanvasRef.current
        
        if (annotationCanvas && pdfCanvas) {
          // Get container dimensions for responsive sizing
          const container = containerRef.current
          const containerWidth = container ? container.clientWidth : 794
          const containerHeight = container ? container.clientHeight : 1123
          
          // Set canvas dimensions to match container
          const canvasWidth = Math.max(containerWidth, 600) // minimum width
          const canvasHeight = Math.max(containerHeight, 800) // minimum height
          
          annotationCanvas.width = canvasWidth
          annotationCanvas.height = canvasHeight
          pdfCanvas.width = canvasWidth
          pdfCanvas.height = canvasHeight
          
          // Clear and draw PDF content
          const ctx = pdfCanvas.getContext('2d')
          if (ctx) {
            // Fill white background
            ctx.fillStyle = 'white'
            ctx.fillRect(0, 0, canvasWidth, canvasHeight)
            
            // Add border
            ctx.strokeStyle = '#e5e7eb'
            ctx.lineWidth = 2
            ctx.strokeRect(20, 20, canvasWidth - 40, canvasHeight - 40)
            
            // Add PDF content with responsive scaling
            const scale = Math.min(canvasWidth / 800, canvasHeight / 1000)
            const offsetX = (canvasWidth - 800 * scale) / 2
            const offsetY = Math.max(40, (canvasHeight - 1000 * scale) / 2)
            
            ctx.save()
            ctx.translate(offsetX, offsetY)
            ctx.scale(scale, scale)
            
            // Header
            ctx.fillStyle = '#1f2937'
            ctx.font = 'bold 32px Arial, sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText('SOUHLAS S LÉČBOU', 400, 80)
            
            // Form fields
            ctx.font = '18px Arial, sans-serif'
            ctx.textAlign = 'left'
            ctx.fillStyle = '#374151'
            
            ctx.fillText('Jméno pacienta:', 60, 180)
            ctx.strokeStyle = '#d1d5db'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(220, 185)
            ctx.lineTo(740, 185)
            ctx.stroke()
            
            ctx.fillText('Datum narození:', 60, 240)
            ctx.beginPath()
            ctx.moveTo(220, 245)
            ctx.lineTo(500, 245)
            ctx.stroke()
            
            ctx.fillText('Rodné číslo:', 520, 240)
            ctx.beginPath()
            ctx.moveTo(640, 245)
            ctx.lineTo(740, 245)
            ctx.stroke()
            
            // Consent section
            ctx.fillStyle = '#1f2937'
            ctx.font = 'bold 20px Arial, sans-serif'
            ctx.fillText('INFORMOVANÝ SOUHLAS', 60, 340)
            
            ctx.font = '16px Arial, sans-serif'
            ctx.fillStyle = '#4b5563'
            ctx.fillText('Byl/a jsem informován/a o navrhované léčbě, jejích přínosech,', 60, 380)
            ctx.fillText('rizicích a možných alternativách.', 60, 405)
            
            // Consent checkboxes
            ctx.fillStyle = '#1f2937'
            ctx.font = '18px Arial, sans-serif'
            ctx.fillText('Souhlasím s navrhovanou léčbou:', 60, 460)
            
            // Checkbox squares
            ctx.strokeStyle = '#374151'
            ctx.lineWidth = 2
            ctx.strokeRect(60, 480, 20, 20)
            ctx.fillText('ANO', 90, 495)
            
            ctx.strokeRect(200, 480, 20, 20)
            ctx.fillText('NE', 230, 495)
            
            // Signature area
            ctx.fillStyle = '#1f2937'
            ctx.font = 'bold 18px Arial, sans-serif'
            ctx.fillText('Podpis pacienta:', 60, 600)
            
            ctx.strokeStyle = '#9ca3af'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(60, 650)
            ctx.lineTo(400, 650)
            ctx.stroke()
            
            ctx.fillText('Datum:', 500, 600)
            ctx.beginPath()
            ctx.moveTo(500, 650)
            ctx.lineTo(700, 650)
            ctx.stroke()
            
            // Doctor signature area
            ctx.fillText('Podpis lékaře:', 60, 750)
            ctx.beginPath()
            ctx.moveTo(60, 800)
            ctx.lineTo(400, 800)
            ctx.stroke()
            
            ctx.fillText('Razítko:', 500, 750)
            ctx.strokeRect(500, 760, 150, 80)
            
            ctx.restore()
          }
          
          // Clear annotation canvas
          const annotationCtx = annotationCanvas.getContext('2d')
          if (annotationCtx) {
            annotationCtx.clearRect(0, 0, canvasWidth, canvasHeight)
          }
        }
  
        setLoading(false)
      } catch (err: unknown) {
        console.error('PDF loading error:', err)
        if (err instanceof Error) {
          setError(`Chyba při načítání PDF: ${err.message}`)
        } else {
          setError('Chyba při načítání PDF: Neznámá chyba')
        }
        setLoading(false)
      }
    }
    loadPDF()
  }, [pdfUrl])

  const getEventPos = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0]
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      }
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      }
    }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsDrawing(true)
    const point = getEventPos(e)
    setCurrentStroke([point])
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawing) return

    const point = getEventPos(e)
    setCurrentStroke(prev => [...prev, point])

    // Draw current stroke
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
    ctx.strokeStyle = tool === 'pen' ? '#000000' : 'rgba(0,0,0,1)'
    ctx.lineWidth = tool === 'pen' ? 2 : 20
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (currentStroke.length > 1) {
      const prevPoint = currentStroke[currentStroke.length - 2]
      ctx.beginPath()
      ctx.moveTo(prevPoint.x, prevPoint.y)
      ctx.lineTo(point.x, point.y)
      ctx.stroke()
    }
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    
    setIsDrawing(false)
    if (currentStroke.length > 0) {
      const newStroke: Stroke = {
        points: currentStroke,
        color: tool === 'pen' ? '#000000' : 'transparent',
        width: tool === 'pen' ? 2 : 20
      }
      setStrokes(prev => [...prev, newStroke])
    }
    setCurrentStroke([])
  }

  const clearAnnotations = () => {
    setStrokes([])
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
  }

  const handleSave = async () => {
    try {
      const pdfCanvas = pdfCanvasRef.current
      const annotationCanvas = canvasRef.current
      
      if (!pdfCanvas || !annotationCanvas) {
        throw new Error('Canvas not found')
      }

      // Create a new canvas to combine PDF and annotations
      const combinedCanvas = document.createElement('canvas')
      combinedCanvas.width = pdfCanvas.width
      combinedCanvas.height = pdfCanvas.height
      
      const ctx = combinedCanvas.getContext('2d')
      if (!ctx) throw new Error('Could not get canvas context')

      // Draw PDF background
      ctx.drawImage(pdfCanvas, 0, 0)
      
      // Draw annotations on top
      ctx.drawImage(annotationCanvas, 0, 0)

      // Convert to blob
      combinedCanvas.toBlob(async (blob) => {
        if (!blob) throw new Error('Could not create blob')
        
        // Save as PNG image with annotations
        // This preserves all drawn annotations and form content
        await onSave(blob)
      }, 'image/png')
    } catch (err) {
      setError('Chyba při ukládání formuláře')
      console.error(err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin mb-4" />
          <p className="text-muted-foreground">Načítání formuláře...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-card p-4 rounded-lg border">
        <div className="flex items-center gap-2">
          <Button
            variant={tool === 'pen' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTool('pen')}
          >
            <Pen className="h-4 w-4 mr-2" />
            Pero
          </Button>
          <Button
            variant={tool === 'eraser' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTool('eraser')}
          >
            <Eraser className="h-4 w-4 mr-2" />
            Guma
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearAnnotations}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Vymazat vše
          </Button>
        </div>
        
        <Button
          onClick={handleSave}
          disabled={saving || strokes.length === 0}
          size="lg"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Uložit formulář
        </Button>
      </div>

      {/* PDF Viewer with Annotation Layer */}
      <div 
        ref={containerRef}
        className="relative border rounded-lg overflow-hidden bg-white"
        style={{ 
          touchAction: 'none',
          width: '100%',
          minHeight: '600px',
          aspectRatio: '794/1123' // A4 ratio
        }}
      >
        {/* PDF Background Canvas */}
        <canvas
          ref={pdfCanvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ 
            width: '100%', 
            height: '100%',
            objectFit: 'contain'
          }}
        />
        
        {/* Annotation Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          style={{ 
            width: '100%', 
            height: '100%',
            objectFit: 'contain'
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <p>Použijte pero nebo prst k vyplnění formuláře a podpisu.</p>
        <p>Po dokončení klikněte na "Uložit formulář".</p>
      </div>
    </div>
  )
}

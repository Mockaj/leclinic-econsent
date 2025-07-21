'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Pen, Eraser, RotateCcw, Save } from 'lucide-react'

interface Props {
  imageUrl: string
  onSave: (blob: Blob) => Promise<void>
  saving: boolean
}

interface Point { x: number; y: number }

export function ImageAnnotator({ imageUrl, onSave, saving }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentStroke, setCurrentStroke] = useState<Point[]>([])
  const [strokes, setStrokes] = useState<number>(0)
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const bgCanvasRef = useRef<HTMLCanvasElement>(null)
  const annCanvasRef = useRef<HTMLCanvasElement>(null)

  // Load image first
  useEffect(() => {
    console.log('ImageAnnotator: Starting to load image:', imageUrl)
    
    if (!imageUrl) {
      console.log('ImageAnnotator: No imageUrl provided')
      setError('URL obrázku není k dispozici')
      setLoading(false)
      return
    }
    
    const img = new Image()
    img.crossOrigin = 'anonymous' // Prevent tainted canvas for export
    console.log('ImageAnnotator: Created new Image element with crossOrigin=anonymous')
    
    img.onload = () => {
      console.log('ImageAnnotator: Image loaded successfully', {
        width: img.width,
        height: img.height,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight
      })
      setLoadedImage(img)
      setLoading(false) // Set loading to false here so canvas elements can render
      console.log('ImageAnnotator: Set loading to false, canvas should now render')
    }
    
    img.onerror = (e) => {
      console.error('ImageAnnotator: Image failed to load', {
        event: e,
        type: (e as Event)?.type,
        target: (e as Event)?.target,
        error: (e as any)?.error,
        message: (e as any)?.message
      })
      console.error('ImageAnnotator: Image src was:', imageUrl)
      console.error('ImageAnnotator: Image properties:', {
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        currentSrc: img.currentSrc
      })
      
      // Try to fetch the image directly to see what error we get
      fetch(imageUrl, { method: 'HEAD' })
        .then(response => {
          console.log('ImageAnnotator: HEAD request success:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
          })
          
          // If HEAD works, try fetching as blob and create object URL
          if (response.ok) {
            console.log('ImageAnnotator: HEAD worked, trying fetch as blob...')
            return fetch(imageUrl)
          }
          throw new Error(`HEAD request failed: ${response.status}`)
        })
        .then(response => {
          if (response && response.ok) {
            return response.blob()
          }
          throw new Error('Failed to fetch as blob')
        })
        .then(blob => {
          console.log('ImageAnnotator: Got blob:', {
            size: blob.size,
            type: blob.type
          })
          
          const objectUrl = URL.createObjectURL(blob)
          console.log('ImageAnnotator: Created object URL, trying to load with that...')
          
          const fallbackImg = new Image()
          fallbackImg.onload = () => {
            console.log('ImageAnnotator: Fallback image loaded successfully!')
            // Use the fallback image instead
            const cW = containerRef.current?.clientWidth || fallbackImg.width
            const scale = cW / fallbackImg.width
            const w = fallbackImg.width * scale
            const h = fallbackImg.height * scale
            
            ;[bgCanvasRef.current, annCanvasRef.current].forEach((cv, index) => {
              if (!cv) return
              cv.width = w
              cv.height = h
            })
            
            const ctx = bgCanvasRef.current?.getContext('2d')
            if (ctx) {
              ctx.drawImage(fallbackImg, 0, 0, w, h)
              setLoading(false)
              setError(null) // Clear the error
              console.log('ImageAnnotator: Fallback method succeeded!')
            }
            
            URL.revokeObjectURL(objectUrl) // Clean up
          }
          fallbackImg.onerror = () => {
            console.error('ImageAnnotator: Fallback image also failed')
            URL.revokeObjectURL(objectUrl)
          }
          fallbackImg.src = objectUrl
        })
        .catch(fetchError => {
          console.error('ImageAnnotator: Fetch approach failed:', fetchError)
        })
      
      setError('Chyba při načítání obrázku')
      setLoading(false)
    }
    
    console.log('ImageAnnotator: Setting image src to:', imageUrl)
    img.src = imageUrl
  }, [imageUrl])

  // Draw image to canvas when both image and canvas are ready
  useEffect(() => {
    if (!loadedImage) {
      console.log('ImageAnnotator: No loaded image yet')
      return
    }

    console.log('ImageAnnotator: Attempting to draw loaded image to canvas')
    console.log('ImageAnnotator: bgCanvas ref:', bgCanvasRef.current)
    console.log('ImageAnnotator: annCanvas ref:', annCanvasRef.current)

    if (!bgCanvasRef.current || !annCanvasRef.current) {
      console.log('ImageAnnotator: Canvas refs not ready yet, will retry when they are')
      return
    }

    const drawImageToCanvas = () => {
      const img = loadedImage
      const cW = containerRef.current?.clientWidth || img.width
      const scale = cW / img.width
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      
      console.log('ImageAnnotator: Canvas dimensions calculated', { cW, scale, w, h, originalW: img.width, originalH: img.height })
      
      // Set canvas dimensions
      if (bgCanvasRef.current) {
        bgCanvasRef.current.width = w
        bgCanvasRef.current.height = h
        console.log('ImageAnnotator: Set background canvas dimensions to', w, 'x', h)
      }
      
      if (annCanvasRef.current) {
        annCanvasRef.current.width = w
        annCanvasRef.current.height = h
        console.log('ImageAnnotator: Set annotation canvas dimensions to', w, 'x', h)
      }
      
      // Draw image on background canvas
      const ctx = bgCanvasRef.current?.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        console.log('ImageAnnotator: Successfully drew image on background canvas')
      } else {
        console.log('ImageAnnotator: Failed to get 2d context')
        setError('Failed to get canvas context')
      }
    }

    drawImageToCanvas()
  }, [loadedImage]) // This effect runs when loadedImage changes

  // Monitor canvas refs and redraw when they become available
  useEffect(() => {
    console.log('ImageAnnotator: Canvas ref effect running')
    console.log('ImageAnnotator: bgCanvas ref:', bgCanvasRef.current)
    console.log('ImageAnnotator: annCanvas ref:', annCanvasRef.current)
    
    if (loadedImage && bgCanvasRef.current && annCanvasRef.current) {
      console.log('ImageAnnotator: Both image and canvas refs are ready, drawing...')
      
      const img = loadedImage
      const cW = containerRef.current?.clientWidth || img.width
      const scale = cW / img.width
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      
      console.log('ImageAnnotator: Final canvas dimensions:', { cW, scale, w, h, originalW: img.width, originalH: img.height })
      
      // Set canvas dimensions
      bgCanvasRef.current.width = w
      bgCanvasRef.current.height = h
      annCanvasRef.current.width = w
      annCanvasRef.current.height = h
      
      // Draw image on background canvas
      const ctx = bgCanvasRef.current.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        console.log('ImageAnnotator: FINAL SUCCESS - Drew image on background canvas')
        setError(null)
      }
    } else {
      console.log('ImageAnnotator: Not all conditions met:', {
        hasImage: !!loadedImage,
        hasBgCanvas: !!bgCanvasRef.current,
        hasAnnCanvas: !!annCanvasRef.current
      })
    }
  }, [loadedImage, bgCanvasRef.current, annCanvasRef.current]) // Only run when these change

  const pos = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = annCanvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const sx = canvas.width / rect.width
    const sy = canvas.height / rect.height
    if ('touches' in e) {
      const t = e.touches[0] || e.changedTouches[0]
      return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy }
    }
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy }
  }

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    console.log('ImageAnnotator: Drawing started')
    setIsDrawing(true)
    setCurrentStroke([pos(e)])
  }

  const move = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawing) return
    const p = pos(e)
    console.log('ImageAnnotator: Drawing at position:', p)
    setCurrentStroke(s => [...s, p])
    const ctx = annCanvasRef.current?.getContext('2d')
    if (!ctx) {
      console.log('ImageAnnotator: No annotation canvas context!')
      return
    }
    console.log('ImageAnnotator: Drawing line on annotation canvas')
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
    ctx.strokeStyle = '#000'
    ctx.lineWidth = tool === 'pen' ? 2 : 20
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const prev = currentStroke[currentStroke.length - 1]
    if (prev) {
      ctx.beginPath()
      ctx.moveTo(prev.x, prev.y)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
      console.log('ImageAnnotator: Drew line from', prev, 'to', p)
    }
  }

  const end = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    if (currentStroke.length) setStrokes(s => s + 1)
    setCurrentStroke([])
  }

  const clear = () => {
    const ctx = annCanvasRef.current?.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, annCanvasRef.current!.width, annCanvasRef.current!.height)
    setStrokes(0)
  }

  const save = async () => {
    console.log('ImageAnnotator: Starting save process...')
    try {
      console.log('ImageAnnotator: Getting canvas references...')
      const bg = bgCanvasRef.current!
      const ann = annCanvasRef.current!
      
      if (!bg || !ann) {
        console.error('ImageAnnotator: Canvas refs not available:', { bg: !!bg, ann: !!ann })
        throw new Error('Canvas not ready')
      }
      
      console.log('ImageAnnotator: Canvas dimensions:', { bgW: bg.width, bgH: bg.height, annW: ann.width, annH: ann.height })
      
      console.log('ImageAnnotator: Creating combo canvas...')
      const combo = document.createElement('canvas')
      combo.width = bg.width
      combo.height = bg.height
      const ctx = combo.getContext('2d')!
      
      if (!ctx) {
        console.error('ImageAnnotator: Failed to get combo canvas context')
        throw new Error('Canvas context fail')
      }
      
      console.log('ImageAnnotator: Drawing background to combo canvas...')
      ctx.drawImage(bg, 0, 0)
      
      console.log('ImageAnnotator: Drawing annotations to combo canvas...')
      ctx.drawImage(ann, 0, 0)
      
      console.log('ImageAnnotator: Converting to blob...')
      combo.toBlob(async (blob) => {
        try {
          if (!blob) {
            console.error('ImageAnnotator: Failed to create blob')
            throw new Error('Blob creation failed')
          }
          
          console.log('ImageAnnotator: Blob created successfully:', { size: blob.size, type: blob.type })
          console.log('ImageAnnotator: Calling onSave with blob...')
          
          await onSave(blob)
          console.log('ImageAnnotator: Save completed successfully!')
        } catch (saveErr) {
          console.error('ImageAnnotator: Error in blob callback:', saveErr)
          setError('Chyba při ukládání: ' + (saveErr as Error).message)
        }
      }, 'image/png')
    } catch (err) {
      console.error('ImageAnnotator: Error in save function:', err)
      setError('Chyba při ukládání: ' + (err as Error).message)
    }
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-card p-4 rounded-lg border">
        <div className="flex gap-2">
          <Button variant={tool==='pen'?'default':'outline'} size="sm" onClick={()=>setTool('pen')}>
            <Pen className="h-4 w-4 mr-2"/>Pero
          </Button>
          <Button variant={tool==='eraser'?'default':'outline'} size="sm" onClick={()=>setTool('eraser')}>
            <Eraser className="h-4 w-4 mr-2"/>Guma
          </Button>
          <Button variant="outline" size="sm" onClick={clear}>
            <RotateCcw className="h-4 w-4 mr-2"/>Vymazat vše
          </Button>
        </div>
        <Button onClick={save} disabled={saving||!strokes} size="lg">
          {saving?<Loader2 className="h-4 w-4 mr-2 animate-spin"/>:<Save className="h-4 w-4 mr-2"/>}
          Uložit formulář
        </Button>
      </div>
      <div ref={containerRef} className="relative border rounded-lg bg-white" style={{touchAction:'none',width:'100%'}}>
        <canvas
          ref={bgCanvasRef}
          className="absolute top-0 left-0"
        />
        <canvas
          ref={annCanvasRef}
          className="absolute top-0 left-0 cursor-crosshair" 
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end} 
          onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
      </div>
      <div className="text-center text-sm text-muted-foreground">
        <p>Použijte pero nebo prst k vyplnění formuláře a podpisu.</p>
      </div>
    </div>
  )
}

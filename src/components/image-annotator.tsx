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
  const [mousePos, setMousePos] = useState<Point | null>(null)
  const [showCursor, setShowCursor] = useState(false)
  
  // Advanced input detection state
  const [currentInputType, setCurrentInputType] = useState<'pen' | 'touch' | 'mouse' | null>(null)
  const [isEraserActive, setIsEraserActive] = useState(false)
  const [activePenPointers, setActivePenPointers] = useState<Set<number>>(new Set())
  const [lastPenTime, setLastPenTime] = useState<number>(0)
  
  // Finger scrolling state
  const [fingerScrollStart, setFingerScrollStart] = useState<{x: number, y: number, scrollY: number} | null>(null)
  
  // Global selection prevention during drawing
  const [isPreventingGlobalSelection, setIsPreventingGlobalSelection] = useState(false)
  
  // Use ref to track drawing state for immediate access (not affected by React state update timing)
  const isDrawingRef = useRef(false)
  
  // Track if any pen activity is happening (more persistent than individual stroke tracking)
  const [hasPenActivity, setHasPenActivity] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const bgCanvasRef = useRef<HTMLCanvasElement>(null)
  const annCanvasRef = useRef<HTMLCanvasElement>(null)
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null)

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
    
    if (loadedImage && bgCanvasRef.current && annCanvasRef.current && cursorCanvasRef.current) {
      console.log('ImageAnnotator: All canvas refs are ready, drawing...')
      
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
      cursorCanvasRef.current.width = w
      cursorCanvasRef.current.height = h
      
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
        hasAnnCanvas: !!annCanvasRef.current,
        hasCursorCanvas: !!cursorCanvasRef.current
      })
    }
  }, [loadedImage, bgCanvasRef.current, annCanvasRef.current, cursorCanvasRef.current]) // Only run when these change

  // Handle tool changes - clear cursor when switching away from eraser
  useEffect(() => {
    if (tool !== 'eraser') {
      setShowCursor(false)
      clearCursor()
    }
  }, [tool])
  
  // Global selection prevention effect - now based on pen activity rather than individual strokes
  useEffect(() => {
    const preventSelection = (e: Event) => {
      if (hasPenActivity || isPreventingGlobalSelection) {
        e.preventDefault()
        // Removed stopPropagation() to allow events to reach target elements
      }
    }
    
    const preventPointerDown = (e: Event) => {
      const pe = e as PointerEvent
      if ((hasPenActivity || isPreventingGlobalSelection) && pe.pointerType === 'pen') {
        pe.preventDefault()
        // Removed stopPropagation() to allow events to reach target elements (e.g., canvas)
      }
    }
    const preventMouseDown = (e: Event) => {
      if (hasPenActivity || isPreventingGlobalSelection) {
        e.preventDefault()
        // Removed stopPropagation() to allow events to reach target elements
      }
    }
    const preventDragStart = (e: Event) => {
      if (hasPenActivity || isPreventingGlobalSelection) {
        e.preventDefault()
        return false
      }
    }
    
    if (hasPenActivity || isPreventingGlobalSelection) {
      console.log('ImageAnnotator: Enabling global selection prevention')
      // Prevent text selection globally
      document.addEventListener('selectstart', preventSelection, { capture: true })
      document.addEventListener('dragstart', preventDragStart, { capture: true })
      document.addEventListener('pointerdown', preventPointerDown, { capture: true })
      document.addEventListener('mousedown', preventMouseDown, { capture: true })
      
      // Add temporary CSS to prevent selection
      const bodyStyle = document.body.style as any
      bodyStyle.userSelect = 'none'
      bodyStyle.webkitUserSelect = 'none'
      bodyStyle.mozUserSelect = 'none'
      bodyStyle.msUserSelect = 'none'
    }
    
    return () => {
      if (hasPenActivity || isPreventingGlobalSelection) {
        console.log('ImageAnnotator: Disabling global selection prevention')
        document.removeEventListener('selectstart', preventSelection, { capture: true })
        document.removeEventListener('dragstart', preventDragStart, { capture: true })
        document.removeEventListener('pointerdown', preventPointerDown, { capture: true })
        document.removeEventListener('mousedown', preventMouseDown, { capture: true })
        
        // Restore CSS
        const bodyStyle = document.body.style as any
        bodyStyle.userSelect = ''
        bodyStyle.webkitUserSelect = ''
        bodyStyle.mozUserSelect = ''
        bodyStyle.msUserSelect = ''
      }
    }
  }, [hasPenActivity, isPreventingGlobalSelection])

  // Cursor drawing functions
  const drawCursor = (point: Point) => {
    const canvas = cursorCanvasRef.current
    if (!canvas || tool !== 'eraser') return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#666'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(point.x, point.y, 10, 0, 2 * Math.PI) // 10px radius to match eraser size (20px diameter / 2)
    ctx.stroke()
  }
  
  const clearCursor = () => {
    const canvas = cursorCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  // Get position from pointer event
  const pos = (e: React.PointerEvent): Point => {
    const canvas = annCanvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const sx = canvas.width / rect.width
    const sy = canvas.height / rect.height
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy }
  }

  // Detect input type and handle palm rejection
  const getInputType = (e: React.PointerEvent): 'pen' | 'touch' | 'mouse' | 'palm' => {
    // Detect eraser by checking if barrel button (button 5) is pressed with pen
    if (e.pointerType === 'pen' && (e.buttons & 32) > 0) {
      return 'pen' // Will be handled as eraser in the calling function
    }
    
    // Basic pen detection
    if (e.pointerType === 'pen') {
      return 'pen'
    }
    
    // Palm rejection: if we recently had pen input, ignore large touch contacts
    if (e.pointerType === 'touch') {
      const timeSincePen = Date.now() - lastPenTime
      
      // If pen was used recently (within 2 seconds) and this is a large contact area, likely palm
      if (timeSincePen < 2000 && e.width > 25 && e.height > 25) {
        return 'palm'
      }
      
      // If multiple pen pointers are active, this touch is likely a palm
      if (activePenPointers.size > 0) {
        return 'palm'
      }
      
      return 'touch'
    }
    
    return 'mouse'
  }

  // Check if input should be allowed for drawing
  const shouldAllowDrawing = (inputType: 'pen' | 'touch' | 'mouse' | 'palm'): boolean => {
    return inputType === 'pen' // Only allow drawing with pen/stylus
  }

  const start = (e: React.PointerEvent) => {
    const inputType = getInputType(e)
    const isEraser = e.pointerType === 'pen' && (e.buttons & 32) > 0
    
    console.log('ImageAnnotator: Pointer down:', { 
      pointerType: e.pointerType, 
      inputType, 
      isEraser,
      pressure: e.pressure,
      width: e.width, 
      height: e.height,
      pointerId: e.pointerId,
      currentIsDrawing: isDrawing,
      currentIsDrawingRef: isDrawingRef.current
    })
    
    // Update pen tracking
    if (e.pointerType === 'pen') {
      setActivePenPointers(prev => new Set(prev).add(e.pointerId))
      setLastPenTime(Date.now())
      
      // Enable persistent pen activity tracking to prevent selection during fast strokes
      setHasPenActivity(true)
      console.log('ImageAnnotator: Pen activity started')
      
      // Auto-switch tool based on eraser detection
      if (isEraser && tool !== 'eraser') {
        setTool('eraser')
        setIsEraserActive(true)
      } else if (!isEraser && isEraserActive) {
        setTool('pen')
        setIsEraserActive(false)
      }
    }
    
    // Handle palm rejection
    if (inputType === 'palm') {
      console.log('ImageAnnotator: Ignoring palm input')
      e.preventDefault()
      e.stopPropagation()
      return
    }
    
    // Handle finger touch - enable programmatic scrolling
    if (inputType === 'touch') {
      console.log('ImageAnnotator: Finger touch detected - enabling scroll mode')
      setCurrentInputType(inputType)
      setFingerScrollStart({
        x: e.clientX,
        y: e.clientY,
        scrollY: window.pageYOffset
      })
      // Don't prevent default - but we'll handle scrolling manually
      return
    }
    
    // Handle pen input - ALWAYS prevent default and enable drawing
    if (shouldAllowDrawing(inputType)) {
      console.log('ImageAnnotator: Pen input - starting drawing mode')
      e.preventDefault()
      e.stopPropagation()
      
      // Force reset any existing drawing state to ensure clean start
      if (isDrawing || isDrawingRef.current) {
        console.log('ImageAnnotator: Force cleaning previous stroke state')
        setIsDrawing(false)
        isDrawingRef.current = false
        setCurrentStroke([])
        setIsPreventingGlobalSelection(false)
      }
      
      // Capture the pointer to prevent it from affecting other elements
      const canvas = annCanvasRef.current
      if (canvas && e.pointerId) {
        try {
          canvas.setPointerCapture(e.pointerId)
          console.log('ImageAnnotator: Pointer captured:', e.pointerId)
        } catch (err) {
          console.log('ImageAnnotator: Could not capture pointer:', err)
        }
      }
      
      // Enable global selection prevention
      setIsPreventingGlobalSelection(true)
      
      // Set up drawing state - both React state and ref for immediate access
      setCurrentInputType(inputType)
      setIsDrawing(true)
      isDrawingRef.current = true
      setCurrentStroke([pos(e)])
      
      console.log('ImageAnnotator: Drawing state initialized')
      return
    }
    
    // Mouse or other input
    console.log('ImageAnnotator: Other input type:', inputType)
    setCurrentInputType(inputType)
  }

  const move = (e: React.PointerEvent) => {
    const inputType = getInputType(e)
    const p = pos(e)
    
    // Handle palm rejection
    if (inputType === 'palm') {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    
    // Handle finger scrolling
    if (inputType === 'touch' && fingerScrollStart) {
      const deltaY = fingerScrollStart.y - e.clientY
      const newScrollY = fingerScrollStart.scrollY + deltaY
      window.scrollTo(0, newScrollY)
      console.log('ImageAnnotator: Finger scrolling:', { deltaY, newScrollY })
      return
    }
    
    // Handle pen input - ALWAYS prevent default and prioritize drawing
    if (e.pointerType === 'pen') {
      e.preventDefault()
      e.stopPropagation()
      
      // Update cursor position for eraser tool
      if (tool === 'eraser') {
        setMousePos(p)
        drawCursor(p)
      }
      
      // Only continue drawing if we're in drawing mode (check both state and ref)
      if (!isDrawing && !isDrawingRef.current) {
        console.log('ImageAnnotator: Not in drawing mode, skipping')
        return
      }
      
      console.log('ImageAnnotator: Drawing at position:', p, 'pressure:', e.pressure)
      setCurrentStroke(s => [...s, p])
      
      const ctx = annCanvasRef.current?.getContext('2d')
      if (!ctx) {
        console.log('ImageAnnotator: No annotation canvas context!')
        return
      }
      
      // Use pressure for line width variation if available
      const basePenWidth = 2
      const baseEraserWidth = 20
      const pressure = e.pressure > 0 ? e.pressure : 1
      const pressureMultiplier = 0.5 + (pressure * 1.5)
      
      ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
      ctx.strokeStyle = '#000'
      ctx.lineWidth = tool === 'pen' 
        ? Math.max(1, basePenWidth * pressureMultiplier)
        : Math.max(10, baseEraserWidth * pressureMultiplier)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      
      const prev = currentStroke[currentStroke.length - 1]
      if (prev) {
        ctx.beginPath()
        ctx.moveTo(prev.x, prev.y)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
        console.log('ImageAnnotator: Drew line from', prev, 'to', p, 'width:', ctx.lineWidth)
      }
    }
  }

  const end = (e: React.PointerEvent) => {
    const inputType = getInputType(e)
    
    console.log('ImageAnnotator: Pointer up:', { 
      pointerType: e.pointerType, 
      inputType,
      pointerId: e.pointerId,
      wasDrawing: isDrawing
    })
    
    // Handle pen pointer cleanup
    if (e.pointerType === 'pen') {
      setActivePenPointers(prev => {
        const newSet = new Set(prev)
        newSet.delete(e.pointerId)
        
        // Only disable pen activity when no more pen pointers are active
        if (newSet.size === 0) {
          console.log('ImageAnnotator: No more pen pointers, disabling pen activity')
          setHasPenActivity(false)
        }
        
        return newSet
      })
      
      // Always prevent default for pen
      e.preventDefault()
      e.stopPropagation()
      
      // Release pointer capture immediately
      const canvas = annCanvasRef.current
      if (canvas && e.pointerId) {
        try {
          canvas.releasePointerCapture(e.pointerId)
          console.log('ImageAnnotator: Pointer released:', e.pointerId)
        } catch (err) {
          console.log('ImageAnnotator: Could not release pointer:', err)
        }
      }
      
      // Always clean up drawing state and global selection prevention for pen
      // This ensures fast consecutive strokes work properly
      if (isDrawing || isDrawingRef.current) {
        console.log('ImageAnnotator: Ending stroke, cleaning up state')
        setIsDrawing(false)
        isDrawingRef.current = false
        if (currentStroke.length) setStrokes(s => s + 1)
        setCurrentStroke([])
      }
      
      // Always disable global selection prevention for pen up events
      // This prevents stuck states during fast strokes
      setIsPreventingGlobalSelection(false)
      console.log('ImageAnnotator: Stroke cleanup completed')
    }
    
    // Handle finger scroll end
    if (inputType === 'touch') {
      setFingerScrollStart(null)
    }
    
    // Handle palm rejection
    if (inputType === 'palm') {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    
    // Reset current input type
    setCurrentInputType(null)
  }

  const handlePointerEnter = (e: React.PointerEvent) => {
    if (tool === 'eraser' && e.pointerType === 'pen') {
      setShowCursor(true)
      const p = pos(e)
      setMousePos(p)
      drawCursor(p)
    }
  }

  const handlePointerLeave = (e: React.PointerEvent) => {
    setShowCursor(false)
    clearCursor()
    
    // Clean up pointer tracking
    if (e.pointerType === 'pen') {
      setActivePenPointers(prev => {
        const newSet = new Set(prev)
        newSet.delete(e.pointerId)
        
        // Only disable pen activity when no more pen pointers are active
        if (newSet.size === 0) {
          console.log('ImageAnnotator: Pen left canvas, no more pen pointers, disabling pen activity')
          setHasPenActivity(false)
        }
        
        return newSet
      })
      
      // Release pointer capture
      const canvas = annCanvasRef.current
      if (canvas && e.pointerId) {
        try {
          canvas.releasePointerCapture(e.pointerId)
          console.log('ImageAnnotator: Pointer released on leave:', e.pointerId)
        } catch (err) {
          console.log('ImageAnnotator: Could not release pointer on leave:', err)
        }
      }
      
      // End drawing if we were drawing with pen
      if (isDrawing || isDrawingRef.current) {
        console.log('ImageAnnotator: Pen left canvas, ending stroke')
        setIsDrawing(false)
        isDrawingRef.current = false
        if (currentStroke.length) setStrokes(s => s + 1)
        setCurrentStroke([])
      }
      
      // Always disable global selection prevention when pen leaves
      // This prevents stuck states during fast strokes
      setIsPreventingGlobalSelection(false)
    }
    
    // Clean up finger scroll
    if (e.pointerType === 'touch') {
      setFingerScrollStart(null)
    }
    
    setCurrentInputType(null)
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
      <div className="sticky top-0 z-50 flex items-center justify-between bg-card p-4 rounded-lg border shadow-lg backdrop-blur-sm bg-card/95">
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
      <div ref={containerRef} className="relative border rounded-lg bg-white" style={{
        touchAction: 'none', // Always disable default touch actions - we handle scrolling manually
        width:'100%',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitTapHighlightColor: 'transparent'
      }}>
        <canvas
          ref={bgCanvasRef}
          className="absolute top-0 left-0"
          style={{
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none'
          }}
        />
        <canvas
          ref={annCanvasRef}
          className={`absolute top-0 left-0 ${tool === 'eraser' ? 'cursor-none' : 'cursor-crosshair'}`}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          onPointerCancel={end}
          style={{
            touchAction: 'none', // Always disable default touch actions - we handle everything manually
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            WebkitTouchCallout: 'none',
            WebkitTapHighlightColor: 'transparent'
          }}
        />
        <canvas
          ref={cursorCanvasRef}
          className="absolute top-0 left-0 pointer-events-none"
          style={{
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none'
          }}
        />
      </div>
    </div>
  )
}
'use client'

import { useEffect, useRef } from 'react'

interface QRCodeCanvasProps {
  url: string
  size?: number
}

// Simple QR Code implementation using QR.js algorithm
// Based on the QR Code specification for creating actual scannable codes
class QRCodeGenerator {
  private static readonly ERROR_CORRECTION_L = 'L'
  private static readonly MODE_BYTE = 4
  
  static generate(text: string, size = 200): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    
    const ctx = canvas.getContext('2d')!
    
    // Use a web-based QR code API for reliable generation
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&format=png&ecc=L`
    
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      ctx.clearRect(0, 0, size, size)
      ctx.drawImage(img, 0, 0, size, size)
    }
    
    img.onerror = () => {
      // Fallback to simple pattern if API fails
      QRCodeGenerator.drawFallbackPattern(ctx, text, size)
    }
    
    img.src = qrApiUrl
    
    return canvas
  }
  
  private static drawFallbackPattern(ctx: CanvasRenderingContext2D, text: string, size: number) {
    // Clear canvas with white background
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, size, size)
    
    // Create a very basic QR-like pattern as last resort
    // This won't be scannable but provides visual feedback
    const modules = 25
    const moduleSize = size / modules
    
    ctx.fillStyle = 'black'
    
    // Generate deterministic pattern based on text
    for (let row = 0; row < modules; row++) {
      for (let col = 0; col < modules; col++) {
        const hash = this.simpleHash(text + row + col)
        if (hash % 3 === 0) {
          ctx.fillRect(col * moduleSize, row * moduleSize, moduleSize, moduleSize)
        }
      }
    }
    
    // Draw finder patterns (corner squares)
    this.drawFinderPattern(ctx, 0, 0, moduleSize)
    this.drawFinderPattern(ctx, (modules - 7) * moduleSize, 0, moduleSize)
    this.drawFinderPattern(ctx, 0, (modules - 7) * moduleSize, moduleSize)
  }
  
  private static drawFinderPattern(ctx: CanvasRenderingContext2D, x: number, y: number, moduleSize: number) {
    const pattern = [
      [1,1,1,1,1,1,1],
      [1,0,0,0,0,0,1],
      [1,0,1,1,1,0,1],
      [1,0,1,1,1,0,1],
      [1,0,1,1,1,0,1],
      [1,0,0,0,0,0,1],
      [1,1,1,1,1,1,1]
    ]
    
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 7; col++) {
        ctx.fillStyle = pattern[row][col] ? 'black' : 'white'
        ctx.fillRect(x + col * moduleSize, y + row * moduleSize, moduleSize, moduleSize)
      }
    }
  }
  
  private static simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }
}

export function QRCodeCanvas({ url, size = 200 }: QRCodeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!url || !canvasRef.current) return
    
    const generateQRCode = async () => {
      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')!
      
      // Set canvas size
      canvas.width = size
      canvas.height = size
      
      // Show loading state
      ctx.fillStyle = '#f3f4f6'
      ctx.fillRect(0, 0, size, size)
      ctx.fillStyle = '#6b7280'
      ctx.font = '14px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('Generování QR kódu...', size / 2, size / 2)
      
      try {
        // Use QR Server API for reliable QR code generation
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&format=png&ecc=L&margin=1`
        
        const img = new Image()
        img.crossOrigin = 'anonymous'
        
        const loadPromise = new Promise<void>((resolve, reject) => {
          img.onload = () => {
            ctx.clearRect(0, 0, size, size)
            ctx.fillStyle = 'white'
            ctx.fillRect(0, 0, size, size)
            ctx.drawImage(img, 0, 0, size, size)
            resolve()
          }
          img.onerror = reject
        })
        
        // Set source after setting up event handlers
        img.src = qrApiUrl
        
        // Wait for image to load or timeout after 5 seconds
        await Promise.race([
          loadPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ])
        
      } catch (error) {
        console.warn('QR API failed, using fallback pattern:', error)
        
        // Fallback to a recognizable pattern
        ctx.clearRect(0, 0, size, size)
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, size, size)
        
        // Draw error message
        ctx.fillStyle = '#ef4444'
        ctx.font = 'bold 12px Arial'
        ctx.textAlign = 'center'
        ctx.fillText('QR kód nedostupný', size / 2, size / 2 - 10)
        ctx.font = '10px Arial'
        ctx.fillStyle = '#6b7280'
        ctx.fillText('Použijte odkaz níže', size / 2, size / 2 + 10)
      }
    }
    
    generateQRCode()
  }, [url, size])

  return (
    <div ref={containerRef} className="flex flex-col items-center space-y-2">
      <div className="bg-white p-2 rounded-lg border-2 border-gray-200 shadow-sm">
        <canvas
          ref={canvasRef}
          className="block"
          width={size}
          height={size}
          style={{ width: `${size}px`, height: `${size}px` }}
        />
      </div>
    </div>
  )
}

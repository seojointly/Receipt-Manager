'use client'

import { useRef, useState } from 'react'
import { Upload, Camera, Plus, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface ImageUploaderProps {
  onImages: (images: string[]) => void
  disabled?: boolean
}

const MAX_SIZE = 20 * 1024 * 1024
const MAX_IMAGES = 5
const MAX_DIMENSION = 1920
const COMPRESS_QUALITY = 0.8

type PerfWithMemory = Performance & {
  memory?: { usedJSHeapSize: number; totalJSHeapSize: number }
}

function getMemoryMB(): string {
  const mem = (performance as PerfWithMemory).memory
  return mem ? `${(mem.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB` : 'N/A'
}

function compressImage(input: File | Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    console.log(`[압축 시작] 입력: ${(input.size / 1024).toFixed(1)}KB | 메모리: ${getMemoryMB()}`)

    const url = URL.createObjectURL(input)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width >= height) {
          height = Math.round((height * MAX_DIMENSION) / width)
          width = MAX_DIMENSION
        } else {
          width = Math.round((width * MAX_DIMENSION) / height)
          height = MAX_DIMENSION
        }
      }

      console.log(`[Canvas 생성] ${width}x${height} | 메모리: ${getMemoryMB()}`)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        canvas.width = 0
        canvas.height = 0
        reject(new Error('Canvas를 사용할 수 없습니다.'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          canvas.width = 0
          canvas.height = 0
          console.log(`[Canvas 해제] | 메모리: ${getMemoryMB()}`)
          if (!blob) { reject(new Error('이미지 압축에 실패했습니다.')); return }
          console.log(`[압축 완료] ${(input.size / 1024).toFixed(1)}KB → ${(blob.size / 1024).toFixed(1)}KB | 메모리: ${getMemoryMB()}`)
          resolve(blob)
        },
        'image/jpeg',
        COMPRESS_QUALITY,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('이미지 로드에 실패했습니다.'))
    }

    img.src = url
  })
}

async function fileToBase64(file: File): Promise<string> {
  if (file.size > MAX_SIZE) {
    throw new Error(`'${file.name}' 파일이 20MB를 초과합니다.`)
  }
  const compressed = await compressImage(file)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('파일 읽기 실패'))
    reader.readAsDataURL(compressed)
  })
}

export function ImageUploader({ onImages, disabled }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [capturedImages, setCapturedImages] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  // async 함수 내 stale closure 방지: 항상 최신 값을 ref로 읽는다
  const capturedImagesRef = useRef<string[]>([])
  const isProcessingRef = useRef(false)

  function updateCapturedImages(images: string[]) {
    capturedImagesRef.current = images
    setCapturedImages(images)
  }

  function setProcessing(val: boolean) {
    isProcessingRef.current = val
    setIsProcessing(val)
  }

  async function handleFileInput(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)
    const fileArr = Array.from(files)
    if (fileArr.length > MAX_IMAGES) {
      setError(`최대 ${MAX_IMAGES}장까지 업로드 가능합니다.`)
      return
    }
    try {
      const base64List = await Promise.all(fileArr.map(fileToBase64))
      onImages(base64List)
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일 업로드에 실패했습니다.')
    }
  }

  async function handleCameraCapture(files: FileList | null) {
    const captureNumber = capturedImagesRef.current.length + 1
    console.log(
      `[촬영 ${captureNumber}] 시작 | capturedImages.length: ${capturedImagesRef.current.length} | isProcessing: ${isProcessingRef.current}`
    )

    const file = files?.[0]
    if (!file || isProcessingRef.current) {
      console.log(`[촬영 ${captureNumber}] 차단됨 | file: ${!!file} | isProcessing: ${isProcessingRef.current}`)
      return
    }

    setProcessing(true)
    setError(null)
    if (cameraInputRef.current) cameraInputRef.current.value = ''

    try {
      const base64 = await fileToBase64(file)
      const newImages = [...capturedImagesRef.current, base64]
      console.log(
        `[촬영 ${captureNumber}] 압축 완료 | newImages.length: ${newImages.length} | ref: ${capturedImagesRef.current.length}`
      )
      updateCapturedImages(newImages)

      if (newImages.length >= MAX_IMAGES) {
        console.log(`[촬영 ${captureNumber}] MAX_IMAGES 도달 → onImages 호출`)
        onImages(newImages)
        updateCapturedImages([])
      }
    } catch (err) {
      console.log(`[촬영 ${captureNumber}] 오류:`, err)
      setError(err instanceof Error ? err.message : '촬영에 실패했습니다.')
    } finally {
      console.log(`[촬영 ${captureNumber}] finally → isProcessing = false`)
      setProcessing(false)
    }
  }

  function handleCameraComplete() {
    if (capturedImagesRef.current.length === 0) return
    onImages(capturedImagesRef.current)
    updateCapturedImages([])
  }

  function triggerCamera() {
    if (cameraInputRef.current) {
      cameraInputRef.current.value = ''
      cameraInputRef.current.click()
    }
  }

  // 카메라 모드: 1장 이상 촬영된 상태
  if (capturedImages.length > 0) {
    return (
      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto rounded-2xl border border-zinc-100 bg-zinc-50 p-3">
          {capturedImages.map((img, i) => (
            <img
              key={i}
              src={img}
              alt={`촬영 ${i + 1}`}
              className="h-20 w-20 shrink-0 rounded-xl object-cover"
            />
          ))}
        </div>
        <p className="text-center text-sm text-zinc-400">
          {capturedImages.length} / {MAX_IMAGES}장 촬영됨
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={triggerCamera}
            disabled={capturedImages.length >= MAX_IMAGES || isProcessing}
          >
            <Plus className="h-4 w-4" />
            {isProcessing ? '처리 중...' : '추가 촬영'}
          </Button>
          <Button className="flex-1" onClick={handleCameraComplete}>
            <Check className="h-4 w-4" />
            완료 ({capturedImages.length}장)
          </Button>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleCameraCapture(e.target.files)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileInput(e.dataTransfer.files) }}
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 transition-colors ${
          dragOver ? 'border-blue-400 bg-blue-50' : 'border-zinc-200 bg-zinc-50'
        }`}
      >
        <Upload className="h-8 w-8 text-zinc-400" />
        <p className="text-sm text-zinc-500">영수증 이미지를 드래그하거나 (최대 5장)</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={disabled}>
            파일 선택
          </Button>
          <Button variant="secondary" onClick={() => cameraInputRef.current?.click()} disabled={disabled || isProcessing}>
            <Camera className="h-4 w-4" />
            카메라
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileInput(e.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleCameraCapture(e.target.files)}
      />
    </div>
  )
}

'use client'

import { useRef, useState } from 'react'
import { Upload, Camera, Plus, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface ImageUploaderProps {
  onImages: (images: string[]) => void
  disabled?: boolean
}

const MAX_SIZE = 20 * 1024 * 1024
const MAX_IMAGES = 3

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_SIZE) {
      reject(new Error(`'${file.name}' 파일이 20MB를 초과합니다.`))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('파일 읽기 실패'))
    reader.readAsDataURL(file)
  })
}

export function ImageUploader({ onImages, disabled }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [capturedImages, setCapturedImages] = useState<string[]>([])

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
    const file = files?.[0]
    if (!file) return
    setError(null)
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    try {
      const base64 = await fileToBase64(file)
      const newImages = [...capturedImages, base64]
      setCapturedImages(newImages)
      if (newImages.length >= MAX_IMAGES) {
        onImages(newImages)
        setCapturedImages([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '촬영에 실패했습니다.')
    }
  }

  function handleCameraComplete() {
    if (capturedImages.length === 0) return
    onImages(capturedImages)
    setCapturedImages([])
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
            disabled={capturedImages.length >= MAX_IMAGES}
          >
            <Plus className="h-4 w-4" />
            추가 촬영
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
        <p className="text-sm text-zinc-500">영수증 이미지를 드래그하거나 (최대 3장)</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={disabled}>
            파일 선택
          </Button>
          <Button variant="secondary" onClick={() => cameraInputRef.current?.click()} disabled={disabled}>
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

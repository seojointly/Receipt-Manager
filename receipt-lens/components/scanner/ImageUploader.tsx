'use client'

import { useRef, useState } from 'react'
import { Upload, Camera } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface ImageUploaderProps {
  onImage: (base64: string) => void
  disabled?: boolean
}

const MAX_SIZE = 5 * 1024 * 1024

export function ImageUploader({ onImage, disabled }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function processFile(file: File) {
    setError(null)
    if (file.size > MAX_SIZE) {
      setError('파일 크기가 5MB를 초과합니다.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') onImage(reader.result)
    }
    reader.readAsDataURL(file)
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    processFile(files[0])
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 transition-colors ${
          dragOver ? 'border-blue-400 bg-blue-50' : 'border-zinc-200 bg-zinc-50'
        }`}
      >
        <Upload className="h-8 w-8 text-zinc-400" />
        <p className="text-sm text-zinc-500">영수증 이미지를 여기에 드래그하거나</p>
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
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  )
}

'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface UseCameraReturn {
  stream: MediaStream | null
  error: string | null
  isActive: boolean
  startCamera: () => Promise<void>
  stopCamera: () => void
}

export function useCamera(): UseCameraReturn {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setStream(null)
    }
  }, [])

  const startCamera = useCallback(async () => {
    setError(null)
    try {
      const constraints: MediaStreamConstraints = {
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = mediaStream
      setStream(mediaStream)
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? '카메라 접근 권한이 거부되었습니다.'
          : err instanceof DOMException && err.name === 'NotFoundError'
            ? '카메라를 찾을 수 없습니다.'
            : '카메라를 시작할 수 없습니다.'
      setError(message)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  return {
    stream,
    error,
    isActive: stream !== null,
    startCamera,
    stopCamera,
  }
}

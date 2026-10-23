'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Camera, CameraOff, CheckCircle2, RefreshCw, ScanLine } from 'lucide-react'
import type { Html5Qrcode } from 'html5-qrcode'
import { resolveOrderCodeAction } from '@/app/actions/cashier'
import { cn } from '@/lib/utils'
import { inputClass } from '../form-controls'

const READER_ID = 'cafetec-qr-reader'
const REAR_CAMERA = /back|rear|trasera|environment|posterior/i

type ScanState = 'idle' | 'starting' | 'scanning' | 'resolving' | 'paused'
type Message = { tone: 'error' | 'success' | 'info'; text: string }

function cameraErrorText(error: unknown) {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  if (/NotAllowed|Permission|denied/i.test(text)) {
    return 'No se concedió permiso para usar la cámara. Actívalo en la configuración del navegador o usa el folio manual.'
  }
  if (/NotFound|no camera|Requested device not found/i.test(text)) return 'No se encontró ninguna cámara en este dispositivo.'
  if (/NotReadable|in use|Could not start/i.test(text)) return 'La cámara está ocupada por otra aplicación. Ciérrala e intenta de nuevo.'
  return 'No se pudo iniciar la cámara. Intenta de nuevo o usa el folio manual.'
}

export function QrScanner() {
  const router = useRouter()
  const scannerRef = useRef<Html5Qrcode | null>(null)
  // Guards against processing the same code repeatedly while a lookup is in flight.
  const busyRef = useRef(false)
  const [state, setState] = useState<ScanState>('idle')
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([])
  const [cameraId, setCameraId] = useState('')
  const [message, setMessage] = useState<Message | null>(null)
  const [supported, setSupported] = useState<boolean | null>(null)

  useEffect(() => {
    setSupported(window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia))
    return () => {
      const scanner = scannerRef.current
      if (scanner?.isScanning) scanner.stop().then(() => scanner.clear()).catch(() => undefined)
    }
  }, [])

  async function handleDecoded(text: string) {
    const scanner = scannerRef.current
    if (busyRef.current || !scanner) return
    busyRef.current = true
    try {
      scanner.pause(true)
    } catch {
      // already paused
    }
    navigator.vibrate?.(60)
    setState('resolving')
    setMessage({ tone: 'info', text: 'Código leído. Consultando el pedido…' })
    const res = await resolveOrderCodeAction(text)
    if (res.ok) {
      setMessage({ tone: 'success', text: 'Pedido encontrado. Abriendo detalle…' })
      await scanner.stop().catch(() => undefined)
      router.push(`/caja/pedido/${res.data!.id}`)
    } else {
      setState('paused')
      setMessage({ tone: 'error', text: res.error })
    }
  }

  async function start(deviceId = cameraId) {
    setMessage(null)
    setState('starting')
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
      scannerRef.current ??= new Html5Qrcode(READER_ID, { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false })
      const scanner = scannerRef.current
      if (scanner.isScanning) await scanner.stop()
      busyRef.current = false
      await scanner.start(
        deviceId ? deviceId : { facingMode: 'environment' },
        {
          fps: 10,
          aspectRatio: 1,
          qrbox: (w, h) => {
            const size = Math.max(160, Math.floor(Math.min(w, h) * 0.7))
            return { width: size, height: size }
          },
        },
        (text) => void handleDecoded(text),
        () => undefined,
      )
      setState('scanning')
      // Labels are only available once permission was granted.
      if (cameras.length === 0) {
        const list = await Html5Qrcode.getCameras().catch(() => [])
        setCameras(list)
        if (!deviceId) setCameraId(list.find((c) => REAR_CAMERA.test(c.label))?.id ?? '')
      }
    } catch (error) {
      setState('idle')
      setMessage({ tone: 'error', text: cameraErrorText(error) })
    }
  }

  async function stop() {
    const scanner = scannerRef.current
    if (scanner?.isScanning) await scanner.stop().catch(() => undefined)
    busyRef.current = false
    setState('idle')
    setMessage(null)
  }

  function resume() {
    const scanner = scannerRef.current
    if (!scanner?.isScanning) return void start()
    setMessage(null)
    busyRef.current = false
    try {
      scanner.resume()
      setState('scanning')
    } catch {
      void start()
    }
  }

  const running = state === 'scanning' || state === 'resolving' || state === 'paused'

  return (
    <div className="flex flex-col gap-4">
      {supported === false && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-warning/20 px-3 py-2 text-sm text-warning-foreground">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          La cámara solo funciona en una conexión segura (HTTPS) o en localhost. Usa el folio manual o abre CafeTEC con HTTPS.
        </p>
      )}

      <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-2xl border-4 border-primary/20 bg-foreground">
        {/* html5-qrcode renders the video and the scan-area frame in here; React must not manage its children. */}
        <div id={READER_ID} className="size-full [&_video]:!size-full [&_video]:object-cover" />
        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-background">
            {state === 'starting' ? (
              <span className="size-8 animate-spin rounded-full border-4 border-current border-t-transparent" aria-hidden="true" />
            ) : (
              <CameraOff className="size-10 opacity-70" aria-hidden="true" />
            )}
            <p className="text-sm opacity-80">{state === 'starting' ? 'Solicitando acceso a la cámara…' : 'Cámara apagada'}</p>
          </div>
        )}
        {state === 'scanning' && (
          <p className="pointer-events-none absolute inset-x-0 bottom-0 bg-foreground/70 px-3 py-2 text-center text-sm text-background">
            <ScanLine className="mr-1 inline size-4" aria-hidden="true" />
            Coloca el QR del pedido dentro del recuadro
          </p>
        )}
        {(state === 'resolving' || state === 'paused') && (
          <div className="absolute inset-0 flex items-center justify-center bg-foreground/60 p-6 text-center text-background">
            {state === 'resolving' ? (
              <span className="size-8 animate-spin rounded-full border-4 border-current border-t-transparent" aria-hidden="true" />
            ) : (
              <p className="text-sm font-medium">Escaneo en pausa</p>
            )}
          </div>
        )}
      </div>

      <div aria-live="polite">
        {message && (
          <p
            role={message.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'flex items-start gap-2 rounded-lg px-3 py-2 text-sm',
              message.tone === 'error' && 'bg-destructive/10 text-destructive',
              message.tone === 'success' && 'bg-success/10 text-success',
              message.tone === 'info' && 'bg-muted text-foreground',
            )}
          >
            {message.tone === 'error' ? (
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            )}
            {message.text}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {!running ? (
          <button
            type="button"
            onClick={() => void start()}
            disabled={state === 'starting' || supported === false}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Camera className="size-5" aria-hidden="true" />
            Iniciar escaneo
          </button>
        ) : (
          <>
            {state === 'paused' && (
              <button
                type="button"
                onClick={resume}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground hover:bg-primary/90"
              >
                <RefreshCw className="size-5" aria-hidden="true" />
                Escanear otro
              </button>
            )}
            <button
              type="button"
              onClick={() => void stop()}
              disabled={state === 'resolving'}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border bg-card px-4 py-3 font-medium hover:bg-muted disabled:opacity-50"
            >
              <CameraOff className="size-5" aria-hidden="true" />
              Detener
            </button>
          </>
        )}
      </div>

      {cameras.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="camera" className="text-sm font-medium">Cámara</label>
          <select
            id="camera"
            value={cameraId}
            disabled={state === 'starting' || state === 'resolving'}
            onChange={(e) => {
              setCameraId(e.target.value)
              if (running) void start(e.target.value)
            }}
            className={inputClass}
          >
            <option value="">Automática (trasera)</option>
            {cameras.map((c, i) => (
              <option key={c.id} value={c.id}>{c.label || `Cámara ${i + 1}`}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

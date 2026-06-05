import { useEffect, useRef, useState } from 'react';

interface QRScannerProps {
  onScan: (code: string) => void;
  onError: (message: string) => void;
}

const videoStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 320,
  height: 'auto',
  borderRadius: 4,
  backgroundColor: '#000',
};

const placeholderStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 320,
  height: 200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'var(--color-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: 4,
  color: 'var(--color-muted)',
  fontSize: '0.9rem',
};

export default function QRScanner({ onScan, onError }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'loading' | 'scanning' | 'error'>('loading');
  const [statusMessage, setStatusMessage] = useState('Kamera wird gestartet…');

  useEffect(() => {
    let mediaStream: MediaStream | null = null;
    let cancelled = false;

    async function startScanning() {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });

        if (cancelled) {
          mediaStream.getTracks().forEach(t => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          setStatus('scanning');
          setStatusMessage('Halte den QR-Code in die Kamera');
        }

        const { BrowserQRCodeReader } = await import('@zxing/browser');
        const codeReader = new BrowserQRCodeReader();
        const result = await codeReader.decodeOnceFromVideoDevice(undefined, videoRef.current!);
        const joinUrl = result.getText();

        mediaStream.getTracks().forEach(t => t.stop());

        if (!cancelled) {
          const match = joinUrl.match(/\/join\/([A-Z0-9]{6})$/i);
          if (match && match[1]) {
            onScan(match[1]);
          } else {
            setStatus('error');
            setStatusMessage('Kein gültiger Einladungscode erkannt.');
          }
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = (err as DOMException)?.name === 'NotAllowedError'
          ? 'Kamera-Berechtigung verweigert.'
          : (err as Error)?.message || 'Kamera konnte nicht gestartet werden.';
        setStatus('error');
        setStatusMessage(msg);
        onError(msg);
      }
    }

    startScanning();

    return () => {
      cancelled = true;
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [onScan, onError]);

  return (
    <div>
      <video ref={videoRef} style={status === 'scanning' ? videoStyle : { display: 'none' }} autoPlay playsInline muted />
      {status !== 'scanning' && (
        <div style={placeholderStyle}>
          {statusMessage}
        </div>
      )}
      {status === 'scanning' && (
        <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginTop: '0.5rem', textAlign: 'center' }}>
          {statusMessage}
        </p>
      )}
    </div>
  );
}

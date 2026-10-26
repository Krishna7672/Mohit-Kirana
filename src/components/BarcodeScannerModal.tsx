import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  X,
  Camera,
  AlertCircle,
  Barcode,
  Keyboard,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  title?: string;
  // Kept as optional for backwards compatibility
  onProductExtracted?: unknown;
  initialTab?: string;
  defaultGeminiApiKey?: string;
}

export const BarcodeScannerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Scan Product Barcode',
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');

  const barcodeScannerRef = useRef<Html5Qrcode | null>(null);
  const barcodeContainerId = 'mohit-kirana-qr-reader';

  // Sound beep on scan
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    } catch {
      // AudioContext muted or blocked
    }
  };

  const startScanner = async (facing: 'environment' | 'user' = 'environment') => {
    try {
      setErrorMsg(null);
      setIsScanning(true);
      await new Promise((r) => setTimeout(r, 150));

      // Clear any existing scanner instance
      if (barcodeScannerRef.current) {
        try {
          if (barcodeScannerRef.current.isScanning) {
            await barcodeScannerRef.current.stop();
          }
          barcodeScannerRef.current.clear();
        } catch {
          // ignore cleanup error
        }
      }

      const scanner = new Html5Qrcode(barcodeContainerId);
      barcodeScannerRef.current = scanner;

      await scanner.start(
        { facingMode: facing },
        {
          fps: 12,
          qrbox: { width: 280, height: 160 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          playBeep();
          stopScanner();
          onScanSuccess(decodedText.trim());
          onClose();
        },
        () => {}
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Camera permission denied or camera not available.';
      setErrorMsg(message);
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (barcodeScannerRef.current) {
      try {
        if (barcodeScannerRef.current.isScanning) {
          await barcodeScannerRef.current.stop();
        }
        barcodeScannerRef.current.clear();
      } catch (e) {
        console.error('Error stopping barcode scanner:', e);
      }
      barcodeScannerRef.current = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    if (isOpen) {
      setManualCode('');
      setErrorMsg(null);
      startScanner(cameraFacing);
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const handleToggleCamera = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    startScanner(nextFacing);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    playBeep();
    stopScanner();
    onScanSuccess(manualCode.trim());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col">
        {/* Modal Header */}
        <div className="p-4 px-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-kirana-800 to-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
              <Barcode className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                {title}
              </h3>
              <p className="text-[11px] text-kirana-200">
                Point camera at the barcode on product packet
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera Viewfinder */}
        <div className="p-4 space-y-4">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-4/3 flex items-center justify-center border-2 border-slate-700 shadow-inner">
            {/* The html5-qrcode target container */}
            <div id={barcodeContainerId} className="w-full h-full" />

            {/* Scanning Laser Line Guide */}
            {isScanning && !errorMsg && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="w-64 h-36 border-2 border-dashed border-emerald-400/80 rounded-xl relative shadow-lg">
                  <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-red-500/50 shadow-md animate-pulse top-1/2 -translate-y-1/2" />
                  <span className="absolute bottom-1.5 inset-x-0 text-center text-[10px] font-bold text-emerald-300 uppercase tracking-wider bg-black/50 mx-4 py-0.5 rounded">
                    Align Barcode Inside Box
                  </span>
                </div>
              </div>
            )}

            {/* Camera error message */}
            {errorMsg && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center text-rose-300 space-y-2">
                <AlertCircle className="w-8 h-8 text-rose-400" />
                <p className="text-xs font-semibold">{errorMsg}</p>
                <button
                  type="button"
                  onClick={() => startScanner(cameraFacing)}
                  className="mt-2 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all"
                >
                  Retry Camera
                </button>
              </div>
            )}

            {/* Camera Flip Button */}
            {!errorMsg && (
              <button
                type="button"
                onClick={handleToggleCamera}
                className="absolute top-2.5 right-2.5 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur transition-all"
                title="Switch Camera (Front/Back)"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Manual Barcode Input Fallback */}
          <div className="pt-1">
            <form onSubmit={handleManualSubmit} className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Keyboard className="w-3.5 h-3.5 text-slate-400" />
                <span>Or Enter Barcode Manually (हाथ से बारकोड डालें)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. 8901030012341 or SKU..."
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-kirana-500 text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={!manualCode.trim()}
                  className="px-4 py-2 bg-kirana-700 hover:bg-kirana-800 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-sm transition-all active:scale-95 flex items-center gap-1 shrink-0"
                >
                  <span>Submit</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between text-[11px] text-slate-400">
          <span>Supports EAN-13, UPC, Code-128, QR Codes</span>
          <button
            type="button"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

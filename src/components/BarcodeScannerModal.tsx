import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle, RefreshCw, Barcode } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

export const BarcodeScannerModal: React.FC<Props> = ({ isOpen, onClose, onScanSuccess }) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'mohit-kirana-qr-reader';

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    let isMounted = true;

    const startScanner = async () => {
      try {
        setErrorMsg(null);
        setIsScanning(true);

        // Give the DOM a tick to render the container div
        await new Promise((resolve) => setTimeout(resolve, 150));

        if (!isMounted) return;

        const scanner = new Html5Qrcode(scannerContainerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 260, height: 160 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (isMounted) {
              onScanSuccess(decodedText);
              stopScanner();
              onClose();
            }
          },
          () => {
            // scan failure callback ignored to avoid continuous error logs
          }
        );
      } catch (err: unknown) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Camera permission denied or camera not available.';
          setErrorMsg(message);
          setIsScanning(false);
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isOpen]);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.error('Error stopping scanner:', e);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScanSuccess(manualCode.trim());
      stopScanner();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-kirana-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-kirana-600 text-white rounded-lg">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Scan Barcode / QR</h3>
              <p className="text-xs text-slate-500">Point device camera at grocery item barcode</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex flex-col items-center">
          {/* Camera viewport container */}
          <div className="relative w-full aspect-video sm:aspect-square bg-slate-900 rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
            <div id={scannerContainerId} className="w-full h-full" />
            
            {/* Visual targeting frame overlay */}
            <div className="absolute inset-x-8 top-1/4 bottom-1/4 border-2 border-kirana-400 rounded-lg pointer-events-none opacity-80 flex items-center justify-center">
              <div className="w-full h-0.5 bg-red-500 animate-pulse" />
            </div>

            {isScanning && (
              <div className="absolute bottom-2 left-2 right-2 text-center text-xs text-white/80 bg-black/50 py-1 rounded backdrop-blur-sm">
                Hold still • Align barcode within the green frame
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2 w-full">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Camera Access Note:</p>
                <p>{errorMsg}</p>
                <p className="mt-1 text-[11px] text-amber-700">
                  Tip: You can type or paste the barcode or use an external USB barcode gun below.
                </p>
              </div>
            </div>
          )}

          {/* Manual Barcode / USB Scanner input */}
          <form onSubmit={handleManualSubmit} className="w-full mt-4">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Manual Barcode or USB Scanner Input:
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Barcode className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. 8901030012341"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-kirana-500"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="px-4 py-2 bg-kirana-700 hover:bg-kirana-800 disabled:opacity-50 text-white font-medium text-sm rounded-lg shadow-sm transition-colors"
              >
                Find
              </button>
            </div>
          </form>
        </div>

        <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

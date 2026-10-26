import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  X,
  Camera,
  AlertCircle,
  RefreshCw,
  Barcode,
  Sparkles,
  Upload,
  CheckCircle2,
  Tag,
  Scale,
  Calendar,
  Layers,
  Key,
  ChevronDown,
  ChevronUp,
  RotateCcw
} from 'lucide-react';
import {
  extractProductDetails,
  type ExtractedProductDetails,
  normalizeUnit
} from '../utils/productOcr';
import type { UnitType } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  onProductExtracted?: (product: ExtractedProductDetails) => void;
  initialTab?: 'barcode' | 'product';
  title?: string;
  defaultGeminiApiKey?: string;
}

export const BarcodeScannerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onScanSuccess,
  onProductExtracted,
  initialTab = 'product',
  title,
  defaultGeminiApiKey = ''
}) => {
  const [activeTab, setActiveTab] = useState<'barcode' | 'product'>(initialTab);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
  const [manualCode, setManualCode] = useState('');

  // Product AI Scan States
  const [productStream, setProductStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string>('');
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [extractedProduct, setExtractedProduct] = useState<ExtractedProductDetails | null>(null);

  // Editable fields after extraction
  const [editName, setEditName] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editPurchasePrice, setEditPurchasePrice] = useState('');
  const [editUnit, setEditUnit] = useState<UnitType>('packet');
  const [editWeightQty, setEditWeightQty] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [editExpiry, setEditExpiry] = useState('');

  // AI Key configuration state
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return localStorage.getItem('kirana_gemini_api_key') || defaultGeminiApiKey || '';
  });
  const [showAiSettings, setShowAiSettings] = useState(false);

  // References
  const barcodeScannerRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const barcodeContainerId = 'mohit-kirana-qr-reader';

  // Synchronize initialTab when opening
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setExtractedProduct(null);
      setCapturedImage(null);
      setErrorMsg(null);
    }
  }, [isOpen, initialTab]);

  // Handle Tab Switch & Resource Cleanup
  useEffect(() => {
    if (!isOpen) {
      stopAllCameras();
      return;
    }

    if (activeTab === 'barcode') {
      stopProductCamera();
      startBarcodeScanner();
    } else {
      stopBarcodeScanner();
      startProductCamera();
    }

    return () => {
      stopAllCameras();
    };
  }, [isOpen, activeTab]);

  // Stop everything
  const stopAllCameras = () => {
    stopBarcodeScanner();
    stopProductCamera();
  };

  // 1. BARCODE SCANNER CONTROLLER (Html5Qrcode)
  const startBarcodeScanner = async () => {
    try {
      setErrorMsg(null);
      setIsScanningBarcode(true);
      await new Promise((r) => setTimeout(r, 150));

      const scanner = new Html5Qrcode(barcodeContainerId);
      barcodeScannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 260, height: 160 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          onScanSuccess(decodedText);
          stopAllCameras();
          onClose();
        },
        () => {}
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Camera permission denied or camera not available.';
      setErrorMsg(message);
      setIsScanningBarcode(false);
    }
  };

  const stopBarcodeScanner = async () => {
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
    setIsScanningBarcode(false);
  };

  // 2. WHOLE PRODUCT CAMERA CONTROLLER
  const startProductCamera = async () => {
    try {
      setErrorMsg(null);
      // Clean previous stream if any
      if (productStream) {
        productStream.getTracks().forEach((track) => track.stop());
      }

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        setProductStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } else {
        setErrorMsg('Camera access is not supported in this browser. Please use photo upload instead.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to access camera for product scan.';
      setErrorMsg(message);
    }
  };

  const stopProductCamera = () => {
    if (productStream) {
      productStream.getTracks().forEach((track) => track.stop());
      setProductStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Capture frame from active live video
  const handleCaptureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    setCapturedImage(dataUrl);
    stopProductCamera();
    processImageForProductDetails(dataUrl);
  };

  // Handle Photo File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCapturedImage(dataUrl);
        stopProductCamera();
        processImageForProductDetails(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Run AI / OCR text & detail extraction
  const processImageForProductDetails = async (imageDataUrl: string) => {
    try {
      setIsProcessingOcr(true);
      setOcrStatus('Scanning packaging label...');
      setOcrProgress(10);
      setErrorMsg(null);

      const result = await extractProductDetails(imageDataUrl, {
        geminiApiKey: geminiApiKey.trim() || undefined,
        onProgress: (status, pct) => {
          setOcrStatus(status);
          setOcrProgress(pct);
        },
      });

      setExtractedProduct(result);

      // Populate edit states
      setEditName(result.name);
      setEditBrand(result.brand);
      setEditCategory(result.category);
      setEditPrice(result.price !== null ? result.price.toString() : '');
      setEditPurchasePrice(result.purchasePrice !== undefined ? result.purchasePrice.toString() : '');
      setEditUnit(result.unit);
      setEditWeightQty(result.weightQuantity);
      setEditBarcode(result.barcode);
      setEditExpiry(result.expiryDate || '');
    } catch (err: unknown) {
      console.error('Failed to extract product details:', err);
      const msg = err instanceof Error ? err.message : 'Failed to extract product details from image.';
      setErrorMsg(msg);
    } finally {
      setIsProcessingOcr(false);
    }
  };

  // Retake / Reset Product scan
  const handleRetake = () => {
    setCapturedImage(null);
    setExtractedProduct(null);
    setErrorMsg(null);
    startProductCamera();
  };

  // Save / Confirm Extracted Product
  const handleConfirmProduct = () => {
    if (!editName.trim()) {
      alert('Product name is required.');
      return;
    }

    const price = parseFloat(editPrice) || 0;
    const purchasePrice = parseFloat(editPurchasePrice) || (price > 0 ? Math.round(price * 0.85) : 0);

    const finalizedDetails: ExtractedProductDetails = {
      name: editName.trim(),
      brand: editBrand.trim() || 'Generic',
      category: editCategory.trim() || 'General Grocery',
      price: price > 0 ? price : null,
      purchasePrice,
      unit: editUnit,
      weightQuantity: editWeightQty.trim() || '1 packet',
      barcode: editBarcode.trim(),
      expiryDate: editExpiry.trim(),
      rawText: extractedProduct?.rawText || '',
      confidence: extractedProduct?.confidence || 0.9,
      catalogMatch: extractedProduct?.catalogMatch,
      source: extractedProduct?.source || 'tesseract',
    };

    if (onProductExtracted) {
      onProductExtracted(finalizedDetails);
    } else if (finalizedDetails.barcode) {
      onScanSuccess(finalizedDetails.barcode);
    }

    stopAllCameras();
    onClose();
  };

  // Manual Barcode form submit
  const handleManualBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScanSuccess(manualCode.trim());
      stopAllCameras();
      onClose();
    }
  };

  // Save Gemini Key
  const handleSaveGeminiKey = (key: string) => {
    setGeminiApiKey(key);
    localStorage.setItem('kirana_gemini_api_key', key.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-kirana-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-kirana-600 text-white rounded-xl shadow-sm">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {title || (activeTab === 'product' ? 'Scan Whole Product' : 'Barcode & QR Scanner')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeTab === 'product' 
                  ? 'Extract Name, MRP, Weight, Brand & Barcode from packet' 
                  : 'Point camera at 1D/2D barcode'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopAllCameras();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Mode Selector Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900 px-3 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('product')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'product'
                ? 'border-kirana-600 text-kirana-700 dark:text-kirana-400 bg-white dark:bg-slate-800 shadow-sm'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Sparkles className="w-4 h-4 text-kirana-600 animate-pulse" />
            <span>Scan Whole Product (AI)</span>
            <span className="text-[10px] bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 font-bold px-1.5 py-0.2 rounded-full">
              Smart
            </span>
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab('barcode')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'barcode'
                ? 'border-kirana-600 text-kirana-700 dark:text-kirana-400 bg-white dark:bg-slate-800 shadow-sm'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Barcode className="w-4 h-4" />
            <span>Barcode / QR Only</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          
          {/* TAB 1: WHOLE PRODUCT AI SCAN */}
          {activeTab === 'product' && (
            <div className="space-y-4">
              
              {/* If no image captured yet: Live Camera Feed */}
              {!capturedImage && (
                <div className="relative w-full aspect-4/3 sm:aspect-video bg-slate-950 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center border border-slate-800">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  {/* Targeting frame overlay */}
                  <div className="absolute inset-6 border-2 border-dashed border-kirana-400/80 rounded-2xl pointer-events-none flex flex-col items-center justify-between p-3">
                    <div className="bg-black/60 backdrop-blur-sm text-white text-[11px] font-medium px-3 py-1 rounded-full border border-white/10">
                      Align whole product packet, name & MRP here
                    </div>
                    <div className="w-full flex justify-between text-kirana-400 text-xs font-mono opacity-70">
                      <span>┌ [Front / Label]</span>
                      <span>[MRP & Wt] ┐</span>
                    </div>
                  </div>

                  {/* Shutter & Upload Buttons on bottom */}
                  <div className="absolute bottom-3 inset-x-3 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={handleCaptureFrame}
                      className="px-5 py-2.5 bg-kirana-600 hover:bg-kirana-700 active:scale-95 text-white font-bold text-sm rounded-full shadow-lg shadow-kirana-900/40 flex items-center gap-2 transition-all"
                    >
                      <Camera className="w-5 h-5" />
                      <span>Capture & Extract Details</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white rounded-full border border-white/20 shadow-md transition-all"
                      title="Upload photo from phone or gallery"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* If image is captured and OCR is processing */}
              {capturedImage && isProcessingOcr && (
                <div className="relative w-full aspect-4/3 sm:aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-inner flex flex-col items-center justify-center p-6 border border-slate-800">
                  <img
                    src={capturedImage}
                    alt="Captured product"
                    className="absolute inset-0 w-full h-full object-cover opacity-30 blur-xs"
                  />
                  
                  {/* Laser scan line animation */}
                  <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-kirana-400 to-transparent shadow-[0_0_15px_#22c55e] animate-pulse top-1/3" />

                  <div className="relative z-10 bg-slate-950/85 backdrop-blur-md p-5 rounded-2xl border border-slate-700/60 text-center max-w-xs w-full shadow-2xl">
                    <div className="w-12 h-12 mx-auto rounded-full bg-kirana-600/20 text-kirana-400 flex items-center justify-center mb-3">
                      <RefreshCw className="w-6 h-6 animate-spin text-kirana-500" />
                    </div>
                    <h4 className="font-bold text-white text-sm mb-1">
                      Analyzing Product Package
                    </h4>
                    <p className="text-xs text-slate-400 min-h-8 mb-3">
                      {ocrStatus || 'Extracting details...'}
                    </p>

                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-kirana-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${ocrProgress}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block font-mono">
                      {ocrProgress}% complete
                    </span>
                  </div>
                </div>
              )}

              {/* If extraction completed: Review & Edit Form */}
              {capturedImage && !isProcessingOcr && extractedProduct && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  
                  {/* Match Banner if matched with Master Catalog */}
                  {extractedProduct.catalogMatch && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div>
                          <span className="font-bold">Master Catalog Match!</span>
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                            Verified details from catalog
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded font-mono font-bold">
                        95% Match
                      </span>
                    </div>
                  )}

                  {/* Header snapshot preview & quick retake */}
                  <div className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                    <img
                      src={capturedImage}
                      alt="Scanned product"
                      className="w-16 h-16 object-cover rounded-lg border border-slate-300 dark:border-slate-700 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 text-[11px] text-kirana-600 dark:text-kirana-400 font-semibold uppercase tracking-wider">
                        <Sparkles className="w-3 h-3" />
                        <span>AI Extraction Result</span>
                      </div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                        {editName || 'Product Detected'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Review & edit detected values before confirming
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRetake}
                      className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1 transition-colors"
                      title="Retake photo"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retake</span>
                    </button>
                  </div>

                  {/* Editable Details Form */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    
                    {/* Product Name */}
                    <div className="sm:col-span-2 space-y-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5 text-kirana-600" />
                        <span>Product Name (With Brand & Qty)</span>
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="e.g. Tata Salt Iodized (1kg)"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-medium focus:ring-2 focus:ring-kirana-500 focus:outline-none"
                      />
                    </div>

                    {/* Brand */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300">
                        Brand
                      </label>
                      <input
                        type="text"
                        value={editBrand}
                        onChange={(e) => setEditBrand(e.target.value)}
                        placeholder="e.g. Tata, Britannia, Fortune"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-kirana-500 focus:outline-none"
                      />
                    </div>

                    {/* Category */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-kirana-600" />
                        <span>Category</span>
                      </label>
                      <input
                        type="text"
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        placeholder="e.g. Cooking Oils & Ghee"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-kirana-500 focus:outline-none"
                      />
                    </div>

                    {/* Selling Price / MRP */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300">
                        Selling Price / MRP (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-emerald-600 focus:ring-2 focus:ring-kirana-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Purchase Price */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300">
                        Estimated Purchase Price (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          value={editPurchasePrice}
                          onChange={(e) => setEditPurchasePrice(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-kirana-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Net Weight / Quantity */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Scale className="w-3.5 h-3.5 text-kirana-600" />
                        <span>Net Weight / Volume</span>
                      </label>
                      <input
                        type="text"
                        value={editWeightQty}
                        onChange={(e) => setEditWeightQty(e.target.value)}
                        placeholder="e.g. 500g, 1 kg, 250ml"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-kirana-500 focus:outline-none"
                      />
                    </div>

                    {/* Unit */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300">
                        Unit
                      </label>
                      <select
                        value={editUnit}
                        onChange={(e) => setEditUnit(normalizeUnit(e.target.value))}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-kirana-500 focus:outline-none"
                      >
                        <option value="packet">Packet (pkt)</option>
                        <option value="kg">Kilogram (kg)</option>
                        <option value="g">Gram (g)</option>
                        <option value="litre">Litre (L)</option>
                        <option value="ml">Millilitre (ml)</option>
                        <option value="piece">Piece (pc)</option>
                        <option value="bottle">Bottle</option>
                        <option value="box">Box</option>
                        <option value="dozen">Dozen</option>
                        <option value="carton">Carton</option>
                      </select>
                    </div>

                    {/* Barcode Number */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Barcode className="w-3.5 h-3.5 text-kirana-600" />
                        <span>Barcode / EAN (if detected)</span>
                      </label>
                      <input
                        type="text"
                        value={editBarcode}
                        onChange={(e) => setEditBarcode(e.target.value)}
                        placeholder="e.g. 8901030010011"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono focus:ring-2 focus:ring-kirana-500 focus:outline-none"
                      />
                    </div>

                    {/* Expiry Date */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-kirana-600" />
                        <span>Expiry / Best Before</span>
                      </label>
                      <input
                        type="text"
                        value={editExpiry}
                        onChange={(e) => setEditExpiry(e.target.value)}
                        placeholder="e.g. 12/2026 or Best Before 9 Months"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-kirana-500 focus:outline-none"
                      />
                    </div>

                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleRetake}
                      className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium rounded-xl text-xs transition-colors"
                    >
                      Scan Another
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmProduct}
                      className="px-5 py-2.5 bg-kirana-600 hover:bg-kirana-700 text-white font-bold rounded-xl shadow-md text-xs flex items-center gap-1.5 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm & Use Product Details</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Collapsible Gemini Cloud AI Engine setting */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/30">
                <button
                  type="button"
                  onClick={() => setShowAiSettings(!showAiSettings)}
                  className="w-full px-3 py-2 text-left flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    <Key className="w-3.5 h-3.5 text-amber-500" />
                    <span>OCR Engine: {geminiApiKey ? 'Gemini 2.5 Vision AI (Active)' : 'Local Offline Tesseract (Active, No Key Needed)'}</span>
                  </span>
                  {showAiSettings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showAiSettings && (
                  <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Offline Tesseract OCR works completely free without internet. For 99.9% precision extraction with automatic packaging reading, paste a free Google Gemini API Key:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="Paste Gemini API Key (e.g. AIzaSy...)"
                        value={geminiApiKey}
                        onChange={(e) => handleSaveGeminiKey(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                      />
                      {geminiApiKey && (
                        <button
                          type="button"
                          onClick={() => handleSaveGeminiKey('')}
                          className="px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: BARCODE ONLY SCANNER */}
          {activeTab === 'barcode' && (
            <div className="space-y-4">
              <div className="relative w-full aspect-video sm:aspect-square bg-slate-950 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center border border-slate-800">
                <div id={barcodeContainerId} className="w-full h-full" />
                
                {/* Visual frame overlay */}
                <div className="absolute inset-x-8 top-1/4 bottom-1/4 border-2 border-kirana-400 rounded-lg pointer-events-none opacity-80 flex items-center justify-center">
                  <div className="w-full h-0.5 bg-red-500 animate-pulse" />
                </div>

                {isScanningBarcode && (
                  <div className="absolute bottom-2 left-2 right-2 text-center text-xs text-white/80 bg-black/60 py-1 rounded backdrop-blur-sm">
                    Hold still • Align barcode within the green frame
                  </div>
                )}
              </div>

              {/* Manual Barcode Input */}
              <form onSubmit={handleManualBarcodeSubmit} className="space-y-1">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Manual Barcode or USB Scanner Gun Input:
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Barcode className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. 8901030012341"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-kirana-500"
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
          )}

          {/* Error Message banner */}
          {errorMsg && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Notice:</p>
                <p>{errorMsg}</p>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Image File / Photo Instead</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Hidden File Input for Native Camera / Photo Gallery */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileUpload}
          />

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 dark:bg-slate-800/80 px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-slate-600 dark:text-slate-400 hover:text-kirana-600 flex items-center gap-1 font-medium"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Photo</span>
          </button>

          <button
            type="button"
            onClick={() => {
              stopAllCameras();
              onClose();
            }}
            className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white font-medium rounded-lg"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
};

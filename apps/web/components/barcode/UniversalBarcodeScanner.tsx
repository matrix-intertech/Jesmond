"use client";

import { useState, useCallback } from "react";
import {
  Barcode,
  Camera,
  Keyboard,
  X,
  Plus,
  CheckCircle2,
  AlertCircle,
  Volume2,
  VolumeX,
  ExternalLink,
  Package,
  Layers,
  ArrowRight,
} from "lucide-react";
import CameraBarcodeScanner from "./CameraBarcodeScanner";
import HardwareBarcodeInput from "./HardwareBarcodeInput";
import { useBarcodeScanner, ScanMethod } from "@/hooks/useBarcodeScanner";
import { getAccessToken } from "@/utils/auth";
import { getApiUrl } from "@/utils/api";

export interface ScannedProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  sellingPrice: number;
  imageUrl?: string | null;
  isActive: boolean;
  category?: { id: string; name: string } | null;
  quantity: number;
  branchId?: string | null;
  outOfStock?: boolean;
}

export interface UniversalBarcodeScannerProps {
  branchId?: string;
  onProductFound?: (product: ScannedProduct, method: ScanMethod) => void;
  onRegisterProduct?: (barcode: string) => void;
  onClose?: () => void;
  isOpen?: boolean;
  title?: string;
  description?: string;
  mode?: "POS" | "INVENTORY" | "RECEIVING" | "ADJUSTMENT";
  className?: string;
}

export default function UniversalBarcodeScanner({
  branchId,
  onProductFound,
  onRegisterProduct,
  onClose,
  isOpen = true,
  title = "Universal Barcode Scanner",
  description = "Scan with device camera, USB/Bluetooth HID scanner, or enter barcode manually.",
  mode = "POS",
  className = "",
}: UniversalBarcodeScannerProps) {
  const [activeTab, setActiveTab] = useState<"CAMERA" | "HARDWARE">("HARDWARE");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scannedProduct, setScannedProduct] = useState<ScannedProduct | null>(null);
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);

  // Perform API lookup
  const handleBarcodeLookup = useCallback(
    async (barcode: string, method: ScanMethod) => {
      setLookupLoading(true);
      setNotFoundBarcode(null);
      setScannedProduct(null);
      setLookupMessage(null);

      const token = getAccessToken();
      try {
        const queryParams = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
        const res = await fetch(
          `${getApiUrl()}/api/v1/retail/catalog/barcode/${encodeURIComponent(barcode)}${queryParams}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );

        if (res.ok) {
          const data = await res.json();
          if (data.found && data.product) {
            setScannedProduct(data.product);
            setLookupMessage(`Found product: ${data.product.name}`);
            if (onProductFound) {
              onProductFound(data.product, method);
            }
          } else {
            setNotFoundBarcode(barcode);
            setLookupMessage(`No product found for barcode "${barcode}"`);
          }
        } else {
          setNotFoundBarcode(barcode);
          setLookupMessage(`Product not found (HTTP ${res.status})`);
        }
      } catch (err: any) {
        setNotFoundBarcode(barcode);
        setLookupMessage(err.message || "Failed to lookup barcode");
      } finally {
        setLookupLoading(false);
      }
    },
    [branchId, onProductFound]
  );

  const {
    scannerStatus,
    lastScannedBarcode,
    lastError,
    triggerManualScan,
    triggerCameraScan,
  } = useBarcodeScanner({
    onScan: handleBarcodeLookup,
    soundEnabled,
    enableGlobalKeyboardListener: isOpen,
  });

  if (!isOpen) return null;

  return (
    <div className={`flex flex-col bg-surface border border-border-strong rounded-2xl shadow-xl overflow-hidden ${className}`}>
      {/* Pinned Header */}
      <div className="shrink-0 px-5 py-4 border-b border-border-strong bg-surface flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-accent/10 text-accent rounded-xl">
            <Barcode size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-primary">{title}</h3>
            <p className="text-xs text-text-secondary hidden sm:block">{description}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className="p-1.5 text-text-secondary hover:text-primary rounded-lg hover:bg-surface-muted transition-colors"
            title={soundEnabled ? "Mute beep sound" : "Enable beep sound"}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>

          {/* Close Button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-text-secondary hover:text-primary rounded-lg hover:bg-surface-muted transition-colors"
              title="Close scanner"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Mode / Tabs Switcher */}
      <div className="shrink-0 px-5 pt-3 pb-2 bg-surface-muted/40 border-b border-border-subtle flex items-center justify-between gap-2">
        <div className="inline-flex rounded-xl bg-surface border border-border-strong p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab("HARDWARE")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === "HARDWARE"
                ? "bg-accent text-white shadow-xs"
                : "text-text-secondary hover:text-primary"
            }`}
          >
            <Keyboard size={14} />
            <span>Connected & Manual</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("CAMERA")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === "CAMERA"
                ? "bg-accent text-white shadow-xs"
                : "text-text-secondary hover:text-primary"
            }`}
          >
            <Camera size={14} />
            <span>Camera Scanner</span>
          </button>
        </div>

        <div className="text-[11px] font-mono text-text-muted hidden md:inline">
          {mode === "POS" ? "Mode: POS Direct Cart" : `Mode: ${mode}`}
        </div>
      </div>

      {/* Main Scanner Body */}
      <div className="p-5 flex flex-col gap-4">
        {activeTab === "CAMERA" ? (
          <CameraBarcodeScanner
            onScan={triggerCameraScan}
            isActive={isOpen && activeTab === "CAMERA"}
          />
        ) : (
          <HardwareBarcodeInput
            onScan={triggerManualScan}
            isLoading={lookupLoading}
            autoFocus
          />
        )}

        {/* Live Scanned Product Feedback */}
        {scannedProduct && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-3">
              {scannedProduct.imageUrl ? (
                <div className="w-12 h-12 rounded-lg bg-surface border border-border-strong overflow-hidden shrink-0">
                  <img
                    src={scannedProduct.imageUrl}
                    alt={scannedProduct.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-lg bg-surface border border-border-strong flex items-center justify-center shrink-0 text-text-muted">
                  <Package size={20} />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-primary">{scannedProduct.name}</h4>
                  <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded-full">
                    FOUND
                  </span>
                </div>
                <div className="text-xs text-text-secondary font-mono flex items-center gap-2 mt-0.5">
                  <span>SKU: {scannedProduct.sku}</span>
                  {scannedProduct.barcode && <span>• Barcode: {scannedProduct.barcode}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 self-end sm:self-center">
              <div className="text-right">
                <div className="text-sm font-bold text-primary">
                  ${(scannedProduct.sellingPrice / 100).toFixed(2)}
                </div>
                <div
                  className={`text-xs font-medium ${
                    scannedProduct.quantity <= 0 ? "text-rose-500" : "text-emerald-600"
                  }`}
                >
                  {scannedProduct.quantity > 0
                    ? `${scannedProduct.quantity} in stock`
                    : "Out of Stock"}
                </div>
              </div>

              {onProductFound && (
                <button
                  type="button"
                  onClick={() => onProductFound(scannedProduct, "MANUAL")}
                  className="px-3 py-1.5 bg-accent hover:bg-accent/90 text-white text-xs font-semibold rounded-lg flex items-center gap-1 shadow-xs transition-colors"
                >
                  <span>{mode === "POS" ? "Add to Cart" : "Select"}</span>
                  <ArrowRight size={13} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Not Found Feedback & Product Registration */}
        {notFoundBarcode && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 text-amber-500 rounded-lg">
                <AlertCircle size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-primary">Product Not Found</h4>
                <p className="text-xs text-text-secondary font-mono">
                  No catalog item matches barcode: <span className="font-bold text-primary">{notFoundBarcode}</span>
                </p>
              </div>
            </div>

            {onRegisterProduct && (
              <button
                type="button"
                onClick={() => onRegisterProduct(notFoundBarcode)}
                className="px-3.5 py-1.5 bg-accent text-white text-xs font-semibold rounded-xl hover:bg-accent/90 flex items-center gap-1.5 shadow-xs transition-all self-end sm:self-center"
              >
                <Plus size={14} />
                <span>Register New Product</span>
              </button>
            )}
          </div>
        )}

        {/* Error notification */}
        {lastError && !notFoundBarcode && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-500 flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{lastError}</span>
          </div>
        )}
      </div>
    </div>
  );
}

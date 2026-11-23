"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { normalizeBarcode, validateBarcode, playScanAudio } from "@/utils/barcode";

export type ScanMethod = "CAMERA" | "HARDWARE" | "MANUAL";
export type ScannerStatus =
  | "IDLE"
  | "READY_HARDWARE"
  | "SCANNING_CAMERA"
  | "PROCESSING"
  | "SUCCESS"
  | "NOT_FOUND"
  | "ERROR";

export interface UseBarcodeScannerOptions {
  onScan: (barcode: string, method: ScanMethod) => void | Promise<void>;
  duplicateScanDelayMs?: number;
  enableGlobalKeyboardListener?: boolean;
  hardwareScanThresholdMs?: number;
  minBarcodeLength?: number;
  soundEnabled?: boolean;
}

export function useBarcodeScanner({
  onScan,
  duplicateScanDelayMs = 500,
  enableGlobalKeyboardListener = true,
  hardwareScanThresholdMs = 50,
  minBarcodeLength = 3,
  soundEnabled = true,
}: UseBarcodeScannerOptions) {
  const [scannerStatus, setScannerStatus] = useState<ScannerStatus>("READY_HARDWARE");
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [scanMethod, setScanMethod] = useState<ScanMethod | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const lastScanTimestampRef = useRef<number>(0);
  const lastScannedBarcodeRef = useRef<string | null>(null);
  const isProcessingRef = useRef(false);

  // Buffer for global hardware keyboard emulation detection
  const hardwareBufferRef = useRef<string>("");
  const lastCharTimestampRef = useRef<number>(0);

  const processBarcode = useCallback(
    async (rawBarcode: string, method: ScanMethod) => {
      const normalized = normalizeBarcode(rawBarcode);
      const validation = validateBarcode(normalized);

      if (!validation.valid || normalized.length < minBarcodeLength) {
        setLastError(validation.error || `Barcode must be at least ${minBarcodeLength} characters`);
        setScannerStatus("ERROR");
        if (soundEnabled) playScanAudio("error");
        return;
      }

      const now = Date.now();
      // Throttle exact duplicate scans if within duplicateScanDelayMs
      if (
        normalized === lastScannedBarcodeRef.current &&
        now - lastScanTimestampRef.current < duplicateScanDelayMs
      ) {
        return;
      }

      lastScanTimestampRef.current = now;
      lastScannedBarcodeRef.current = normalized;
      setLastScannedBarcode(normalized);
      setScanMethod(method);
      setIsProcessing(true);
      isProcessingRef.current = true;
      setScannerStatus("PROCESSING");
      setLastError(null);

      try {
        await onScan(normalized, method);
        if (soundEnabled) playScanAudio("success");
        setScannerStatus("SUCCESS");
      } catch (err: any) {
        const msg = err?.message || "Failed to process barcode";
        setLastError(msg);
        setScannerStatus("ERROR");
        if (soundEnabled) playScanAudio("error");
      } finally {
        setIsProcessing(false);
        isProcessingRef.current = false;
      }
    },
    [onScan, duplicateScanDelayMs, minBarcodeLength, soundEnabled]
  );

  const triggerManualScan = useCallback(
    async (barcode: string) => {
      await processBarcode(barcode, "MANUAL");
    },
    [processBarcode]
  );

  const triggerCameraScan = useCallback(
    async (barcode: string) => {
      await processBarcode(barcode, "CAMERA");
    },
    [processBarcode]
  );

  // Global hardware scanner HID keyboard-emulation listener
  useEffect(() => {
    if (!enableGlobalKeyboardListener) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Never intercept ordinary typing in active text inputs, textareas, or contentEditable
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      // If user is focused on an input element other than dedicated data-barcode-scanner input,
      // allow standard user typing and do not intercept
      if (isInput && !target.hasAttribute("data-barcode-scanner")) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastCharTimestampRef.current;
      lastCharTimestampRef.current = now;

      // Enter key marks end of scan in standard barcode scanners
      if (e.key === "Enter") {
        if (hardwareBufferRef.current.length >= minBarcodeLength) {
          // If the buffer was filled with rapid keystrokes, it's a hardware scanner
          const scanned = hardwareBufferRef.current;
          hardwareBufferRef.current = "";
          e.preventDefault();
          e.stopPropagation();
          processBarcode(scanned, "HARDWARE");
        } else {
          hardwareBufferRef.current = "";
        }
        return;
      }

      // Ignore single modifier keys (Shift, Ctrl, Alt, Meta, Tab, Escape, etc.)
      if (e.key.length > 1) {
        if (e.key === "Escape") {
          hardwareBufferRef.current = "";
        }
        return;
      }

      // If elapsed time between characters is large, reset buffer (user typing manually)
      if (timeDiff > hardwareScanThresholdMs * 3 && hardwareBufferRef.current.length > 0) {
        hardwareBufferRef.current = "";
      }

      hardwareBufferRef.current += e.key;
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [enableGlobalKeyboardListener, hardwareScanThresholdMs, minBarcodeLength, processBarcode]);

  const resetStatus = useCallback(() => {
    setScannerStatus("READY_HARDWARE");
    setLastError(null);
  }, []);

  return {
    scannerStatus,
    setScannerStatus,
    lastScannedBarcode,
    lastError,
    scanMethod,
    isProcessing,
    triggerManualScan,
    triggerCameraScan,
    resetStatus,
  };
}

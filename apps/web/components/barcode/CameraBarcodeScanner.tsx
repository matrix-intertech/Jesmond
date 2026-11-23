"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  CameraOff,
  Flashlight,
  FlashlightOff,
  RotateCcw,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  X,
} from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { normalizeBarcode } from "@/utils/barcode";

interface CameraBarcodeScannerProps {
  onScan: (barcode: string) => void | Promise<void>;
  onClose?: () => void;
  isActive?: boolean;
  className?: string;
}

export default function CameraBarcodeScanner({
  onScan,
  onClose,
  isActive = true,
  className = "",
}: CameraBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [cameraState, setCameraState] = useState<
    "INIT" | "STARTING" | "SCANNING" | "PERMISSION_DENIED" | "UNAVAILABLE" | "ERROR"
  >("INIT");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [scannedFeedback, setScannedFeedback] = useState<string | null>(null);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setTorchOn(false);
    setHasTorch(false);
  }, []);

  // Handle successful detection
  const handleDetected = useCallback(
    (rawBarcode: string) => {
      const clean = normalizeBarcode(rawBarcode);
      if (!clean) return;

      setScannedFeedback(clean);
      onScan(clean);

      // Reset feedback flash
      setTimeout(() => {
        setScannedFeedback(null);
      }, 1200);
    },
    [onScan]
  );

  // Start video stream and attach detector
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraState("STARTING");
    setErrorMessage("");

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setCameraState("UNAVAILABLE");
      setErrorMessage("Camera access is not supported by this browser or protocol (requires HTTPS).");
      return;
    }

    try {
      // Prefer back/rear environment camera for barcode scanning
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // Check for torch capability
      const track = stream.getVideoTracks()[0];
      if (track && typeof (track as any).getCapabilities === "function") {
        const caps = (track as any).getCapabilities();
        if (caps && "torch" in caps) {
          setHasTorch(true);
        }
      }

      setCameraState("SCANNING");

      // Check if native BarcodeDetector is available
      const hasNativeDetector =
        typeof window !== "undefined" && "BarcodeDetector" in window;

      if (hasNativeDetector) {
        try {
          const supportedFormats = [
            "ean_13",
            "ean_8",
            "upc_a",
            "upc_e",
            "code_128",
            "code_39",
            "itf",
            "qr_code",
          ];
          const detector = new (window as any).BarcodeDetector({
            formats: supportedFormats,
          });

          let isDetecting = false;
          const scanLoop = async () => {
            if (!videoRef.current || !streamRef.current) return;

            if (
              videoRef.current.readyState >= 2 &&
              !isDetecting &&
              !videoRef.current.paused &&
              !videoRef.current.ended
            ) {
              isDetecting = true;
              try {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes && barcodes.length > 0) {
                  const code = barcodes[0].rawValue;
                  if (code) {
                    handleDetected(code);
                  }
                }
              } catch {
                // Frame detection exception - continue loop
              } finally {
                isDetecting = false;
              }
            }

            animationFrameRef.current = requestAnimationFrame(scanLoop);
          };

          animationFrameRef.current = requestAnimationFrame(scanLoop);
          return;
        } catch (detectorErr) {
          console.warn("Native BarcodeDetector initialization fallback to ZXing:", detectorErr);
        }
      }

      // Fallback: ZXing Browser Reader
      if (!zxingReaderRef.current) {
        zxingReaderRef.current = new BrowserMultiFormatReader();
      }

      const reader = zxingReaderRef.current;
      reader.decodeFromVideoElement(videoRef.current, (result) => {
        if (result) {
          handleDetected(result.getText());
        }
      });
    } catch (err: any) {
      stopCamera();
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraState("PERMISSION_DENIED");
        setErrorMessage(
          "Camera permission was denied. Please allow camera access in your browser settings to scan with camera."
        );
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCameraState("UNAVAILABLE");
        setErrorMessage("No video camera found on this device.");
      } else {
        setCameraState("ERROR");
        setErrorMessage(err.message || "Failed to initialize camera.");
      }
    }
  }, [handleDetected, stopCamera]);

  const toggleTorch = async () => {
    if (!streamRef.current || !hasTorch) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextTorch = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch (err) {
      console.warn("Failed to toggle torch:", err);
    }
  };

  useEffect(() => {
    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isActive, startCamera, stopCamera]);

  return (
    <div className={`relative flex flex-col items-center bg-black/90 rounded-2xl overflow-hidden shadow-xl ${className}`}>
      {/* Video Viewport Container */}
      <div className="relative w-full aspect-video sm:aspect-[4/3] max-h-[360px] bg-black flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            cameraState === "SCANNING" ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Loading Spinner */}
        {cameraState === "STARTING" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-white z-10">
            <Loader2 size={36} className="animate-spin text-accent" />
            <p className="text-sm font-medium">Starting camera...</p>
          </div>
        )}

        {/* Permission Denied View */}
        {cameraState === "PERMISSION_DENIED" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-black/85 text-white z-10">
            <div className="p-3 bg-rose-500/20 text-rose-400 rounded-full mb-3">
              <CameraOff size={32} />
            </div>
            <h4 className="text-base font-bold text-white mb-1">Camera Permission Blocked</h4>
            <p className="text-xs text-text-muted max-w-sm mb-4">{errorMessage}</p>
            <button
              onClick={startCamera}
              className="px-4 py-2 bg-accent hover:bg-accent/90 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-sm"
            >
              <RotateCcw size={14} />
              <span>Retry Permission</span>
            </button>
          </div>
        )}

        {/* Unavailable or Error View */}
        {(cameraState === "UNAVAILABLE" || cameraState === "ERROR") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-black/85 text-white z-10">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-full mb-3">
              <AlertTriangle size={32} />
            </div>
            <h4 className="text-base font-bold text-white mb-1">Camera Unavailable</h4>
            <p className="text-xs text-text-muted max-w-sm mb-4">{errorMessage}</p>
            <button
              onClick={startCamera}
              className="px-4 py-2 bg-surface border border-border-strong text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all hover:bg-surface-muted"
            >
              <RotateCcw size={14} />
              <span>Try Again</span>
            </button>
          </div>
        )}

        {/* Scanning Target Viewfinder Overlay */}
        {cameraState === "SCANNING" && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Darkened overlay borders */}
            <div className="relative w-64 h-44 sm:w-72 sm:h-48 border-2 border-white/60 rounded-xl overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-accent rounded-tl-sm"></div>
              <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-accent rounded-tr-sm"></div>
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-accent rounded-bl-sm"></div>
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-accent rounded-br-sm"></div>

              {/* Animated Laser Sweep Line */}
              <div className="absolute left-0 right-0 h-0.5 bg-rose-500 shadow-[0_0_8px_#f43f5e] animate-bounce"></div>

              {/* Scanned Flash Feedback */}
              {scannedFeedback && (
                <div className="absolute inset-0 bg-emerald-500/30 flex items-center justify-center backdrop-blur-xs transition-opacity">
                  <div className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-mono text-xs font-bold flex items-center gap-1.5 shadow-lg">
                    <CheckCircle2 size={16} />
                    <span>{scannedFeedback}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Top Controls Overlay */}
        <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
          {hasTorch && cameraState === "SCANNING" && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`p-2 rounded-full transition-colors ${
                torchOn
                  ? "bg-amber-400 text-slate-900 shadow-md"
                  : "bg-black/60 text-white hover:bg-black/80"
              }`}
              title={torchOn ? "Turn off torch" : "Turn on torch"}
            >
              {torchOn ? <Flashlight size={18} /> : <FlashlightOff size={18} />}
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors"
              title="Close camera"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="w-full px-4 py-2 bg-surface border-t border-border-strong flex items-center justify-between text-xs text-text-secondary">
        <div className="flex items-center gap-2">
          <Camera size={14} className="text-accent" />
          <span className="font-medium text-primary">Live Camera Scanning</span>
        </div>
        <span className="text-text-muted text-[11px]">Position barcode inside frame</span>
      </div>
    </div>
  );
}

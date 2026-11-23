"use client";

import { useState, useRef, useEffect } from "react";
import { Barcode, Search, X, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { normalizeBarcode } from "@/utils/barcode";

interface HardwareBarcodeInputProps {
  onScan: (barcode: string) => void | Promise<void>;
  isLoading?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  disabled?: boolean;
  showBadge?: boolean;
  dataTestId?: string;
}

export default function HardwareBarcodeInput({
  onScan,
  isLoading = false,
  placeholder = "Scan barcode with USB/Bluetooth scanner or type...",
  autoFocus = false,
  className = "",
  disabled = false,
  showBadge = true,
  dataTestId = "barcode-scanner-modal-input",
}: HardwareBarcodeInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = normalizeBarcode(value);
    if (!clean || isLoading || disabled) return;

    onScan(clean);
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={`relative flex flex-col gap-1.5 ${className}`}>
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <div className="absolute left-3.5 flex items-center pointer-events-none text-text-muted">
          {isLoading ? (
            <Loader2 size={18} className="animate-spin text-accent" />
          ) : (
            <Barcode size={18} className="text-primary/70" />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          data-barcode-scanner="true"
          data-testid={dataTestId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          placeholder={placeholder}
          className="w-full pl-10 pr-24 py-2.5 bg-surface border border-border-strong rounded-xl text-sm font-mono text-primary placeholder:text-text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={() => setValue("")}
              className="p-1 text-text-muted hover:text-primary rounded-lg transition-colors"
              title="Clear input"
            >
              <X size={16} />
            </button>
          )}

          <button
            type="submit"
            disabled={!value.trim() || isLoading || disabled}
            className="px-3 py-1 bg-accent text-white text-xs font-semibold rounded-lg hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 shadow-xs"
          >
            {isLoading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Search size={13} />
            )}
            <span>Lookup</span>
          </button>
        </div>
      </form>

      {showBadge && (
        <div className="flex items-center justify-between text-[11px] text-text-secondary px-1">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Scanner Ready (USB, Bluetooth, 2.4GHz HID)
          </span>
          <span className="text-text-muted hidden sm:inline">Press Enter after scan</span>
        </div>
      )}
    </div>
  );
}

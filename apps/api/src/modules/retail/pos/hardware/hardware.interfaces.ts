export interface PrinterStatus {
  online: boolean;
  paperLow: boolean;
  paperOut: boolean;
  coverOpen: boolean;
  error: boolean;
}

export interface ReceiptPrinter {
  connect(ipAddressOrPort: string): Promise<boolean>;
  disconnect(): Promise<boolean>;
  getStatus(): Promise<PrinterStatus>;
  printReceipt(content: string, options?: any): Promise<boolean>;
  printKitchenTicket(content: string, options?: any): Promise<boolean>;
  openCashDrawer(): Promise<boolean>;
}

export interface CashDrawer {
  open(): Promise<boolean>;
  isOpen(): Promise<boolean>;
}

export interface BarcodeScanner {
  connect(): Promise<boolean>;
  onScan(callback: (barcode: string) => void): void;
  disconnect(): Promise<boolean>;
}

export interface CustomerDisplay {
  connect(): Promise<boolean>;
  displayText(line1: string, line2?: string): Promise<boolean>;
  clear(): Promise<boolean>;
}

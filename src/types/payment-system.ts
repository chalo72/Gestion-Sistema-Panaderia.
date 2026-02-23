// Sistema de E-Wallet y Pagos Digitales
// Integración con múltiples métodos de pago

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'ewallet' | 'credit';

export interface EWallet {
  id: string;
  customerId: string;
  balance: number;
  currency: 'USD' | 'COP' | 'MXN' | 'PEN';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: string;
  transactionId: string;
  method: PaymentMethod;
  amount: number;
  currency: string;
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  
  // Detalles específicos por método
  paymentDetails: {
    cardLast4?: string; // Para tarjetas
    ewalletId?: string; // Para E-wallet
    transferReference?: string; // Para transferencias
    creditTerms?: number; // Días de crédito
  };
  
  // Auditoría
  processedBy: string; // User ID
  processedAt: Date;
  metadata?: Record<string, any>;
}

export interface CreditSale {
  id: string;
  customerId: string;
  saleId: string;
  amount: number;
  currency: string;
  dueDate: Date;
  status: 'pending' | 'partial' | 'paid';
  payments: Payment[];
  remainingBalance: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentProvider {
  id: string;
  name: string; // "Stripe", "MercadoPago", "PayPal", etc.
  isEnabled: boolean;
  apiKey?: string;
  webhookUrl?: string;
  supportedMethods: PaymentMethod[];
  feePercentage: number; // Comisión del proveedor
}

import { useState } from 'react';
import { CreditCard, Wallet, DollarSign, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { PaymentMethod } from '@/types/payment-system';

interface PaymentProcessorProps {
  totalAmount: number;
  currency?: string;
  onPaymentComplete: (method: PaymentMethod, amount: number) => Promise<void>;
  customerEWalletBalance?: number;
  allowCredit?: boolean;
}

export function PaymentProcessor({
  totalAmount,
  onPaymentComplete,
  customerEWalletBalance = 0,
  allowCredit = true,
}: PaymentProcessorProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePaymentMethod = async (method: PaymentMethod) => {
    setIsProcessing(true);
    try {
      await onPaymentComplete(method, totalAmount);
    } finally {
      setIsProcessing(false);
    }
  };

  const paymentMethods: { method: PaymentMethod; label: string; icon: React.ReactNode; color: string }[] = [
    { 
      method: 'cash', 
      label: 'Efectivo', 
      icon: <DollarSign size={24} />,
      color: 'from-green-500 to-emerald-600'
    },
    { 
      method: 'card', 
      label: 'Tarjeta', 
      icon: <CreditCard size={24} />,
      color: 'from-blue-500 to-blue-600'
    },
    { 
      method: 'ewallet', 
      label: 'E-Wallet', 
      icon: <Wallet size={24} />,
      color: 'from-purple-500 to-pink-600'
    },
    { 
      method: 'transfer', 
      label: 'Transferencia', 
      icon: <Send size={24} />,
      color: 'from-orange-500 to-orange-600'
    },
  ];

  return (
    <div className="w-full max-w-2xl">
      {/* Glassmorphism Card: Resumen */}
      <div className="backdrop-blur-xl bg-gradient-to-br from-white/50 to-white/30 dark:from-gray-900/50 dark:to-gray-800/30 border border-white/20 dark:border-gray-700/20 rounded-3xl p-8 mb-6 shadow-2xl">
        <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Procesar Pago
        </h2>

        {/* Monto Total */}
        <div className="bg-white/50 dark:bg-gray-800/50 rounded-2xl p-6 mb-6 border border-white/30 dark:border-gray-700/30 backdrop-blur">
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Monto Total</p>
          <div className="flex items-center gap-3">
            <p className="text-5xl font-bold text-gray-900 dark:text-white">
              {totalAmount.toFixed(2)}
            </p>
            <p className="text-2xl font-semibold text-gray-500 dark:text-gray-400">
              USD
            </p>
          </div>
        </div>

        {/* E-Wallet Balance (si aplica) */}
        {customerEWalletBalance > 0 && (
          <div className="bg-purple-500/10 dark:bg-purple-500/10 border border-purple-500/30 dark:border-purple-500/20 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                Saldo E-Wallet Disponible:
              </span>
              <span className="font-bold text-purple-700 dark:text-purple-300">
                {customerEWalletBalance.toFixed(2)} USD
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Glassmorphism Card: Métodos de Pago */}
      <div className="backdrop-blur-xl bg-gradient-to-br from-white/50 to-white/30 dark:from-gray-900/50 dark:to-gray-800/30 border border-white/20 dark:border-gray-700/20 rounded-3xl p-8 shadow-2xl">
        <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">
          Selecciona un Método de Pago
        </h3>

        {/* Grid de Métodos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {paymentMethods.map(({ method, label, icon, color }) => (
            <button
              key={method}
              onClick={() => setSelectedMethod(method)}
              className={cn(
                "relative group backdrop-blur-md rounded-2xl p-6 transition-all duration-300",
                "border border-white/20 dark:border-gray-700/20",
                "hover:shadow-xl hover:shadow-blue-500/20",
                selectedMethod === method
                  ? `bg-gradient-to-br ${color} text-white shadow-xl shadow-${color}-500/50`
                  : "bg-white/40 dark:bg-gray-800/40 hover:bg-white/60 dark:hover:bg-gray-800/60 text-gray-900 dark:text-white"
              )}
            >
              <div className="flex flex-col items-center gap-3">
                {icon}
                <span className="text-sm font-semibold">{label}</span>
              </div>

              {/* Efecto hover premium */}
              <div className={cn(
                "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity",
                `bg-gradient-to-br ${color} blur-xl -z-10`
              )} />
            </button>
          ))}
        </div>

        {/* Campos Adicionales según método */}
        {selectedMethod && (
          <div className="mb-8 space-y-4">
            {selectedMethod === 'card' && (
              <div className="bg-white/40 dark:bg-gray-800/40 backdrop-blur rounded-xl p-4 border border-white/20 dark:border-gray-700/20 space-y-3">
                <Input
                  placeholder="Número de Tarjeta"
                  className="bg-white/60 dark:bg-gray-900/60 border-white/20"
                  maxLength={19}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="MM/YY"
                    className="bg-white/60 dark:bg-gray-900/60 border-white/20"
                    maxLength={5}
                  />
                  <Input
                    placeholder="CVC"
                    className="bg-white/60 dark:bg-gray-900/60 border-white/20"
                    maxLength={3}
                  />
                </div>
              </div>
            )}

            {selectedMethod === 'ewallet' && (
              <div className="bg-white/40 dark:bg-gray-800/40 backdrop-blur rounded-xl p-4 border border-white/20 dark:border-gray-700/20">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Cobrar desde E-Wallet
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-purple-600 dark:text-purple-400">
                    {totalAmount.toFixed(2)} USD
                  </span>
                  {customerEWalletBalance >= totalAmount && (
                    <span className="text-xs bg-green-500/20 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">
                      ✓ Saldo suficiente
                    </span>
                  )}
                </div>
              </div>
            )}

            {selectedMethod === 'transfer' && (
              <div className="bg-white/40 dark:bg-gray-800/40 backdrop-blur rounded-xl p-4 border border-white/20 dark:border-gray-700/20">
                <Input
                  placeholder="Referencia de Transferencia"
                  className="bg-white/60 dark:bg-gray-900/60 border-white/20"
                />
              </div>
            )}
          </div>
        )}

        {/* Botón de Pagar */}
        <Button
          onClick={() => selectedMethod && handlePaymentMethod(selectedMethod)}
          disabled={!selectedMethod || isProcessing}
          className="w-full h-12 text-lg font-semibold mb-4"
        >
          {isProcessing ? 'Procesando...' : `Pagar ${totalAmount.toFixed(2)} USD`}
        </Button>

        {/* Crédito (si está habilitado) */}
        {allowCredit && (
          <button className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:underline">
            Comprar a Crédito
          </button>
        )}
      </div>
    </div>
  );
}

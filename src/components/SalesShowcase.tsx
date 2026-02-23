import { useState } from 'react';
import { useProductVariants } from '@/hooks/useProductVariants';
import { usePaymentSystem } from '@/hooks/usePaymentSystem';
import { ProductVariantEditor } from '@/components/ProductVariantEditor';
import { PaymentProcessor } from '@/components/PaymentProcessor';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Zap, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SalesShowcaseProps {
  productId: string;
  productName: string;
  basePrice: number;
}

/**
 * 🎯 SHOWCASE: Demostración Integrada de Variantes + Pagos
 * Muestra cómo Yimi features trabajan juntas en tu app Antigravity
 */
export function SalesShowcase({ productId, productName, basePrice }: SalesShowcaseProps) {
  const [tab, setTab] = useState<'variants' | 'sales'>('variants');
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<Array<{ sku: string; quantity: number }>>([]);

  // Hooks de negocio
  const variants = useProductVariants(productId);
  const payments = usePaymentSystem();

  // Calcular precio total
  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => {
      const variant = variants.getVariantBySku(item.sku);
      if (!variant) return sum;
      return sum + (basePrice + variant.price) * item.quantity;
    }, 0);
  };

  return (
    <div className="space-y-8">
      {/* Header Premium */}
      <div className="backdrop-blur-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-500/5 dark:to-purple-500/5 border border-blue-500/20 dark:border-purple-500/20 rounded-3xl p-8 shadow-lg">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white">
            <ShoppingCart size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {productName}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Gesión Avanzada con Variantes + Pagos Inteligentes
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {[
            { id: 'variants' as const, label: '✨ Variantes y Stock', icon: Zap },
            { id: 'sales' as const, label: '💳 Procesar Venta', icon: TrendingUp }
          ].map(({ id, label }) => (
            <Button
              key={id}
              onClick={() => setTab(id)}
              variant={tab === id ? 'default' : 'outline'}
              className={cn(
                'gap-2 transition-all',
                tab === id && 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
              )}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* CONTENT: Variantes */}
      {tab === 'variants' && (
        <div className="backdrop-blur-xl bg-white/50 dark:bg-gray-900/50 border border-white/20 dark:border-gray-700/20 rounded-3xl p-8 shadow-xl">
          <ProductVariantEditor
            variants={variants.variants}
            onAddVariant={(variant) => variants.addVariant(productId, variant)}
          />

          {/* Info Cards de Stock */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-4">
              <p className="text-sm text-green-700 dark:text-green-300 font-medium">Stock Total</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                {variants.variants.reduce((sum, v) => sum + v.stock, 0)} unidades
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-xl p-4">
              <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">Variantes Activas</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {variants.variants.filter(v => v.active).length}
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-xl p-4">
              <p className="text-sm text-orange-700 dark:text-orange-300 font-medium">Stock Bajo (&lt;5)</p>
              <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                {variants.variants.filter(v => v.stock > 0 && v.stock <= 5).length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CONTENT: Ventas */}
      {tab === 'sales' && (
        <div className="space-y-8">
          {/* Selector de Variantes */}
          <div className="backdrop-blur-xl bg-white/50 dark:bg-gray-900/50 border border-white/20 dark:border-gray-700/20 rounded-3xl p-8 shadow-xl">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
              Agregas Variantes al Carrito
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {variants.variants.map((variant) => (
                <div
                  key={variant.id}
                  className="cursor-pointer backdrop-blur-md bg-white/40 dark:bg-gray-800/40 hover:bg-white/60 dark:hover:bg-gray-700/40 border border-white/20 dark:border-gray-700/20 hover:border-blue-500/50 rounded-xl p-4 transition-all"
                  onClick={() => setSelectedVariant(variant.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-gray-100">{variant.value}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{variant.sku}</p>
                    </div>
                    <span className="text-xs font-semibold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                      {variant.type}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Precio:</p>
                      <p className="font-bold text-blue-600 dark:text-blue-400">
                        ${(basePrice + variant.price).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Stock:</p>
                      <p className={cn(
                        "font-bold",
                        variant.stock === 0 ? "text-red-500" : "text-green-500"
                      )}>
                        {variant.stock}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Procesador de Pagos */}
          <div className="flex justify-center">
            <PaymentProcessor
              totalAmount={calculateTotal()}
              currency="USD"
              customerEWalletBalance={1000} // Demo
              allowCredit={true}
              onPaymentComplete={async (method, amount) => {
                await payments.processPayment({
                  transactionId: `tx_${Date.now()}`,
                  method,
                  amount,
                  currency: 'USD',
                  status: 'success',
                  paymentDetails: {},
                  processedBy: 'user_123',
                });
                alert(`Pago de $${amount.toFixed(2)} procesado con ${method}`);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

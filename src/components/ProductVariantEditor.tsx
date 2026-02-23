import { useState } from 'react';
import type { ProductVariant, VariantType } from '@/types/product-variants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ImagePlus, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductVariantEditorProps {
  variants?: ProductVariant[];
  onAddVariant?: (variant: Omit<ProductVariant, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onVariantAdded?: () => void;
}

export function ProductVariantEditor({ 
  variants = [], 
  onAddVariant,
  onVariantAdded
}: ProductVariantEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Partial<ProductVariant>>({
    type: 'size' as VariantType,
    active: true,
  });

  const handleAddVariant = () => {
    if (!formData.value || !formData.sku || formData.price === undefined) {
      alert('Completa todos los campos requeridos');
      return;
    }

    if (onAddVariant) {
      onAddVariant({
        variantId: `${formData.type}-${formData.value}`,
        type: formData.type as VariantType,
        value: formData.value,
        sku: formData.sku,
        stock: formData.stock || 0,
        price: formData.price || 0,
        images: formData.images || [],
        active: formData.active !== false,
      });
    }

    setFormData({ type: 'size', active: true });
    setIsAdding(false);
    
    if (onVariantAdded) {
      onVariantAdded();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Variantes del Producto
        </h3>
        <Button
          onClick={() => setIsAdding(!isAdding)}
          size="sm"
          className="gap-2"
        >
          <Plus size={16} />
          Nueva Variante
        </Button>
      </div>

      {/* Glassmorphism Card: Formulario de Variante */}
      {isAdding && (
        <div className="backdrop-blur-md bg-white/40 dark:bg-gray-900/40 border border-white/20 dark:border-gray-700/20 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-shadow">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tipo de Variante */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tipo *
              </label>
              <Select 
                defaultValue={formData.type as string}
                onValueChange={(val) => setFormData(prev => ({ ...prev, type: val as VariantType }))}
              >
                <SelectTrigger className="bg-white/60 dark:bg-gray-800/60 backdrop-blur border-white/20 dark:border-gray-700/20">
                  <SelectValue placeholder="Selecciona tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="size">Talla</SelectItem>
                  <SelectItem value="color">Color</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                  <SelectItem value="bundle">Pack/Bundle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Valor de Variante */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Valor *
              </label>
              <Input
                placeholder="ej: M, Rojo, Pack 3x"
                value={formData.value || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                className="bg-white/60 dark:bg-gray-800/60 backdrop-blur border-white/20 dark:border-gray-700/20"
              />
            </div>

            {/* SKU */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                SKU *
              </label>
              <Input
                placeholder="ej: SHIRT-M"
                value={formData.sku || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                className="bg-white/60 dark:bg-gray-800/60 backdrop-blur border-white/20 dark:border-gray-700/20"
              />
            </div>

            {/* Precio Diferencial */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Precio Diferencial (+/-)
              </label>
              <Input
                type="number"
                placeholder="0"
                value={formData.price ?? 0}
                onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) }))}
                className="bg-white/60 dark:bg-gray-800/60 backdrop-blur border-white/20 dark:border-gray-700/20"
              />
            </div>

            {/* Stock */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Stock Inicial
              </label>
              <Input
                type="number"
                placeholder="0"
                value={formData.stock ?? 0}
                onChange={(e) => setFormData(prev => ({ ...prev, stock: parseInt(e.target.value) }))}
                className="bg-white/60 dark:bg-gray-800/60 backdrop-blur border-white/20 dark:border-gray-700/20"
              />
            </div>

            {/* Imágenes */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Imágenes
              </label>
              <Button
                variant="outline"
                type="button"
                className="w-full gap-2 bg-white/60 dark:bg-gray-800/60 backdrop-blur border-white/20 dark:border-gray-700/20"
              >
                <ImagePlus size={16} />
                Subir Imágenes
              </Button>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-2 mt-4">
            <Button onClick={handleAddVariant} className="flex-1">
              Agregar Variante
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsAdding(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Glassmorphism Cards: Variantes Existentes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {variants.map((variant) => (
          <div
            key={variant.id}
            className={cn(
              "backdrop-blur-md bg-white/40 dark:bg-gray-900/40 border border-white/20 dark:border-gray-700/20 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all",
              !variant.active && "opacity-50"
            )}
          >
            {/* Mini Preview de Imagen */}
            {variant.images.length > 0 && (
              <div className="mb-3 rounded-lg overflow-hidden w-full h-32">
                <img 
                  src={variant.images[0]} 
                  alt={variant.value}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Información */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                  {variant.type.toUpperCase()}
                </span>
                <span className="font-bold text-gray-900 dark:text-gray-100">
                  {variant.value}
                </span>
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <div>SKU: <code className="text-xs bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded">{variant.sku}</code></div>
                <div>Stock: <span className={cn(
                  "font-semibold",
                  variant.stock === 0 ? "text-red-500" : variant.stock <= 5 ? "text-orange-500" : "text-green-500"
                )}>{variant.stock}</span></div>
                {variant.price !== 0 && (
                  <div>Precio: <span className="font-semibold text-blue-600">
                    {variant.price > 0 ? '+' : ''}{variant.price}$
                  </span></div>
                )}
              </div>
            </div>

            {/* Acciones */}
            <div className="flex gap-2 mt-4">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 gap-1"
              >
                <Edit2 size={14} />
                Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled
                className="flex-1 gap-1 text-red-500 hover:text-red-600 hover:bg-red-500/10"
              >
                <Trash2 size={14} />
                Eliminar
              </Button>
            </div>
          </div>
        ))}
      </div>

      {variants.length === 0 && !isAdding && (
        <div className="text-center py-8 text-gray-500">
          <p>No hay variantes agregadas</p>
        </div>
      )}
    </div>
  );
}

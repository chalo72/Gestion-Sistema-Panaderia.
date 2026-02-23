import { useCallback, useMemo } from 'react';
import type { ProductVariant, ProductWithVariants, VariantStock } from '@/types/product-variants';

interface UseProductVariantsReturn {
  variants: ProductVariant[];
  variantStock: Map<string, VariantStock>;
  
  // Operaciones CRUD
  addVariant: (productId: string, variant: Omit<ProductVariant, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateVariant: (productId: string, variantId: string, updates: Partial<ProductVariant>) => Promise<void>;
  deleteVariant: (productId: string, variantId: string) => Promise<void>;
  
  // Búsqueda
  getVariantBySku: (sku: string) => ProductVariant | undefined;
  getVariantsByType: (variantType: string) => ProductVariant[];
  getVariantStockStatus: (sku: string) => 'low' | 'ok' | 'out' | 'unknown';
  
  // Stock
  updateVariantStock: (sku: string, quantity: number) => Promise<void>;
  getVariantStock: (sku: string) => number | null;
  
  // Batch operations
  bulkAddVariants: (productId: string, variants: Omit<ProductVariant, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<void>;
}

export function useProductVariants(productId: string, initialVariants: ProductVariant[] = []): UseProductVariantsReturn {
  const [variants, setVariants] = useState<ProductVariant[]>(initialVariants);
  const [variantStock, setVariantStock] = useState<Map<string, VariantStock>>(new Map());

  // 🔍 Búsqueda por SKU
  const getVariantBySku = useCallback((sku: string) => {
    return variants.find(v => v.sku === sku);
  }, [variants]);

  // 🔍 Buscar por tipo de variante
  const getVariantsByType = useCallback((variantType: string) => {
    return variants.filter(v => v.type === variantType);
  }, [variants]);

  // 📊 Estado del stock
  const getVariantStockStatus = useCallback((sku: string): 'low' | 'ok' | 'out' | 'unknown' => {
    const stock = variantStock.get(sku);
    if (!stock) return 'unknown';
    if (stock.quantity === 0) return 'out';
    if (stock.quantity <= 5) return 'low'; // Umbral configurable
    return 'ok';
  }, [variantStock]);

  // 📦 Obtener stock
  const getVariantStock = useCallback((sku: string): number | null => {
    return variantStock.get(sku)?.quantity ?? null;
  }, [variantStock]);

  // ➕ Agregar variante
  const addVariant = useCallback(async (pid: string, variantData: Omit<ProductVariant, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (pid !== productId) return;
    
    const newVariant: ProductVariant = {
      ...variantData,
      id: `var_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setVariants(prev => [...prev, newVariant]);
    
    // Registrar stock inicial
    setVariantStock(prev => new Map(prev).set(newVariant.sku, {
      variantId: newVariant.id,
      sku: newVariant.sku,
      quantity: newVariant.stock,
      lastMovement: new Date(),
    }));
  }, [productId]);

  // ✏️ Actualizar variante
  const updateVariant = useCallback(async (pid: string, variantId: string, updates: Partial<ProductVariant>) => {
    if (pid !== productId) return;
    
    setVariants(prev => prev.map(v => 
      v.id === variantId 
        ? { ...v, ...updates, updatedAt: new Date() }
        : v
    ));
  }, [productId]);

  // 🗑️ Eliminar variante
  const deleteVariant = useCallback(async (pid: string, variantId: string) => {
    if (pid !== productId) return;
    
    setVariants(prev => prev.filter(v => v.id !== variantId));
    
    // Remover stock asociado
    setVariantStock(prev => {
      const newMap = new Map(prev);
      const variant = variants.find(v => v.id === variantId);
      if (variant) newMap.delete(variant.sku);
      return newMap;
    });
  }, [productId, variants]);

  // 📦 Actualizar stock de variante
  const updateVariantStock = useCallback(async (sku: string, quantity: number) => {
    setVariantStock(prev => {
      const updated = new Map(prev);
      const existing = updated.get(sku);
      if (existing) {
        updated.set(sku, {
          ...existing,
          quantity,
          lastMovement: new Date(),
        });
      }
      return updated;
    });
  }, []);

  // 📦 Agregar múltiples variantes
  const bulkAddVariants = useCallback(async (pid: string, variantsList: Omit<ProductVariant, 'id' | 'createdAt' | 'updatedAt'>[]) => {
    if (pid !== productId) return;
    
    const newVariants = variantsList.map((v, idx) => ({
      ...v,
      id: `var_${Date.now()}_${idx}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    setVariants(prev => [...prev, ...newVariants]);

    // Registrar stocks
    const newStocks = new Map(variantStock);
    newVariants.forEach(v => {
      newStocks.set(v.sku, {
        variantId: v.id,
        sku: v.sku,
        quantity: v.stock,
        lastMovement: new Date(),
      });
    });
    setVariantStock(newStocks);
  }, [productId, variantStock]);

  return {
    variants,
    variantStock,
    addVariant,
    updateVariant,
    deleteVariant,
    getVariantBySku,
    getVariantsByType,
    getVariantStockStatus,
    updateVariantStock,
    getVariantStock,
    bulkAddVariants,
  };
}

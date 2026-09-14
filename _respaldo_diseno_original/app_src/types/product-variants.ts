// 🎯 Sistema de Variantes de Producto
// Inspirado en Yimi pero manteniendo tu arquitectura actual

export type VariantType = 'size' | 'color' | 'custom' | 'bundle';

export interface ProductVariant {
  id: string;
  variantId: string; // ej: "talla-L"
  type: VariantType;
  value: string; // ej: "L", "Rojo", "Pack 3x"
  sku: string; // Stock Keeping Unit único
  stock: number;
  price: number; // Precio diferencial (0 = mismo precio base)
  images: string[]; // Multifotos por variante
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductCategory {
  id: string;
  name: string; // "Camisetas"
  slug: string; // "camisetas"
  icon?: string;
  color?: string; // Para UI
}

export interface ProductSubcategory {
  id: string;
  categoryId: string;
  name: string; // "Camisetas Manga Corta"
  slug: string; // "camisetas-manga-corta"
  description?: string;
}

export interface ProductWithVariants {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  subcategoryId?: string;
  basePrice: number;
  baseStock: number;
  
  // 🆕 Multifotos
  images: string[]; // Array de URLs
  
  // 🆕 Variantes
  variants: ProductVariant[];
  variantTypes: VariantType[]; // "size", "color", etc
  
  // Existente
  suppliers: string[]; // IDs de proveedores
  createdAt: Date;
  updatedAt: Date;
}

export interface VariantStock {
  variantId: string;
  sku: string;
  quantity: number;
  lastMovement: Date;
}

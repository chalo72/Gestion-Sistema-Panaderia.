import { useState, useCallback, useMemo } from 'react';
import type { Category, Subcategory, CategoryHierarchy, CategoryStats } from '@/types/categories';

interface UseCategoriesReturn {
  categories: Category[];
  subcategories: Subcategory[];
  hierarchy: CategoryHierarchy[];
  stats: CategoryStats;
  
  // Operaciones CRUD - Categorías
  addCategory: (category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateCategory: (categoryId: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  
  // Operaciones CRUD - Subcategorías
  addSubcategory: (subcategory: Omit<Subcategory, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateSubcategory: (subcategoryId: string, updates: Partial<Subcategory>) => Promise<void>;
  deleteSubcategory: (subcategoryId: string) => Promise<void>;
  
  // Búsqueda y Filtrado
  getCategoryBySlug: (slug: string) => Category | undefined;
  getSubcategoriesByCategory: (categoryId: string) => Subcategory[];
  getSubcategoryBySlug: (slug: string) => Subcategory | undefined;
  
  // Orden y Reorganización
  reorderCategories: (categoryOrder: Array<{ id: string; displayOrder: number }>) => Promise<void>;
  reorderSubcategories: (categoryId: string, order: Array<{ id: string; displayOrder: number }>) => Promise<void>;
  
  // Activación/Desactivación
  toggleCategoryActive: (categoryId: string) => Promise<void>;
  toggleSubcategoryActive: (subcategoryId: string) => Promise<void>;
  
  // Estadísticas
  getCategoryStats: () => CategoryStats;
  getProductCountByCategory: (categoryId: string) => number;
  getProductCountBySubcategory: (subcategoryId: string) => number;
}

export function useCategories(
  initialCategories: Category[] = [],
  initialSubcategories: Subcategory[] = []
): UseCategoriesReturn {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [subcategories, setSubcategories] = useState<Subcategory[]>(initialSubcategories);

  // 📊 Generar jerarquía
  const hierarchy = useMemo<CategoryHierarchy[]>(() => {
    return categories.map(category => {
      const subs = subcategories.filter(s => s.categoryId === category.id);
      return {
        category,
        subcategories: subs,
        productCount: subs.length, // Simplificado: cantidad de subcategorías
        subcategoryProductCounts: subs.reduce((acc, sub) => {
          acc[sub.id] = 1; // Placeholder
          return acc;
        }, {} as Record<string, number>),
      };
    });
  }, [categories, subcategories]);

  // 📊 Estadísticas
  const stats = useMemo<CategoryStats>(() => {
    const categoriesWithProducts = new Set<string>();
    subcategories.forEach(sub => categoriesWithProducts.add(sub.categoryId));
    
    return {
      totalCategories: categories.length,
      totalSubcategories: subcategories.length,
      categoriesActive: categories.filter(c => c.isActive).length,
      subcategoriesActive: subcategories.filter(s => s.isActive).length,
      categoriesWithNoProducts: categories
        .filter(c => !categoriesWithProducts.has(c.id))
        .map(c => c.id),
    };
  }, [categories, subcategories]);

  // ➕ Agregar categoría
  const addCategory = useCallback(async (categoryData: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newCategory: Category = {
      ...categoryData,
      id: `cat_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setCategories(prev => [...prev, newCategory]);
  }, []);

  // ✏️ Actualizar categoría
  const updateCategory = useCallback(async (categoryId: string, updates: Partial<Category>) => {
    setCategories(prev => prev.map(c =>
      c.id === categoryId
        ? { ...c, ...updates, updatedAt: new Date() }
        : c
    ));
  }, []);

  // 🗑️ Eliminar categoría
  const deleteCategory = useCallback(async (categoryId: string) => {
    setCategories(prev => prev.filter(c => c.id !== categoryId));
    // También eliminar subcategorías asociadas
    setSubcategories(prev => prev.filter(s => s.categoryId !== categoryId));
  }, []);

  // ➕ Agregar subcategoría
  const addSubcategory = useCallback(async (subcategoryData: Omit<Subcategory, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newSubcategory: Subcategory = {
      ...subcategoryData,
      id: `subcat_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setSubcategories(prev => [...prev, newSubcategory]);
  }, []);

  // ✏️ Actualizar subcategoría
  const updateSubcategory = useCallback(async (subcategoryId: string, updates: Partial<Subcategory>) => {
    setSubcategories(prev => prev.map(s =>
      s.id === subcategoryId
        ? { ...s, ...updates, updatedAt: new Date() }
        : s
    ));
  }, []);

  // 🗑️ Eliminar subcategoría
  const deleteSubcategory = useCallback(async (subcategoryId: string) => {
    setSubcategories(prev => prev.filter(s => s.id !== subcategoryId));
  }, []);

  // 🔍 Buscar por slug
  const getCategoryBySlug = useCallback((slug: string) => {
    return categories.find(c => c.slug === slug);
  }, [categories]);

  // 🔍 Obtener subcategorías
  const getSubcategoriesByCategory = useCallback((categoryId: string) => {
    return subcategories.filter(s => s.categoryId === categoryId && s.isActive);
  }, [subcategories]);

  // 🔍 Buscar subcategoría por slug
  const getSubcategoryBySlug = useCallback((slug: string) => {
    return subcategories.find(s => s.slug === slug);
  }, [subcategories]);

  // 🔄 Reordenar categorías
  const reorderCategories = useCallback(async (categoryOrder: Array<{ id: string; displayOrder: number }>) => {
    setCategories(prev => {
      const updated = [...prev];
      categoryOrder.forEach(({ id, displayOrder }) => {
        const cat = updated.find(c => c.id === id);
        if (cat) cat.displayOrder = displayOrder;
      });
      return updated.sort((a, b) => a.displayOrder - b.displayOrder);
    });
  }, []);

  // 🔄 Reordenar subcategorías
  const reorderSubcategories = useCallback(async (categoryId: string, order: Array<{ id: string; displayOrder: number }>) => {
    setSubcategories(prev => {
      const updated = [...prev];
      order.forEach(({ id, displayOrder }) => {
        const sub = updated.find(s => s.id === id && s.categoryId === categoryId);
        if (sub) sub.displayOrder = displayOrder;
      });
      return updated.sort((a, b) => a.displayOrder - b.displayOrder);
    });
  }, []);

  // 🔘 Toggle categoría activa
  const toggleCategoryActive = useCallback(async (categoryId: string) => {
    setCategories(prev => prev.map(c =>
      c.id === categoryId
        ? { ...c, isActive: !c.isActive, updatedAt: new Date() }
        : c
    ));
  }, []);

  // 🔘 Toggle subcategoría activa
  const toggleSubcategoryActive = useCallback(async (subcategoryId: string) => {
    setSubcategories(prev => prev.map(s =>
      s.id === subcategoryId
        ? { ...s, isActive: !s.isActive, updatedAt: new Date() }
        : s
    ));
  }, []);

  // 📊 Obtener estadísticas
  const getCategoryStats = useCallback(() => stats, [stats]);

  // 📊 Contar productos por categoría
  const getProductCountByCategory = useCallback((categoryId: string) => {
    return subcategories.filter(s => s.categoryId === categoryId).length;
  }, [subcategories]);

  // 📊 Contar productos por subcategoría
  const getProductCountBySubcategory = useCallback((subcategoryId: string) => {
    return 1; // Placeholder: implementar con productos reales
  }, []);

  return {
    categories,
    subcategories,
    hierarchy,
    stats,
    addCategory,
    updateCategory,
    deleteCategory,
    addSubcategory,
    updateSubcategory,
    deleteSubcategory,
    getCategoryBySlug,
    getSubcategoriesByCategory,
    getSubcategoryBySlug,
    reorderCategories,
    reorderSubcategories,
    toggleCategoryActive,
    toggleSubcategoryActive,
    getCategoryStats,
    getProductCountByCategory,
    getProductCountBySubcategory,
  };
}

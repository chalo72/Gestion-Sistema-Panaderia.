// 🏗️ Sistema de Categorías y Subcategorías Dinámicas
// Organización jerárquica de productos tipo Yimi

export interface Category {
  id: string;
  name: string; // "Camisetas", "Pantalones", "Accesorios"
  slug: string; // "camisetas", "pantalones", "accesorios"
  description?: string;
  icon?: string; // emoji o URL
  color?: string; // Tailwind color: "blue", "purple", etc
  displayOrder: number; // Para ordenar en UI
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subcategory {
  id: string;
  categoryId: string; // FK a Category
  name: string; // "Camisetas Manga Corta", "Camisetas Manga Larga"
  slug: string; // "camisetas-manga-corta"
  description?: string;
  image?: string; // URL de imagen representativa
  displayOrder: number;
  isActive: boolean;
  parentSubcategoryId?: string; // Para subcategorías anidadas (opcional)
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryHierarchy {
  category: Category;
  subcategories: Subcategory[];
  productCount: number; // Total de productos en esta categoría
  subcategoryProductCounts: Record<string, number>; // Productos por subcategoría
}

export interface CategoryStats {
  totalCategories: number;
  totalSubcategories: number;
  categoriesActive: number;
  subcategoriesActive: number;
  categoriesWithNoProducts: string[]; // IDs de categorías vacías
}

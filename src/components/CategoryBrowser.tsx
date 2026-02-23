import { useState } from 'react';
import type { Category, Subcategory } from '@/types/categories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Edit2, Trash2, ChevronRight, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryBrowserProps {
  categories: Category[];
  subcategories: Subcategory[];
  selectedCategory?: string;
  onSelectCategory: (categoryId: string) => void;
  onSelectSubcategory?: (subcategoryId: string) => void;
  onAddCategory?: (category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onAddSubcategory?: (subcategory: Omit<Subcategory, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDeleteCategory?: (categoryId: string) => void;
  onDeleteSubcategory?: (subcategoryId: string) => void;
  isEditable?: boolean;
}

/**
 * 🏗️ CATEGORY BROWSER - Yimi Style
 * Navegador jerárquico de categorías y subcategorías con glassmorphism
 */
export function CategoryBrowser({
  categories,
  subcategories,
  selectedCategory,
  onSelectCategory,
  onSelectSubcategory,
  onAddCategory,
  onAddSubcategory,
  onDeleteCategory,
  onDeleteSubcategory,
  isEditable = false,
}: CategoryBrowserProps) {
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isAddingSubcategory, setIsAddingSubcategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(selectedCategory || null);

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;

    onAddCategory?.({
      name: newCategoryName,
      slug: newCategoryName.toLowerCase().replace(/\s+/g, '-'),
      displayOrder: categories.length + 1,
      isActive: true,
    });

    setNewCategoryName('');
    setIsAddingCategory(false);
  };

  const handleAddSubcategory = () => {
    if (!newSubcategoryName.trim() || !selectedCategory) return;

    onAddSubcategory?.({
      categoryId: selectedCategory,
      name: newSubcategoryName,
      slug: newSubcategoryName.toLowerCase().replace(/\s+/g, '-'),
      displayOrder: subcategories.filter(s => s.categoryId === selectedCategory).length + 1,
      isActive: true,
    });

    setNewSubcategoryName('');
    setIsAddingSubcategory(false);
  };

  const selectedCategoryObj = categories.find(c => c.id === selectedCategory);
  const categorySubs = subcategories.filter(s => s.categoryId === selectedCategory);

  const colorMap: Record<string, string> = {
    blue: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30 hover:from-blue-500/30 hover:to-cyan-500/30',
    green: 'from-green-500/20 to-emerald-500/20 border-green-500/30 hover:from-green-500/30 hover:to-emerald-500/30',
    purple: 'from-purple-500/20 to-pink-500/20 border-purple-500/30 hover:from-purple-500/30 hover:to-pink-500/30',
    orange: 'from-orange-500/20 to-amber-500/20 border-orange-500/30 hover:from-orange-500/30 hover:to-amber-500/30',
    red: 'from-red-500/20 to-rose-500/20 border-red-500/30 hover:from-red-500/30 hover:to-rose-500/30',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Sidebar: Categorías */}
      <div className="lg:col-span-1 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Categorías
          </h3>
          {isEditable && (
            <Button
              onClick={() => setIsAddingCategory(!isAddingCategory)}
              size="sm"
              className="gap-1"
            >
              <Plus size={16} />
            </Button>
          )}
        </div>

        {/* Formulario Agregar Categoría */}
        {isAddingCategory && (
          <div className="backdrop-blur-md bg-white/40 dark:bg-gray-800/40 border border-white/20 dark:border-gray-700/20 rounded-xl p-3 space-y-2">
            <Input
              placeholder="Nombre categoría"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="bg-white/60 dark:bg-gray-900/60 border-white/20"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleAddCategory}
                size="sm"
                className="flex-1"
              >
                Agregar
              </Button>
              <Button
                onClick={() => setIsAddingCategory(false)}
                variant="outline"
                size="sm"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Lista de Categorías */}
        <div className="space-y-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => {
                onSelectCategory(category.id);
                setExpandedCategory(expandedCategory === category.id ? null : category.id);
              }}
              className={cn(
                'w-full text-left backdrop-blur-md bg-white/40 dark:bg-gray-800/40',
                'border border-white/20 dark:border-gray-700/20 rounded-xl p-3',
                'transition-all duration-200 hover:shadow-lg',
                selectedCategory === category.id && 'ring-2 ring-blue-500 bg-white/60 dark:bg-gray-700/60',
                !category.isActive && 'opacity-50'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {category.icon} {category.name}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {subcategories.filter(s => s.categoryId === category.id).length} subcategorías
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {!category.isActive && <Lock size={14} />}
                  <ChevronRight
                    size={16}
                    className={cn(
                      'transition-transform',
                      expandedCategory === category.id && 'rotate-90'
                    )}
                  />
                </div>
              </div>

              {/* Acciones */}
              {isEditable && (
                <div className="mt-2 pt-2 border-t border-white/10 dark:border-gray-700/10 flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-xs gap-1"
                  >
                    <Edit2 size={12} />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-xs gap-1 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteCategory?.(category.id);
                    }}
                  >
                    <Trash2 size={12} />
                    Eliminar
                  </Button>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main: Subcategorías */}
      <div className="lg:col-span-2 space-y-4">
        {selectedCategoryObj ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {selectedCategoryObj.icon} {selectedCategoryObj.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedCategoryObj.description}
                </p>
              </div>
              {isEditable && (
                <Button
                  onClick={() => setIsAddingSubcategory(!isAddingSubcategory)}
                  size="sm"
                  className="gap-1"
                >
                  <Plus size={16} />
                  Nueva Subcategoría
                </Button>
              )}
            </div>

            {/* Formulario Agregar Subcategoría */}
            {isAddingSubcategory && (
              <div className="backdrop-blur-md bg-white/40 dark:bg-gray-800/40 border border-white/20 dark:border-gray-700/20 rounded-xl p-4 space-y-3">
                <Input
                  placeholder="Nombre subcategoría"
                  value={newSubcategoryName}
                  onChange={(e) => setNewSubcategoryName(e.target.value)}
                  className="bg-white/60 dark:bg-gray-900/60 border-white/20"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleAddSubcategory}
                    className="flex-1"
                  >
                    Agregar
                  </Button>
                  <Button
                    onClick={() => setIsAddingSubcategory(false)}
                    variant="outline"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* Grid de Subcategorías */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categorySubs.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">
                    No hay subcategorías. Crea una para empezar.
                  </p>
                </div>
              ) : (
                categorySubs.map((subcategory) => (
                  <button
                    key={subcategory.id}
                    onClick={() => onSelectSubcategory?.(subcategory.id)}
                    className={cn(
                      'backdrop-blur-md rounded-xl p-4 border transition-all duration-200',
                      'hover:shadow-lg text-left',
                      colorMap[selectedCategoryObj.color || 'blue'] || colorMap.blue,
                      !subcategory.isActive && 'opacity-50'
                    )}
                  >
                    {subcategory.image && (
                      <img
                        src={subcategory.image}
                        alt={subcategory.name}
                        className="w-full h-32 object-cover rounded-lg mb-3"
                      />
                    )}

                    <h4 className="font-bold text-gray-900 dark:text-white mb-1">
                      {subcategory.name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {subcategory.description}
                    </p>

                    {isEditable && (
                      <div className="mt-3 pt-3 border-t border-white/10 dark:border-gray-700/10 flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 text-xs gap-1"
                        >
                          <Edit2 size={12} />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 text-xs gap-1 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSubcategory?.(subcategory.id);
                          }}
                        >
                          <Trash2 size={12} />
                          Eliminar
                        </Button>
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="backdrop-blur-md bg-white/40 dark:bg-gray-800/40 border border-white/20 dark:border-gray-700/20 rounded-xl p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              Selecciona una categoría para ver sus subcategorías
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

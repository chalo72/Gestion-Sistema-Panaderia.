import React, { useState, useEffect, useCallback } from 'react';
import {
    Plus,
    ShoppingCart,
    Package,
    DollarSign,
    ChefHat,
    Zap,
    X,
    Search,
    LayoutDashboard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Modales Reutilizables
import { ProductFormModal } from '@/components/productos/ProductFormModal';
import { ExpenseFormModal } from '@/components/gastos/ExpenseFormModal';
import { PlanProduccionModal } from '@/components/produccion/PlanProduccionModal';

import type {
    Producto,
    Categoria,
    Proveedor,
    Gasto,
    Receta,
    InventarioItem,
    ViewType
} from '@/types';

interface GlobalActionSystemProps {
    onViewChange: (view: ViewType) => void;
    // Props para Productos
    categorias: Categoria[];
    proveedores: Proveedor[];
    onAddProducto: (producto: any) => Promise<void>;
    // Props para Gastos
    onAddGasto: (gasto: Omit<Gasto, 'id'>) => Promise<void>;
    // Props para Producción
    recetas: Receta[];
    inventario: InventarioItem[];
    productos: Producto[];
    onAddOrdenProduccion: (data: any) => Promise<any>;
    // Utils
    formatCurrency: (val: number) => string;
    usuarioId: string;
}

export function GlobalActionSystem(props: GlobalActionSystemProps) {
    const {
        onViewChange,
        categorias,
        proveedores,
        onAddProducto,
        onAddGasto,
        recetas,
        inventario,
        productos,
        onAddOrdenProduccion,
        formatCurrency,
        usuarioId
    } = props;

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeModal, setActiveModal] = useState<'producto' | 'gasto' | 'produccion' | null>(null);

    // Form states
    const [productFormData, setProductFormData] = useState({
        nombre: '',
        categoria: '',
        descripcion: '',
        precioVenta: '',
        margenUtilidad: '30',
        proveedorId: '',
        precioCosto: '',
        tipo: 'ingrediente' as const,
        imagen: ''
    });

    const [expenseFormData, setExpenseFormData] = useState<Partial<Gasto>>({
        descripcion: '',
        monto: 0,
        categoria: 'Otros',
        fecha: new Date().toISOString().split('T')[0],
        metodoPago: 'efectivo'
    });

    // Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') {
                e.preventDefault();
                setIsMenuOpen(prev => !prev);
            }
            if (e.key === 'Escape') {
                setIsMenuOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleAddProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await onAddProducto({
                ...productFormData,
                precioVenta: parseFloat(productFormData.precioVenta),
                margenUtilidad: parseFloat(productFormData.margenUtilidad),
                costoBase: parseFloat(productFormData.precioCosto || '0'),
                tipo: parseFloat(productFormData.precioVenta) > 0 ? 'elaborado' : 'ingrediente'
            });
            setActiveModal(null);
            setProductFormData({
                nombre: '', categoria: '', descripcion: '', precioVenta: '',
                margenUtilidad: '30', proveedorId: '', precioCosto: '', tipo: 'ingrediente', imagen: ''
            });
            toast.success('Producto creado globalmente');
        } catch (err) {
            toast.error('Error al crear producto');
        }
    };

    const handleAddExpense = async () => {
        try {
            await onAddGasto({
                descripcion: expenseFormData.descripcion!,
                monto: expenseFormData.monto!,
                categoria: expenseFormData.categoria!,
                fecha: expenseFormData.fecha || new Date().toISOString(),
                metodoPago: expenseFormData.metodoPago!,
                usuarioId: usuarioId,
                estado: 'pagado'
            });
            setActiveModal(null);
            setExpenseFormData({
                descripcion: '', monto: 0, categoria: 'Otros',
                fecha: new Date().toISOString().split('T')[0], metodoPago: 'efectivo'
            });
            toast.success('Gasto registrado globalmente');
        } catch (err) {
            toast.error('Error al registrar gasto');
        }
    };

    const actions = [
        {
            id: 'venta',
            label: 'Nueva Venta',
            icon: ShoppingCart,
            color: 'bg-pink-600',
            action: () => { onViewChange('ventas'); setIsMenuOpen(false); }
        },
        {
            id: 'producto',
            label: 'Nuevo Producto',
            icon: Package,
            color: 'bg-orange-600',
            action: () => { setActiveModal('producto'); setIsMenuOpen(false); }
        },
        {
            id: 'produccion',
            label: 'Lanzar Producción',
            icon: ChefHat,
            color: 'bg-indigo-600',
            action: () => { setActiveModal('produccion'); setIsMenuOpen(false); }
        },
        {
            id: 'gasto',
            label: 'Registrar Gasto',
            icon: DollarSign,
            color: 'bg-rose-600',
            action: () => { setActiveModal('gasto'); setIsMenuOpen(false); }
        },
        {
            id: 'dashboard',
            label: 'Dashboard',
            icon: LayoutDashboard,
            color: 'bg-blue-600',
            action: () => { onViewChange('dashboard'); setIsMenuOpen(false); }
        }
    ];

    return (
        <div className="fixed bottom-8 left-8 z-[100] flex flex-col items-start gap-4">
            {/* Action Menu Labels */}
            {isMenuOpen && (
                <div className="flex flex-col items-start gap-3 mb-2 animate-ag-slide-up">
                    {actions.map((act, i) => (
                        <div key={act.id} className="flex flex-row items-center gap-3 group">
                            <Button
                                size="icon"
                                onClick={act.action}
                                className={cn(
                                    "w-12 h-12 rounded-2xl shadow-2xl text-white transition-all hover:scale-110 active:scale-95 border-none",
                                    act.color
                                )}
                                style={{ animationDelay: `${i * 50}ms` }}
                            >
                                <act.icon className="w-5 h-5" />
                            </Button>
                            <span className="px-3 py-1 bg-white dark:bg-slate-900 shadow-xl rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                {act.label}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Main Toggle Button */}
            <Button
                size="icon"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={cn(
                    "w-16 h-16 rounded-[2rem] shadow-[0_20px_50px_rgba(79,70,229,0.3)] transition-all duration-500 border-none relative group",
                    isMenuOpen
                        ? "bg-slate-900 dark:bg-white text-white dark:text-black rotate-45"
                        : "bg-gradient-to-br from-indigo-600 via-blue-600 to-violet-600 text-white hover:scale-105"
                )}
            >
                {isMenuOpen ? <X className="w-8 h-8" /> : <Plus className="w-8 h-8" />}
                {!isMenuOpen && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-pink-500 rounded-full flex items-center justify-center animate-bounce shadow-lg">
                        <Zap className="w-3 h-3 text-white fill-white" />
                    </div>
                )}
            </Button>

            {/* Shortcut Hint */}
            {!isMenuOpen && (
                <div className="absolute top-1/2 -left-20 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden md:block">
                    <kbd className="px-2 py-1 bg-slate-900/10 dark:bg-white/10 backdrop-blur-md rounded text-[10px] font-bold">Ctrl+Q</kbd>
                </div>
            )}

            {/* Modales Globales */}
            <ProductFormModal
                isOpen={activeModal === 'producto'}
                onOpenChange={(open) => !open && setActiveModal(null)}
                editingProducto={null}
                categorias={categorias}
                proveedores={proveedores}
                formData={productFormData}
                setFormData={setProductFormData}
                onSubmit={handleAddProduct}
                formatCurrency={formatCurrency}
            />

            <ExpenseFormModal
                isOpen={activeModal === 'gasto'}
                onOpenChange={(open) => !open && setActiveModal(null)}
                formData={expenseFormData}
                setFormData={setExpenseFormData}
                onSubmit={handleAddExpense}
            />

            <PlanProduccionModal
                isOpen={activeModal === 'produccion'}
                onClose={() => setActiveModal(null)}
                productos={productos.filter(p => p.tipo === 'elaborado')}
                recetas={recetas}
                inventario={inventario}
                onConfirm={onAddOrdenProduccion}
            />
        </div>
    );
}

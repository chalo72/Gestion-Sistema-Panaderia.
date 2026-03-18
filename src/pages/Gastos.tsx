import { useState, useMemo } from 'react';
import {
    DollarSign,
    Plus,
    Camera,
    Loader2,
    X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Subcomponentes modulares
import { ExpenseHeader } from '@/components/gastos/ExpenseHeader';
import { ExpenseKPIs } from '@/components/gastos/ExpenseKPIs';
import { ExpenseList } from '@/components/gastos/ExpenseList';
import { ExpenseFormModal } from '@/components/gastos/ExpenseFormModal';

import type { Gasto, GastoCategoria, Proveedor, MetodoPago, Usuario, CajaSesion } from '@/types';

interface GastosProps {
    gastos: Gasto[];
    proveedores: Proveedor[];
    cajaActiva: CajaSesion | undefined;
    onAddGasto: (gasto: Omit<Gasto, 'id'>) => Promise<void>;
    onUpdateGasto: (id: string, updates: Partial<Gasto>) => Promise<void>;
    onDeleteGasto: (id: string) => Promise<void>;
    formatCurrency: (value: number) => string;
    usuario: Usuario;
}

export default function Gastos({
    gastos,
    proveedores,
    cajaActiva,
    onAddGasto,
    onUpdateGasto,
    onDeleteGasto,
    formatCurrency,
    usuario
}: GastosProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState<Partial<Gasto> | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [newGasto, setNewGasto] = useState<Partial<Gasto>>({
        descripcion: '',
        monto: 0,
        categoria: 'Otros',
        fecha: new Date().toISOString().split('T')[0],
        metodoPago: 'efectivo'
    });

    const gastosFiltrados = useMemo(() => {
        return gastos.filter(g => {
            const matchesSearch = g.descripcion.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategory || g.categoria === selectedCategory;
            return matchesSearch && matchesCategory;
        }).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    }, [gastos, searchTerm, selectedCategory]);

    const stats = useMemo(() => {
        const porCat: Record<string, number> = {};
        let total = 0;
        gastos.forEach(g => {
            porCat[g.categoria] = (porCat[g.categoria] || 0) + g.monto;
            total += g.monto;
        });
        return { total, porCat };
    }, [gastos]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        toast.info("Escaneando comprobante con IA Yimi...", {
            description: "Analizando descripción, montos y fechas."
        });

        // Simulación de OCR Premium
        setTimeout(() => {
            setScanResult({
                descripcion: 'COMPRA SUMINISTROS - HARINA Y AZÚCAR',
                monto: 125000,
                categoria: 'Materia Prima',
                fecha: new Date().toISOString().split('T')[0],
                proveedorId: proveedores[0]?.id || 'prov-gen'
            });
            setIsScanning(false);
            setShowAddModal(true);
            toast.success("Escaner completado con éxito");
        }, 2000);
    };

    const handleSaveGasto = async () => {
        const gastoActual = scanResult || newGasto;
        if (!gastoActual.descripcion || !gastoActual.monto) {
            toast.error('Completa los campos obligatorios');
            return;
        }

        try {
            setIsSaving(true);
            await onAddGasto({
                descripcion: gastoActual.descripcion!,
                monto: gastoActual.monto!,
                categoria: (gastoActual.categoria as GastoCategoria) || 'Otros',
                fecha: gastoActual.fecha || new Date().toISOString(),
                metodoPago: (gastoActual.metodoPago as MetodoPago) || 'efectivo',
                usuarioId: usuario.id,
                proveedorId: gastoActual.proveedorId,
                estado: 'pagado'
            });
            setShowAddModal(false);
            setScanResult(null);
            setNewGasto({
                descripcion: '',
                monto: 0,
                categoria: 'Otros',
                fecha: new Date().toISOString().split('T')[0],
                metodoPago: 'efectivo'
            });
            toast.success('Gasto registrado correctamente');
        } catch (error) {
            toast.error('Error al guardar el gasto');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-4 h-full flex flex-col animate-ag-fade-in p-2 md:p-6 bg-slate-50/50 dark:bg-black/20 rounded-[3rem]">
            <ExpenseHeader
                onAddManual={() => { setScanResult(null); setShowAddModal(true); }}
                onScanReceipt={() => document.getElementById('receipt-upload')?.click()}
            />

            <input
                id="receipt-upload"
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={handleFileUpload}
            />

            <ExpenseKPIs
                totalMensual={stats.total}
                gastosPorCategoria={stats.porCat}
                formatCurrency={formatCurrency}
            />

            <ExpenseList
                gastos={gastosFiltrados}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                onDeleteGasto={onDeleteGasto}
                formatCurrency={formatCurrency}
            />

            <ExpenseFormModal
                isOpen={showAddModal}
                onOpenChange={setShowAddModal}
                formData={scanResult || newGasto}
                setFormData={(data) => scanResult ? setScanResult(data) : setNewGasto(data)}
                onSubmit={handleSaveGasto}
                isScanning={!!scanResult}
                isSaving={isSaving}
            />
        </div>
    );
}


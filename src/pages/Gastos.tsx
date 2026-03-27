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
import { procesarImagenFactura, sugerirCategoria, matchProveedorEnCatalogo } from '@/lib/ocr-service';

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
        toast.info('Procesando comprobante con OCR real...', {
            description: 'Tesseract.js analizando imagen — puede tardar unos segundos.'
        });

        try {
            const resultado = await procesarImagenFactura(file, (progreso) => {
                if (progreso > 0) toast.loading(`OCR: ${progreso}%`, { id: 'ocr-progress' });
            });

            toast.dismiss('ocr-progress');

            if (resultado.errores.length > 0 && !resultado.total) {
                toast.warning('OCR no pudo leer todos los datos. Completa manualmente.');
            }

            // Matching forense de proveedor con Jaro-Winkler
            let proveedorMatch: typeof proveedores[0] | undefined;
            if (resultado.proveedor?.nombre) {
                const mProv = matchProveedorEnCatalogo(resultado.proveedor.nombre, proveedores, p => p.nombre, 0.52);
                if (mProv.indice >= 0) proveedorMatch = proveedores[mProv.indice];
            }

            // Sugerir categoría basada en los productos detectados
            const descripcionDetectada = resultado.productos.length > 0
                ? resultado.productos.map(p => p.nombre).join(', ')
                : resultado.texto.substring(0, 80);

            const categoriaDetectada = resultado.productos[0]
                ? sugerirCategoria(resultado.productos[0].nombre)
                : 'Otros';

            setScanResult({
                descripcion: descripcionDetectada || '',
                monto: resultado.total || 0,
                categoria: categoriaDetectada,
                fecha: resultado.fechaFactura || new Date().toISOString().split('T')[0],
                proveedorId: proveedorMatch?.id,
            });

            toast.success('OCR completado — revisa y confirma los datos');
        } catch (err) {
            toast.error('Error al procesar imagen. Ingresa los datos manualmente.');
        } finally {
            setIsScanning(false);
            setShowAddModal(true);
        }
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
        <div className="min-h-full flex flex-col gap-5 p-4 bg-slate-50 dark:bg-slate-950 animate-ag-fade-in">
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


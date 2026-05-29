import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';

import { ExpenseHeader }    from '@/components/gastos/ExpenseHeader';
import { ExpenseKPIs }      from '@/components/gastos/ExpenseKPIs';
import { ExpenseList }      from '@/components/gastos/ExpenseList';
import { ExpenseFormModal } from '@/components/gastos/ExpenseFormModal';
import { QuickEntryBar }    from '@/components/gastos/QuickEntryBar';

import type { Gasto, GastoCategoria, Proveedor, MetodoPago, Usuario, CajaSesion } from '@/types';
import { procesarImagenFactura, sugerirCategoria, matchProveedorEnCatalogo } from '@/lib/ocr-service';
import { getCompromisos } from '@/lib/finanzas-personales';

// ── Ingresos virtuales para el libro de caja ────────────────────────────────
// Los ingresos se persisten en localStorage para no alterar el tipo Gasto en DB
const INGRESOS_KEY = 'dulceplacer_ingresos_extra';

function cargarIngresos(): (Gasto & { esIngreso: true })[] {
    try {
        const raw = localStorage.getItem(INGRESOS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}
function guardarIngresos(lista: (Gasto & { esIngreso: true })[]) {
    try { localStorage.setItem(INGRESOS_KEY, JSON.stringify(lista)); } catch {}
}

// ── Props ─────────────────────────────────────────────────────────────────────
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

// ── Tipo extendido para el formulario ────────────────────────────────────────
type FormGasto = Partial<Gasto & { esIngreso?: boolean }>;

// ── Estado vacío del formulario ───────────────────────────────────────────────
const formVacio = (): FormGasto => ({
    descripcion: '',
    monto: 0,
    categoria: 'Otros',
    fecha: new Date().toISOString().split('T')[0],
    metodoPago: 'efectivo',
    esIngreso: false,
});

export default function Gastos({
    gastos,
    proveedores,
    onAddGasto,
    onUpdateGasto,
    onDeleteGasto,
    formatCurrency,
    usuario,
}: GastosProps) {
    // ── Estado UI ─────────────────────────────────────────────────────────────
    const [searchTerm,       setSearchTerm]       = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [isOnline,         setIsOnline]         = useState(navigator.onLine);
    const [showModal,        setShowModal]        = useState(false);
    const [isSaving,         setIsSaving]         = useState(false);
    const [isScanning,       setIsScanning]       = useState(false);
    const [formData,         setFormData]         = useState<FormGasto>(formVacio());
    const [editingId,        setEditingId]        = useState<string | null>(null);
    const [scanResult,       setScanResult]       = useState<FormGasto | null>(null);

    // ── Ingresos locales ──────────────────────────────────────────────────────
    const [ingresos, setIngresos] = useState<(Gasto & { esIngreso: true })[]>(cargarIngresos);

    // ── Compromisos de salario (pagos rápidos) ────────────────────────────────
    const salarioCompromisos = getCompromisos().filter(c => c.activo && c.esPropietario);

    // ── Detectar online/offline ───────────────────────────────────────────────
    useEffect(() => {
        const onOnline  = () => setIsOnline(true);
        const onOffline = () => setIsOnline(false);
        window.addEventListener('online',  onOnline);
        window.addEventListener('offline', onOffline);
        return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
    }, []);

    // ── Lista unificada (egresos + ingresos locales) ──────────────────────────
    const todosLosRegistros = useMemo(() => {
        const egresos = gastos.map(g => ({ ...g, esIngreso: false as const }));
        return [...egresos, ...ingresos];
    }, [gastos, ingresos]);

    // ── Filtrado ──────────────────────────────────────────────────────────────
    const registrosFiltrados = useMemo(() => {
        return todosLosRegistros.filter(r => {
            const matchSearch = r.descripcion.toLowerCase().includes(searchTerm.toLowerCase());
            const matchCat    = !selectedCategory || r.categoria === selectedCategory;
            return matchSearch && matchCat;
        }).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    }, [todosLosRegistros, searchTerm, selectedCategory]);

    // ── Stats del mes ─────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const mesActual  = new Date().toISOString().slice(0, 7);
        const mesAnterior = (() => {
            const d = new Date(); d.setMonth(d.getMonth() - 1);
            return d.toISOString().slice(0, 7);
        })();

        let totalEgresos = 0, totalIngresos = 0, totalEgresosAnt = 0;
        const porCat: Record<string, number> = {};

        todosLosRegistros.forEach(r => {
            const mes = (r.fecha || '').slice(0, 7);
            if (mes === mesActual) {
                if (r.esIngreso) {
                    totalIngresos += r.monto;
                } else {
                    totalEgresos += r.monto;
                    porCat[r.categoria] = (porCat[r.categoria] || 0) + r.monto;
                }
            } else if (mes === mesAnterior && !r.esIngreso) {
                totalEgresosAnt += r.monto;
            }
        });

        return { totalEgresos, totalIngresos, totalEgresosAnt, porCat };
    }, [todosLosRegistros]);

    // ── Abrir modal para nuevo gasto/ingreso ──────────────────────────────────
    const abrirNuevoGasto   = () => { setEditingId(null); setScanResult(null); setFormData(formVacio()); setShowModal(true); };
    const abrirNuevoIngreso = () => { setEditingId(null); setScanResult(null); setFormData({ ...formVacio(), esIngreso: true, categoria: 'Venta' as GastoCategoria }); setShowModal(true); };

    // ── Editar registro ───────────────────────────────────────────────────────
    const handleEditGasto = (g: Gasto & { esIngreso?: boolean }) => {
        setScanResult(null);
        setFormData({ ...g });
        setEditingId(g.id);
        setShowModal(true);
    };

    // ── Guardar (nuevo o edición) ─────────────────────────────────────────────
    const handleSave = async () => {
        const data = scanResult || formData;
        if (!data.descripcion?.trim() || !data.monto || data.monto <= 0) {
            toast.error('Ingresa la descripción y un monto válido');
            return;
        }

        setIsSaving(true);
        try {
            if (data.esIngreso) {
                // Ingresos: persisten en localStorage
                if (editingId) {
                    const actualizados = ingresos.map(i =>
                        i.id === editingId ? { ...i, ...data, esIngreso: true as const } : i
                    );
                    setIngresos(actualizados);
                    guardarIngresos(actualizados);
                } else {
                    const nuevoIngreso = {
                        id: `ing_${Date.now()}`,
                        descripcion: data.descripcion!,
                        monto: data.monto!,
                        categoria: (data.categoria as GastoCategoria) || 'Venta',
                        fecha: data.fecha || new Date().toISOString().split('T')[0],
                        metodoPago: (data.metodoPago as MetodoPago) || 'efectivo',
                        usuarioId: usuario.id,
                        estado: 'pagado' as const,
                        esIngreso: true as const,
                    };
                    const actualizados = [...ingresos, nuevoIngreso];
                    setIngresos(actualizados);
                    guardarIngresos(actualizados);
                }
            } else {
                // Egresos: van a la base de datos real
                if (editingId) {
                    await onUpdateGasto(editingId, {
                        descripcion: data.descripcion!,
                        monto: data.monto!,
                        categoria: (data.categoria as GastoCategoria) || 'Otros',
                        fecha: data.fecha || new Date().toISOString(),
                        metodoPago: (data.metodoPago as MetodoPago) || 'efectivo',
                        proveedorId: data.proveedorId,
                    });
                } else {
                    await onAddGasto({
                        descripcion: data.descripcion!,
                        monto: data.monto!,
                        categoria: (data.categoria as GastoCategoria) || 'Otros',
                        fecha: data.fecha || new Date().toISOString(),
                        metodoPago: (data.metodoPago as MetodoPago) || 'efectivo',
                        usuarioId: usuario.id,
                        proveedorId: data.proveedorId,
                        estado: 'pagado',
                    });
                }
            }

            setShowModal(false);
            setScanResult(null);
            setFormData(formVacio());
            setEditingId(null);
            toast.success(data.esIngreso ? 'Ingreso registrado ✓' : editingId ? 'Registro actualizado ✓' : 'Gasto registrado ✓');
        } catch {
            toast.error('Error al guardar. Intenta nuevamente.');
        } finally {
            setIsSaving(false);
        }
    };

    // ── Eliminar registro ─────────────────────────────────────────────────────
    const handleDelete = async (id: string) => {
        const esIngresoLocal = ingresos.some(i => i.id === id);
        if (esIngresoLocal) {
            const actualizados = ingresos.filter(i => i.id !== id);
            setIngresos(actualizados);
            guardarIngresos(actualizados);
            toast.success('Ingreso eliminado');
        } else {
            await onDeleteGasto(id);
        }
    };

    // ── Entrada rápida (QuickEntryBar) ────────────────────────────────────────
    const handleQuickSave = async (data: { descripcion: string; monto: number; categoria: GastoCategoria; metodoPago: MetodoPago; esIngreso: boolean }) => {
        if (data.esIngreso) {
            const nuevo = {
                id: `ing_${Date.now()}`,
                descripcion: data.descripcion,
                monto: data.monto,
                categoria: data.categoria,
                fecha: new Date().toISOString().split('T')[0],
                metodoPago: data.metodoPago,
                usuarioId: usuario.id,
                estado: 'pagado' as const,
                esIngreso: true as const,
            };
            const actualizados = [...ingresos, nuevo];
            setIngresos(actualizados);
            guardarIngresos(actualizados);
            toast.success('Ingreso rápido guardado ✓');
        } else {
            await onAddGasto({
                descripcion: data.descripcion,
                monto: data.monto,
                categoria: data.categoria,
                fecha: new Date().toISOString().split('T')[0],
                metodoPago: data.metodoPago,
                usuarioId: usuario.id,
                estado: 'pagado',
            });
            toast.success('Gasto rápido guardado ✓');
        }
    };

    // ── OCR / Escaneo ─────────────────────────────────────────────────────────
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        toast.info('Procesando comprobante con OCR...', { description: 'Puede tardar unos segundos.' });

        try {
            const resultado = await procesarImagenFactura(file, progreso => {
                if (progreso > 0) toast.loading(`OCR: ${progreso}%`, { id: 'ocr-progress' });
            });
            toast.dismiss('ocr-progress');

            if (resultado.errores.length > 0 && !resultado.total) {
                toast.warning('OCR incompleto. Completa los datos manualmente.');
            }

            let proveedorMatch: typeof proveedores[0] | undefined;
            if (resultado.proveedor?.nombre) {
                const m = matchProveedorEnCatalogo(resultado.proveedor.nombre, proveedores, p => p.nombre, 0.52);
                if (m.indice >= 0) proveedorMatch = proveedores[m.indice];
            }

            const descripcion = resultado.productos.length > 0
                ? resultado.productos.map(p => p.nombre).join(', ')
                : resultado.texto.substring(0, 80);
            const categoria = resultado.productos[0] ? sugerirCategoria(resultado.productos[0].nombre) : 'Otros';

            setScanResult({
                descripcion: descripcion || '',
                monto: resultado.total || 0,
                categoria,
                fecha: resultado.fechaFactura || new Date().toISOString().split('T')[0],
                proveedorId: proveedorMatch?.id,
                metodoPago: 'efectivo',
                esIngreso: false,
            });
            toast.success('OCR completado — revisa y confirma');
        } catch {
            toast.error('Error al procesar imagen. Ingresa los datos manualmente.');
        } finally {
            setIsScanning(false);
            setEditingId(null);
            setShowModal(true);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-full flex flex-col gap-5 p-4 pb-24 bg-slate-50 dark:bg-slate-950 animate-ag-fade-in">
            <ExpenseHeader
                onAddGasto={abrirNuevoGasto}
                onAddIngreso={abrirNuevoIngreso}
                onScanReceipt={() => document.getElementById('receipt-upload')?.click()}
                totalMensual={stats.totalEgresos}
                totalIngresos={stats.totalIngresos}
                formatCurrency={formatCurrency}
                isOnline={isOnline}
            />

            <input
                id="receipt-upload"
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={handleFileUpload}
            />

            {/* Pagos rápidos de nómina */}
            {salarioCompromisos.length > 0 && (
                <div className="flex flex-wrap gap-2 px-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground self-center">Pago rápido:</span>
                    {salarioCompromisos.map(c => (
                        <button
                            key={c.id}
                            onClick={() => {
                                setFormData({
                                    descripcion: `Salario quincena${c.persona ? ` — ${c.persona}` : ''}`,
                                    monto: c.monto,
                                    categoria: 'Nómina' as GastoCategoria,
                                    fecha: new Date().toISOString().split('T')[0],
                                    metodoPago: 'efectivo',
                                    esIngreso: false,
                                });
                                setScanResult(null);
                                setEditingId(null);
                                setShowModal(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-black hover:bg-amber-500/20 transition-all"
                        >
                            💰 {c.persona || c.nombre} — {formatCurrency(c.monto)}
                        </button>
                    ))}
                </div>
            )}

            <ExpenseKPIs
                totalMensual={stats.totalEgresos}
                totalIngresos={stats.totalIngresos}
                gastosPorCategoria={stats.porCat}
                promedioMesAnterior={stats.totalEgresosAnt}
                formatCurrency={formatCurrency}
                onFilterCategoria={setSelectedCategory}
                filtroActivo={selectedCategory}
            />

            <ExpenseList
                gastos={registrosFiltrados}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                onDeleteGasto={handleDelete}
                onEditGasto={handleEditGasto}
                formatCurrency={formatCurrency}
                proveedores={proveedores}
            />

            <ExpenseFormModal
                isOpen={showModal}
                onOpenChange={open => { if (!open) { setShowModal(false); setScanResult(null); setEditingId(null); } }}
                formData={scanResult || formData}
                setFormData={data => scanResult ? setScanResult(data) : setFormData(data)}
                onSubmit={handleSave}
                isScanning={!!scanResult && !editingId}
                isSaving={isSaving}
                isEditMode={!!editingId}
                proveedores={proveedores}
            />

            <QuickEntryBar onSave={handleQuickSave} />
        </div>
    );
}

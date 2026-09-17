/**
 * Modo Ayudante — pantalla de captura para poner al día datos atrasados.
 *
 * Pensada para un ayudante (vendedora, control financiero, etc.) al que
 * Gonzalo le activa el permiso "Captura Rápida (Atrasados)" desde
 * Configuración → Roles y Permisos. Esta pantalla SOLO muestra 3
 * formularios (Venta del Día, Producción/Libreta, Gasto), cada uno con
 * fecha editable para poner al día registros de días anteriores —
 * y NADA MÁS: no hay totales, saldos, ni cifras del negocio.
 *
 * Reutiliza componentes/formularios YA EXISTENTES y probados:
 *  - Producción/Libreta → <LibretaHornoForm> (mismo que usa el Panadero,
 *    ya aísla todo lo financiero mediante `modoLibretaHorno`).
 *  - Gasto → <GastoDiarioForm> (el mismo formulario de Reportes → Gastos).
 *  - Venta del Día → <VentaDiariaRapidaForm>, versión reducida creada
 *    para esta pantalla (mismo hook/lógica de guardado que Reportes).
 *
 * Creado 2026-09-17 (AUTORIZADO por Gonzalo) como parte del plan de
 * "Modo Ayudante" — ver CORE_MEMORY.md.
 */
import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, ShoppingCart, ChefHat, Receipt, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import type {
    Categoria,
    FormulacionBase,
    Gasto,
    ModeloPan,
    PrecioProveedor,
    Producto,
    Proveedor,
    ReporteFinanciero,
    CajaSesion,
    Venta,
} from '@/types';
import { LibretaHornoForm } from '@/components/produccion/libreta-horno-form';
import { GastoDiarioForm } from '@/components/gastos/gasto-diario-form';
import { VentaDiariaRapidaForm } from '@/components/modo-ayudante/venta-diaria-rapida-form';

interface ModoAyudanteProps {
    ventas: Venta[];
    gastos: Gasto[];
    productos?: Producto[];
    proveedores?: Proveedor[];
    precios?: PrecioProveedor[];
    cajaActiva?: CajaSesion;
    sesionesCaja?: CajaSesion[];
    formulaciones?: FormulacionBase[];
    modelosPan?: ModeloPan[];
    categorias?: Categoria[];
    formatCurrency: (value: number) => string;
    generarReporte: (periodo: string) => ReporteFinanciero;
    addGasto?: (gasto: Omit<Gasto, 'id'>) => Promise<void>;
    updateGasto?: (id: string, updates: Partial<Gasto>) => Promise<void>;
    deleteGasto?: (id: string) => Promise<void>;
}

const hoyLocalStr = (): string =>
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function Seccion({
    titulo,
    subtitulo,
    icono,
    colorClass,
    children,
    defaultAbierto = true,
}: {
    titulo: string;
    subtitulo: string;
    icono: ReactNode;
    colorClass: string;
    children: ReactNode;
    defaultAbierto?: boolean;
}) {
    const [abierto, setAbierto] = useState(defaultAbierto);
    return (
        <Card className="border-2">
            <CardHeader
                className="cursor-pointer select-none"
                onClick={() => setAbierto((v) => !v)}
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${colorClass}`}>
                            {icono}
                        </div>
                        <div className="min-w-0">
                            <CardTitle className="text-base font-black">{titulo}</CardTitle>
                            <CardDescription className="text-xs font-medium">{subtitulo}</CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 text-muted-foreground shrink-0">
                        {abierto ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                </div>
            </CardHeader>
            {abierto && <CardContent>{children}</CardContent>}
        </Card>
    );
}

export default function ModoAyudante({
    ventas,
    gastos,
    productos = [],
    proveedores = [],
    precios = [],
    cajaActiva,
    sesionesCaja = [],
    formulaciones = [],
    modelosPan = [],
    categorias = [],
    formatCurrency,
    generarReporte,
    addGasto,
    updateGasto,
}: ModoAyudanteProps) {
    const hoyStr = hoyLocalStr();

    const handleSaveGastoDiario = async (gastoData: any) => {
        if (gastoData.esIngreso) {
            toast.info('Los ingresos se registran en Ventas del Día. Esta barra es para gastos.');
            return;
        }
        if (!addGasto) {
            toast.error('No se pudo guardar el gasto');
            return;
        }
        const dataConFecha = {
            ...gastoData,
            fecha: gastoData.fecha || hoyStr,
        };
        await addGasto(dataConFecha);
        toast.success('Gasto guardado.');
    };

    return (
        <div className="max-w-3xl mx-auto space-y-4 pb-24">
            <Card className="border-2 border-sky-500/30 bg-sky-500/5">
                <CardContent className="pt-4 flex items-start gap-3">
                    <Info className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
                    <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-200 font-medium">
                        <p className="font-black uppercase tracking-wide text-sky-600 dark:text-sky-400 mb-1">
                            Captura Rápida (Atrasados)
                        </p>
                        <p>
                            Aquí solo puedes registrar Venta del Día, Producción y Gasto — eligiendo la fecha del
                            día que estás poniendo al día. No se muestran ventas totales, ganancias ni saldos del
                            negocio.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Seccion
                titulo="Venta del Día"
                subtitulo="Registra el cierre de un día atrasado (elige la fecha arriba)"
                icono={<ShoppingCart className="w-4.5 h-4.5 text-indigo-600" />}
                colorClass="bg-indigo-500/10"
            >
                <VentaDiariaRapidaForm
                    ventas={ventas}
                    gastos={gastos}
                    formatCurrency={formatCurrency}
                    generarReporte={generarReporte}
                    productos={productos}
                    categorias={categorias}
                    proveedores={proveedores}
                />
            </Seccion>

            <Seccion
                titulo="Producción / Libreta"
                subtitulo="Anota masas y panes de un día atrasado"
                icono={<ChefHat className="w-4.5 h-4.5 text-amber-600" />}
                colorClass="bg-amber-500/10"
            >
                <LibretaHornoForm
                    ventas={ventas}
                    productos={productos}
                    proveedores={proveedores}
                    formulaciones={formulaciones}
                    modelosPan={modelosPan}
                    formatCurrency={formatCurrency}
                    categorias={categorias}
                />
            </Seccion>

            <Seccion
                titulo="Gasto"
                subtitulo="Registra una factura o gasto de un día atrasado"
                icono={<Receipt className="w-4.5 h-4.5 text-rose-600" />}
                colorClass="bg-rose-500/10"
            >
                <GastoDiarioForm
                    onSave={handleSaveGastoDiario}
                    onUpdateGasto={async (id, updates) => {
                        if (updateGasto) {
                            await updateGasto(id, updates);
                            toast.success('Gasto actualizado ✓');
                        }
                    }}
                    onCambiarFecha={async (id, fecha) => {
                        if (updateGasto) {
                            await updateGasto(id, { fecha });
                            toast.success('Fecha actualizada ✓');
                        }
                    }}
                    onAnular={async (id, motivo) => {
                        if (updateGasto) {
                            const gastoAnterior = gastos.find((g) => g.id === id);
                            await updateGasto(id, {
                                estado: 'anulado',
                                descripcion: `[ANULADO: ${motivo}] ${gastoAnterior?.descripcion || ''}`,
                            });
                            toast.success('Gasto anulado ✓');
                        }
                    }}
                    proveedores={proveedores}
                    productos={productos}
                    precios={precios}
                    cajaActiva={cajaActiva}
                    sesionesCaja={sesionesCaja}
                    gastos={gastos}
                    hoyStr={hoyStr}
                    formatCurrency={formatCurrency}
                />
            </Seccion>
        </div>
    );
}

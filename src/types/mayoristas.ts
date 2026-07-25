import type { Producto, PrecioProveedor, Cliente } from './index';

export interface ClienteMayorista {
    id: string;
    nombre: string;
    tipo: 'mayorista' | 'detal' | 'trabajador';
    telefono?: string;
    margenPersonalizado?: number; // override del margen revendedor global
    notas?: string;
    creadoEn: string;
}

export type MetodoPago = 'efectivo' | 'nequi' | 'transferencia' | 'credito';

export interface Abono {
    id: string;
    monto: number;
    fecha: number;
    metodoPago: MetodoPago;
}

export interface TicketPendiente {
    id: string;
    clienteId: string;
    clienteNombre: string;
    items: { productoId: string; nombre: string; precio: number; cantidad: number }[];
    guardadoEn: number;
}

export interface HistorialMayorista {
    id: string;
    clienteId: string;
    clienteNombre: string;
    items: { productoId: string; nombre: string; precio: number; cantidad: number }[];
    total: number;
    fecha: number;
    fotoFactura?: string;
    metodoPago?: MetodoPago;
    abonos?: Abono[];
}

export interface MayoristasProps {
    productos: Producto[];
    precios: PrecioProveedor[];
    clientes: Cliente[];
    addCliente: (c: any) => Promise<any>;
    updateCliente: (id: string, updates: any) => Promise<void>;
    deleteCliente: (id: string) => Promise<void>;
    getMejorPrecio: (productoId: string) => PrecioProveedor | null;
    formatCurrency: (value: number) => string;
    onNavigateTo?: (view: string) => void;
    cajaActiva?: any;
    registrarVenta?: (v: any) => Promise<any>;
    creditosClientes?: any[];
    addCreditoCliente?: (c: any) => Promise<void>;
    updateCreditoCliente?: (id: string, updates: any) => Promise<void>;
    deleteCreditoCliente?: (id: string) => Promise<void>;
    registrarPagoCredito?: (id: string, pago: any) => Promise<void>;
}

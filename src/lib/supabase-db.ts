import { supabase } from './supabase';
import type {
    IDatabase,
    DBProducto,
    DBProveedor,
    DBPrecio,
    DBPrePedido,
    DBAlerta,
    DBConfiguracion,
    DBInventarioItem,
    DBMovimientoInventario,
    DBRecepcion,
    DBHistorialPrecio,
    DBVenta,
    DBCajaSesion
} from './database';

export class SupabaseDatabase implements IDatabase {

    async init(): Promise<void> {
        // No init needed for HTTP client
        return Promise.resolve();
    }

    // --- Productos ---
    async getAllProductos(): Promise<DBProducto[]> {
        const { data, error } = await supabase.from('productos').select('*');
        if (error) throw error;
        return data.map(this.mapProductoFromDB);
    }

    async addProducto(producto: DBProducto): Promise<void> {
        const dbProducto = this.mapProductoToDB(producto);
        const { error } = await supabase.from('productos').upsert(dbProducto);
        if (error) throw error;
    }

    async updateProducto(producto: DBProducto): Promise<void> {
        await this.addProducto(producto); // Reutilizamos upsert
    }

    async deleteProducto(id: string): Promise<void> {
        const { error } = await supabase.from('productos').delete().eq('id', id);
        if (error) throw error;
    }

    // --- Recetas ---
    async getAllRecetas(): Promise<any[]> {
        const { data, error } = await supabase.from('recetas').select('*');
        if (error) throw error;
        return data.map(r => ({
            id: r.id,
            productoId: r.producto_id,
            ingredientes: r.ingredientes || [],
            porcionesResultantes: r.porciones_resultantes,
            instrucciones: r.instrucciones,
            fechaActualizacion: r.fecha_actualizacion
        }));
    }

    async getRecetaByProducto(productoId: string): Promise<any | undefined> {
        const { data, error } = await supabase.from('recetas').select('*').eq('producto_id', productoId).maybeSingle();
        if (error) throw error;
        if (!data) return undefined;
        return {
            id: data.id,
            productoId: data.producto_id,
            ingredientes: data.ingredientes || [],
            porcionesResultantes: data.porciones_resultantes,
            instrucciones: data.instrucciones,
            fechaActualizacion: data.fecha_actualizacion
        };
    }

    async addReceta(receta: any): Promise<void> {
        const { error } = await supabase.from('recetas').upsert({
            id: receta.id,
            producto_id: receta.productoId,
            ingredientes: receta.ingredientes,
            porciones_resultantes: receta.porcionesResultantes,
            instrucciones: receta.instrucciones,
            fecha_actualizacion: receta.fechaActualizacion
        });
        if (error) throw error;
    }

    async updateReceta(receta: any): Promise<void> {
        await this.addReceta(receta);
    }

    async deleteReceta(id: string): Promise<void> {
        const { error } = await supabase.from('recetas').delete().eq('id', id);
        if (error) throw error;
    }

    // --- Proveedores ---
    async getAllProveedores(): Promise<DBProveedor[]> {
        const { data, error } = await supabase.from('proveedores').select('*');
        if (error) throw error;
        return data.map(p => ({
            id: p.id,
            nombre: p.nombre,
            contacto: p.contacto,
            telefono: p.telefono,
            email: p.email,
            direccion: p.direccion,
            createdAt: p.created_at
        }));
    }

    async addProveedor(proveedor: DBProveedor): Promise<void> {
        const { error } = await supabase.from('proveedores').upsert({
            id: proveedor.id,
            nombre: proveedor.nombre,
            contacto: proveedor.contacto,
            telefono: proveedor.telefono,
            email: proveedor.email,
            direccion: proveedor.direccion,
            created_at: proveedor.createdAt
        });
        if (error) throw error;
    }

    async updateProveedor(proveedor: DBProveedor): Promise<void> {
        await this.addProveedor(proveedor);
    }

    async deleteProveedor(id: string): Promise<void> {
        const { error } = await supabase.from('proveedores').delete().eq('id', id);
        if (error) throw error;
    }

    // --- Precios ---
    async getAllPrecios(): Promise<DBPrecio[]> {
        const { data, error } = await supabase.from('precios').select('*');
        if (error) throw error;
        return data.map(this.mapPrecioFromDB);
    }

    async getPreciosByProducto(productoId: string): Promise<DBPrecio[]> {
        const { data, error } = await supabase.from('precios').select('*').eq('producto_id', productoId);
        if (error) throw error;
        return data.map(this.mapPrecioFromDB);
    }

    async getPreciosByProveedor(proveedorId: string): Promise<DBPrecio[]> {
        const { data, error } = await supabase.from('precios').select('*').eq('proveedor_id', proveedorId);
        if (error) throw error;
        return data.map(this.mapPrecioFromDB);
    }

    async getPrecioByProductoProveedor(productoId: string, proveedorId: string): Promise<DBPrecio | undefined> {
        const { data, error } = await supabase.from('precios')
            .select('*')
            .eq('producto_id', productoId)
            .eq('proveedor_id', proveedorId)
            .maybeSingle();
        if (error) throw error;
        return data ? this.mapPrecioFromDB(data) : undefined;
    }

    async addPrecio(precio: DBPrecio): Promise<void> {
        const { error } = await supabase.from('precios').upsert(this.mapPrecioToDB(precio));
        if (error) throw error;
    }

    async updatePrecio(precio: DBPrecio): Promise<void> {
        await this.addPrecio(precio);
    }

    async deletePrecio(id: string): Promise<void> {
        const { error } = await supabase.from('precios').delete().eq('id', id);
        if (error) throw error;
    }

    // --- PrePedidos ---
    async getAllPrePedidos(): Promise<DBPrePedido[]> {
        const { data, error } = await supabase.from('prepedidos').select(`
            *,
            items:prepedido_items(*)
        `);
        if (error) throw error;

        return data.map((pp: any) => ({
            id: pp.id,
            nombre: pp.nombre,
            proveedorId: pp.proveedor_id,
            total: pp.total,
            presupuestoMaximo: pp.presupuesto_maximo,
            estado: pp.estado,
            notas: pp.notas,
            fechaCreacion: pp.fecha_creacion,
            fechaActualizacion: pp.fecha_actualizacion,
            items: (pp.items || []).map((i: any) => ({
                id: i.id,
                productoId: i.producto_id,
                proveedorId: pp.proveedor_id, // Inherit
                cantidad: i.cantidad,
                precioUnitario: i.precio_unitario,
                subtotal: i.subtotal
            }))
        }));
    }

    async addPrePedido(prepedido: DBPrePedido): Promise<void> {
        // Insert parent
        const { error: ppError } = await supabase.from('prepedidos').insert({
            id: prepedido.id,
            nombre: prepedido.nombre,
            proveedor_id: prepedido.proveedorId,
            total: prepedido.total,
            presupuesto_maximo: prepedido.presupuestoMaximo,
            estado: prepedido.estado,
            notas: prepedido.notas,
            fecha_creacion: prepedido.fechaCreacion,
            fecha_actualizacion: prepedido.fechaActualizacion
        });
        if (ppError) throw ppError;

        // Insert items
        if (prepedido.items.length > 0) {
            const items = prepedido.items.map(i => ({
                id: i.id,
                prepedido_id: prepedido.id,
                producto_id: i.productoId,
                cantidad: i.cantidad,
                precio_unitario: i.precioUnitario,
                subtotal: i.subtotal
            }));
            const { error: itemsError } = await supabase.from('prepedido_items').insert(items);
            if (itemsError) throw itemsError;
        }
    }

    async updatePrePedido(prepedido: DBPrePedido): Promise<void> {
        // Update parent
        const { error: ppError } = await supabase.from('prepedidos').update({
            nombre: prepedido.nombre,
            proveedor_id: prepedido.proveedorId,
            total: prepedido.total,
            presupuesto_maximo: prepedido.presupuestoMaximo,
            estado: prepedido.estado,
            notas: prepedido.notas,
            fecha_actualizacion: prepedido.fechaActualizacion
        }).eq('id', prepedido.id);
        if (ppError) throw ppError;

        // Replace items (Delete and Insert strategy for simplicity)
        const { error: delError } = await supabase.from('prepedido_items').delete().eq('prepedido_id', prepedido.id);
        if (delError) throw delError;

        if (prepedido.items.length > 0) {
            const items = prepedido.items.map(i => ({
                id: i.id, // Reuse ID if possible, or new ID if generated clientside. 
                // Note: DB generates UUID if null. If we pass existing ID, it's fine.
                prepedido_id: prepedido.id,
                producto_id: i.productoId,
                cantidad: i.cantidad,
                precio_unitario: i.precioUnitario,
                subtotal: i.subtotal
            }));
            const { error: itemsError } = await supabase.from('prepedido_items').insert(items);
            if (itemsError) throw itemsError;
        }
    }

    async deletePrePedido(id: string): Promise<void> {
        const { error } = await supabase.from('prepedidos').delete().eq('id', id);
        if (error) throw error;
    }

    // --- Alertas ---
    async getAllAlertas(): Promise<DBAlerta[]> {
        const { data, error } = await supabase.from('alertas').select('*');
        if (error) throw error;
        return data.map((a: any) => ({
            id: a.id,
            productoId: a.producto_id,
            proveedorId: a.proveedor_id,
            tipo: a.tipo,
            precioAnterior: a.precio_anterior,
            precioNuevo: a.precio_nuevo,
            diferencia: a.diferencia,
            porcentajeCambio: a.porcentaje_cambio,
            fecha: a.fecha,
            leida: a.leida
        }));
    }

    async addAlerta(alerta: DBAlerta): Promise<void> {
        const { error } = await supabase.from('alertas').insert({
            id: alerta.id,
            producto_id: alerta.productoId,
            proveedor_id: alerta.proveedorId,
            tipo: alerta.tipo,
            precio_anterior: alerta.precioAnterior,
            precio_nuevo: alerta.precioNuevo,
            diferencia: alerta.diferencia,
            porcentaje_cambio: alerta.porcentajeCambio,
            fecha: alerta.fecha,
            leida: alerta.leida
        });
        if (error) throw error;
    }

    async updateAlerta(alerta: DBAlerta): Promise<void> {
        const { error } = await supabase.from('alertas').update({
            leida: alerta.leida
        }).eq('id', alerta.id);
        if (error) throw error;
    }

    async deleteAlerta(id: string): Promise<void> {
        const { error } = await supabase.from('alertas').delete().eq('id', id);
        if (error) throw error;
    }

    async clearAllAlertas(): Promise<void> {
        const { error } = await supabase.from('alertas').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Hack to delete all
        if (error) throw error;
    }

    // --- Configuración ---
    async getConfiguracion(): Promise<DBConfiguracion | undefined> {
        const { data, error } = await supabase.from('configuracion').select('*').eq('id', 'main').maybeSingle();
        if (error) throw error;
        if (!data) return undefined;
        return {
            id: data.id,
            nombreNegocio: data.nombre_negocio,
            direccionNegocio: data.direccion_negocio,
            telefonoNegocio: data.telefono_negocio,
            emailNegocio: data.email_negocio,
            moneda: data.moneda,
            margenUtilidadDefault: data.margen_utilidad_default,
            impuestoPorcentaje: data.impuesto_porcentaje || 0,
            umbralAlerta: data.umbral_alerta || 5,
            ajusteAutomatico: data.ajuste_automatico,
            notificarSubidas: data.notificar_subidas,
            mostrarUtilidadEnLista: data.mostrar_utilidad_en_lista ?? true,
            categorias: data.categorias || []
        };
    }

    async saveConfiguracion(config: DBConfiguracion): Promise<void> {
        const dbConfig = {
            id: 'main',
            nombre_negocio: config.nombreNegocio,
            direccion_negocio: config.direccionNegocio,
            telefono_negocio: config.telefonoNegocio,
            email_negocio: config.emailNegocio,
            moneda: config.moneda,
            margen_utilidad_default: config.margenUtilidadDefault,
            impuesto_porcentaje: config.impuestoPorcentaje,
            umbral_alerta: config.umbralAlerta,
            ajuste_automatico: config.ajusteAutomatico,
            notificar_subidas: config.notificarSubidas,
            mostrar_utilidad_en_lista: config.mostrarUtilidadEnLista,
            categorias: config.categorias
        };
        const { error } = await supabase.from('configuracion').upsert(dbConfig);
        if (error) throw error;
    }


    // --- Inventario ---
    async getAllInventario(): Promise<DBInventarioItem[]> {
        const { data, error } = await supabase.from('inventario').select('*');
        if (error) throw error;
        return data.map((i: any) => ({
            id: i.id,
            productoId: i.producto_id,
            stockActual: i.stock_actual,
            stockMinimo: i.stock_minimo,
            ubicacion: i.ubicacion,
            ultimoMovimiento: i.ultimo_movimiento
        }));
    }

    async getInventarioItemByProducto(productoId: string): Promise<DBInventarioItem | undefined> {
        const { data, error } = await supabase.from('inventario').select('*').eq('producto_id', productoId).maybeSingle();
        if (error) throw error;
        if (!data) return undefined;
        return {
            id: data.id,
            productoId: data.producto_id,
            stockActual: data.stock_actual,
            stockMinimo: data.stock_minimo,
            ubicacion: data.ubicacion,
            ultimoMovimiento: data.ultimo_movimiento
        };
    }

    async updateInventarioItem(item: DBInventarioItem): Promise<void> {
        const { error } = await supabase.from('inventario').upsert({
            id: item.id,
            producto_id: item.productoId,
            stock_actual: item.stockActual,
            stock_minimo: item.stockMinimo,
            ubicacion: item.ubicacion,
            ultimo_movimiento: item.ultimoMovimiento
        });
        if (error) throw error;
    }

    // --- Movimientos ---
    async getAllMovimientos(): Promise<DBMovimientoInventario[]> {
        const { data, error } = await supabase.from('movimientos').select('*');
        if (error) throw error;
        return data.map((m: any) => ({
            id: m.id,
            productoId: m.producto_id,
            tipo: m.tipo,
            cantidad: m.cantidad,
            motivo: m.motivo,
            fecha: m.fecha,
            usuario: 'system'
        }));
    }

    async addMovimiento(movimiento: DBMovimientoInventario): Promise<void> {
        const { error } = await supabase.from('movimientos').insert({
            id: movimiento.id,
            producto_id: movimiento.productoId,
            tipo: movimiento.tipo,
            cantidad: movimiento.cantidad,
            motivo: movimiento.motivo,
            fecha: movimiento.fecha
        });
        if (error) throw error;
    }

    // --- Recepciones ---
    async getAllRecepciones(): Promise<DBRecepcion[]> {
        const { data, error } = await supabase.from('recepciones').select('*');
        if (error) throw error;
        return data.map((r: any) => ({
            id: r.id,
            prePedidoId: r.pre_pedido_id,
            proveedorId: r.proveedor_id,
            numeroFactura: r.numero_factura,
            fechaFactura: r.fecha_factura,
            totalFactura: r.total_factura,
            estado: r.estado,
            recibidoPor: r.recibido_por,
            firma: r.firma,
            observaciones: r.observaciones,
            fechaRecepcion: r.fecha_recepcion,
            imagenFactura: r.imagen_factura,
            items: r.items || []
        }));
    }

    async addRecepcion(recepcion: DBRecepcion): Promise<void> {
        const { error } = await supabase.from('recepciones').insert({
            id: recepcion.id,
            pre_pedido_id: recepcion.prePedidoId,
            proveedor_id: recepcion.proveedorId,
            numero_factura: recepcion.numeroFactura,
            fecha_factura: recepcion.fechaFactura,
            total_factura: recepcion.totalFactura,
            estado: recepcion.estado,
            recibido_por: recepcion.recibidoPor,
            firma: recepcion.firma,
            observaciones: recepcion.observaciones,
            fecha_recepcion: recepcion.fechaRecepcion,
            imagen_factura: recepcion.imagenFactura,
            items: recepcion.items // Saving as JSONB
        });
        if (error) throw error;
    }

    async updateRecepcion(recepcion: DBRecepcion): Promise<void> {
        const { error } = await supabase.from('recepciones').update({
            numero_factura: recepcion.numeroFactura,
            fecha_factura: recepcion.fechaFactura,
            total_factura: recepcion.totalFactura,
            estado: recepcion.estado,
            recibido_por: recepcion.recibidoPor,
            firma: recepcion.firma,
            observaciones: recepcion.observaciones,
            fecha_recepcion: recepcion.fechaRecepcion,
            imagen_factura: recepcion.imagenFactura,
            items: recepcion.items
        }).eq('id', recepcion.id);
        if (error) throw error;
    }


    // --- Historial ---
    async getAllHistorial(): Promise<DBHistorialPrecio[]> {
        const { data, error } = await supabase.from('historial_precios').select('*');
        if (error) throw error;
        return data.map((h: any) => ({
            id: h.id,
            productoId: h.producto_id,
            proveedorId: h.proveedor_id,
            precioAnterior: h.precio_anterior,
            precioNuevo: h.precio_nuevo,
            fechaCambio: h.fecha_cambio
        }));
    }

    async addHistorial(entry: DBHistorialPrecio): Promise<void> {
        const { error } = await supabase.from('historial_precios').insert({
            id: entry.id,
            producto_id: entry.productoId,
            proveedor_id: entry.proveedorId,
            precio_anterior: entry.precioAnterior,
            precio_nuevo: entry.precioNuevo,
            fecha_cambio: entry.fechaCambio
        });
        if (error) throw error;
    }

    async getHistorialByProducto(productoId: string): Promise<DBHistorialPrecio[]> {
        const { data, error } = await supabase.from('historial_precios').select('*').eq('producto_id', productoId);
        if (error) throw error;
        return data.map((h: any) => ({
            id: h.id,
            productoId: h.producto_id,
            proveedorId: h.proveedor_id,
            precioAnterior: h.precio_anterior,
            precioNuevo: h.precio_nuevo,
            fechaCambio: h.fecha_cambio
        }));
    }

    // --- Ventas ---
    async getAllVentas(): Promise<DBVenta[]> {
        const { data, error } = await supabase.from('ventas').select('*');
        if (error) throw error;
        return data.map(this.mapVentaFromDB);
    }

    async addVenta(venta: DBVenta): Promise<void> {
        const { error } = await supabase.from('ventas').upsert(this.mapVentaToDB(venta));
        if (error) throw error;
    }

    async getVentasByCaja(cajaId: string): Promise<DBVenta[]> {
        const { data, error } = await supabase.from('ventas').select('*').eq('caja_id', cajaId);
        if (error) throw error;
        return data.map(this.mapVentaFromDB);
    }

    // --- Caja ---
    async getAllSesionesCaja(): Promise<DBCajaSesion[]> {
        const { data, error } = await supabase.from('caja').select('*');
        if (error) throw error;
        return data.map(this.mapCajaFromDB);
    }

    async getSesionCajaActiva(): Promise<DBCajaSesion | undefined> {
        const { data, error } = await supabase.from('caja').select('*').eq('estado', 'abierta').maybeSingle();
        if (error) throw error;
        return data ? this.mapCajaFromDB(data) : undefined;
    }

    async addSesionCaja(sesion: DBCajaSesion): Promise<void> {
        const { error } = await supabase.from('caja').upsert(this.mapCajaToDB(sesion));
        if (error) throw error;
    }

    async updateSesionCaja(sesion: DBCajaSesion): Promise<void> {
        await this.addSesionCaja(sesion);
    }

    // --- Ahorros ---
    async getAllAhorros(): Promise<any[]> {
        const { data, error } = await supabase.from('ahorros').select('*');
        if (error) return [];
        return data;
    }
    async addAhorro(ahorro: any): Promise<void> {
        await supabase.from('ahorros').upsert(ahorro);
    }
    async updateAhorro(ahorro: any): Promise<void> {
        await this.addAhorro(ahorro);
    }
    async deleteAhorro(id: string): Promise<void> {
        await supabase.from('ahorros').delete().eq('id', id);
    }

    // --- Mesas ---
    async getAllMesas(): Promise<any[]> {
        const { data, error } = await supabase.from('mesas').select('*');
        if (error) return [];
        return data;
    }
    async updateMesa(mesa: any): Promise<void> {
        await supabase.from('mesas').upsert(mesa);
    }

    // --- Pedidos Activos ---
    async getAllPedidosActivos(): Promise<any[]> {
        const { data, error } = await supabase.from('pedidos_activos').select('*');
        if (error) return [];
        return data;
    }
    async addPedidoActivo(pedido: any): Promise<void> {
        await supabase.from('pedidos_activos').upsert(pedido);
    }
    async updatePedidoActivo(pedido: any): Promise<void> {
        await this.addPedidoActivo(pedido);
    }
    async deletePedidoActivo(id: string): Promise<void> {
        await supabase.from('pedidos_activos').delete().eq('id', id);
    }

    // --- Gastos ---
    async getAllGastos(): Promise<any[]> {
        const { data, error } = await supabase.from('gastos').select('*');
        if (error) return [];
        return data.map(g => ({
            id: g.id,
            descripcion: g.descripcion,
            monto: g.monto,
            categoria: g.categoria,
            fecha: g.fecha,
            proveedorId: g.proveedor_id,
            comprobanteUrl: g.comprobante_url,
            metodoPago: g.metodo_pago,
            usuarioId: g.usuario_id,
            cajaId: g.caja_id,
            metadata: g.metadata
        }));
    }
    async addGasto(gasto: any): Promise<void> {
        await supabase.from('gastos').upsert({
            id: gasto.id,
            descripcion: gasto.descripcion,
            monto: gasto.monto,
            categoria: gasto.categoria,
            fecha: gasto.fecha,
            proveedor_id: gasto.proveedorId,
            comprobante_url: gasto.comprobanteUrl,
            metodo_pago: gasto.metodoPago,
            usuario_id: gasto.usuarioId,
            caja_id: gasto.cajaId,
            metadata: gasto.metadata
        });
    }
    async updateGasto(gasto: any): Promise<void> {
        await this.addGasto(gasto);
    }
    async deleteGasto(id: string): Promise<void> {
        await supabase.from('gastos').delete().eq('id', id);
    }

    async clearAll(): Promise<void> {
        // Not implemented for safety in cloud
        console.warn('clearAll called on Supabase DB - operation ignored for safety');
    }

    // --- Helpers (Mappers) ---
    private mapProductoFromDB(p: any): DBProducto {
        return {
            id: p.id,
            nombre: p.nombre,
            categoria: p.categoria,
            descripcion: p.descripcion,
            precioVenta: p.precio_venta,
            margenUtilidad: p.margen_utilidad,
            tipo: p.tipo || 'ingrediente',
            costoBase: p.costo_base || 0,
            createdAt: p.created_at,
            updatedAt: p.updated_at
        };
    }

    private mapProductoToDB(p: DBProducto): any {
        return {
            id: p.id,
            nombre: p.nombre,
            categoria: p.categoria,
            descripcion: p.descripcion,
            precio_venta: p.precioVenta,
            margen_utilidad: p.margenUtilidad,
            tipo: p.tipo,
            costo_base: p.costoBase,
            created_at: p.createdAt,
            updated_at: p.updatedAt
        };
    }

    private mapPrecioFromDB(p: any): DBPrecio {
        return {
            id: p.id,
            productoId: p.producto_id,
            proveedorId: p.proveedor_id,
            precioCosto: p.precio_costo,
            fechaActualizacion: p.fecha_actualizacion,
            notas: p.notas
        };
    }

    private mapPrecioToDB(p: DBPrecio): any {
        return {
            id: p.id,
            producto_id: p.productoId,
            proveedor_id: p.proveedorId,
            precio_costo: p.precioCosto,
            fecha_actualizacion: p.fechaActualizacion,
            notas: p.notas
        };
    }

    private mapVentaFromDB(v: any): DBVenta {
        return {
            id: v.id,
            cajaId: v.caja_id,
            items: v.items || [],
            total: v.total,
            metodoPago: v.metodo_pago,
            usuarioId: v.usuario_id,
            cliente: v.cliente,
            notas: v.notas,
            fecha: v.fecha
        };
    }

    private mapVentaToDB(v: DBVenta): any {
        return {
            id: v.id,
            caja_id: v.cajaId,
            items: v.items,
            total: v.total,
            metodo_pago: v.metodoPago,
            usuario_id: v.usuarioId,
            cliente: v.cliente,
            notas: v.notas,
            fecha: v.fecha
        };
    }

    private mapCajaFromDB(c: any): DBCajaSesion {
        return {
            id: c.id,
            usuarioId: c.usuario_id,
            fechaApertura: c.fecha_apertura,
            fechaCierre: c.fecha_cierre,
            montoApertura: c.monto_apertura,
            montoCierre: c.monto_cierre,
            totalVentas: c.total_ventas,
            ventasIds: c.ventas_ids || [],
            estado: c.estado
        };
    }

    private mapCajaToDB(c: DBCajaSesion): any {
        return {
            id: c.id,
            usuario_id: c.usuarioId,
            fecha_apertura: c.fechaApertura,
            fecha_cierre: c.fechaCierre,
            monto_apertura: c.montoApertura,
            monto_cierre: c.montoCierre,
            total_ventas: c.totalVentas,
            ventas_ids: c.ventasIds,
            estado: c.estado
        };
    }
}

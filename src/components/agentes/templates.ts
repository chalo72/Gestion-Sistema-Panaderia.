export const workflowTemplates = [
  {
    id: 'wf-template-1',
    nombre: '1. Guardián del Inventario (Stock)',
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: 'node-trigger-1',
        type: 'custom',
        position: { x: 100, y: 200 },
        data: {
          title: 'Monitor de Stock',
          category: 'Trigger',
          colorTheme: 'cyan',
          iconName: 'Database',
          description: 'Revisa cada hora la tabla de inventario buscando productos por debajo del límite mínimo.',
          code: 'console.log("[Info]: Revisando base de datos de inventario...");\n// Simulación de búsqueda de datos\nreturn { harina: 15, azucar: 5, alerta: true };'
        }
      },
      {
        id: 'node-logic-1',
        type: 'custom',
        position: { x: 400, y: 200 },
        data: {
          title: 'Validar Mínimos',
          category: 'Lógica',
          colorTheme: 'yellow',
          iconName: 'AlertTriangle',
          description: 'Si la harina baja de 20kg, activa la alerta de compra.',
          code: 'if(input && input.alerta) {\n  console.log("[Info]: ¡Alerta de stock bajo detectada!");\n  return { mensaje: "Urgente: La harina está en " + input.harina + "kg. Hacer pedido." };\n}\nreturn null;'
        }
      },
      {
        id: 'node-action-1',
        type: 'custom',
        position: { x: 700, y: 200 },
        data: {
          title: 'Notificar al Gerente',
          category: 'Acción',
          colorTheme: 'emerald',
          iconName: 'MessageSquare',
          description: 'Envía un mensaje de alerta por WhatsApp.',
          code: 'if(input && input.mensaje) {\n  console.log("[Éxito]: Mensaje enviado: " + input.mensaje);\n  return { success: true };\n}\nreturn { success: false };'
        }
      }
    ],
    edges: [
      { id: 'edge-1-1', source: 'node-trigger-1', target: 'node-logic-1', animated: true, style: { stroke: 'rgba(56, 189, 248, 0.6)', strokeWidth: 3 }, markerEnd: { type: 'arrowclosed', color: 'rgba(56, 189, 248, 0.8)' } },
      { id: 'edge-1-2', source: 'node-logic-1', target: 'node-action-1', animated: true, style: { stroke: 'rgba(56, 189, 248, 0.6)', strokeWidth: 3 }, markerEnd: { type: 'arrowclosed', color: 'rgba(56, 189, 248, 0.8)' } }
    ]
  },
  {
    id: 'wf-template-2',
    nombre: '2. Cobrador Amable (Créditos)',
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: 'node-trigger-2',
        type: 'custom',
        position: { x: 100, y: 200 },
        data: {
          title: 'Revisión Diaria (10 AM)',
          category: 'Trigger',
          colorTheme: 'cyan',
          iconName: 'Zap',
          description: 'Se ejecuta todos los días a las 10:00 AM para revisar créditos vencidos.',
          code: 'console.log("[Info]: Ejecutando tarea diaria de cobranza...");\nreturn { clientes_vencidos: [{ nombre: "Carlos", deuda: 50, dias: 16 }] };'
        }
      },
      {
        id: 'node-logic-2',
        type: 'custom',
        position: { x: 400, y: 150 },
        data: {
          title: 'Extraer Deudores (>15 días)',
          category: 'Lógica',
          colorTheme: 'yellow',
          iconName: 'Code',
          description: 'Filtra la lista de clientes con más de 15 días de atraso.',
          code: 'const deudores = input.clientes_vencidos.filter(c => c.dias > 15);\nconsole.log("[Info]: Encontrados " + deudores.length + " deudores.");\nreturn { deudores };'
        }
      },
      {
        id: 'node-action-2',
        type: 'custom',
        position: { x: 700, y: 250 },
        data: {
          title: 'IA Redactora & Enviar',
          category: 'IA',
          colorTheme: 'purple',
          iconName: 'Bot',
          description: 'Usa IA para escribir un mensaje educado y enviarlo.',
          prompt: 'Escribe un mensaje de cobro muy educado y amigable para el cliente.',
          code: 'if(input.deudores.length > 0) {\n  const c = input.deudores[0];\n  console.log(`[Éxito]: Mensaje enviado: Hola ${c.nombre}, te recordamos tu saldo de $${c.deuda}.`);\n  return true;\n}\nreturn false;'
        }
      }
    ],
    edges: [
      { id: 'edge-2-1', source: 'node-trigger-2', target: 'node-logic-2', animated: true, style: { stroke: 'rgba(56, 189, 248, 0.6)', strokeWidth: 3 }, markerEnd: { type: 'arrowclosed', color: 'rgba(56, 189, 248, 0.8)' } },
      { id: 'edge-2-2', source: 'node-logic-2', target: 'node-action-2', animated: true, style: { stroke: 'rgba(56, 189, 248, 0.6)', strokeWidth: 3 }, markerEnd: { type: 'arrowclosed', color: 'rgba(56, 189, 248, 0.8)' } }
    ]
  },
  {
    id: 'wf-template-3',
    nombre: '3. Resumen de Caja por WhatsApp',
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: 'node-trigger-3',
        type: 'custom',
        position: { x: 100, y: 200 },
        data: {
          title: 'Cierre de Turno (21:00)',
          category: 'Trigger',
          colorTheme: 'cyan',
          iconName: 'Zap',
          description: 'Se dispara a las 9 PM todos los días.',
          code: 'console.log("[Info]: Iniciando cierre de caja automático...");\nreturn { dia: new Date().toLocaleDateString(), ventasTotales: 450, gastos: 50 };'
        }
      },
      {
        id: 'node-logic-3',
        type: 'custom',
        position: { x: 400, y: 200 },
        data: {
          title: 'Calcular Balance Neto',
          category: 'Lógica',
          colorTheme: 'yellow',
          iconName: 'Code',
          description: 'Calcula ingresos menos gastos.',
          code: 'const neto = input.ventasTotales - input.gastos;\nconsole.log("[Info]: Balance calculado: $" + neto);\nreturn { ...input, neto };'
        }
      },
      {
        id: 'node-action-3',
        type: 'custom',
        position: { x: 700, y: 200 },
        data: {
          title: 'Enviar a Gerencia',
          category: 'Acción',
          colorTheme: 'emerald',
          iconName: 'MessageSquare',
          description: 'Manda el resumen al dueño por WhatsApp.',
          code: 'console.log(`[Éxito]: WhatsApp enviado: 💰 Cierre ${input.dia}: Ventas $${input.ventasTotales}, Gastos $${input.gastos}. Neto: $${input.neto}`);\nreturn true;'
        }
      }
    ],
    edges: [
      { id: 'edge-3-1', source: 'node-trigger-3', target: 'node-logic-3', animated: true, style: { stroke: 'rgba(56, 189, 248, 0.6)', strokeWidth: 3 }, markerEnd: { type: 'arrowclosed', color: 'rgba(56, 189, 248, 0.8)' } },
      { id: 'edge-3-2', source: 'node-logic-3', target: 'node-action-3', animated: true, style: { stroke: 'rgba(56, 189, 248, 0.6)', strokeWidth: 3 }, markerEnd: { type: 'arrowclosed', color: 'rgba(56, 189, 248, 0.8)' } }
    ]
  },
  {
    id: 'wf-template-4',
    nombre: '4. Asistente Panadero (Órdenes)',
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: 'node-trigger-4',
        type: 'custom',
        position: { x: 100, y: 200 },
        data: {
          title: 'Nuevo PrePedido',
          category: 'Trigger',
          colorTheme: 'cyan',
          iconName: 'Database',
          description: 'Detecta cuando entran pedidos fuertes para el día siguiente.',
          code: 'console.log("[Info]: Detectados 50 Panes de Queso en prepedidos.");\nreturn { producto: "Pan de Queso", cantidad: 50 };'
        }
      },
      {
        id: 'node-logic-4',
        type: 'custom',
        position: { x: 400, y: 200 },
        data: {
          title: 'Calcular Receta',
          category: 'Lógica',
          colorTheme: 'yellow',
          iconName: 'Code',
          description: 'Busca la receta y multiplica los ingredientes base.',
          code: 'const harinaBase = 0.5; // kg por pan\nconst quesoBase = 0.2;\nconsole.log("[Info]: Calculando ingredientes totales...");\nreturn { harinaTotal: harinaBase * input.cantidad, quesoTotal: quesoBase * input.cantidad };'
        }
      },
      {
        id: 'node-action-4',
        type: 'custom',
        position: { x: 700, y: 200 },
        data: {
          title: 'Generar Orden Producción',
          category: 'Acción',
          colorTheme: 'emerald',
          iconName: 'HardDrive',
          description: 'Guarda la orden de trabajo para el panadero en el sistema.',
          code: 'console.log(`[Éxito]: Orden generada. Preparar ${input.harinaTotal}kg de Harina y ${input.quesoTotal}kg de Queso.`);\nreturn true;'
        }
      }
    ],
    edges: [
      { id: 'edge-4-1', source: 'node-trigger-4', target: 'node-logic-4', animated: true, style: { stroke: 'rgba(56, 189, 248, 0.6)', strokeWidth: 3 }, markerEnd: { type: 'arrowclosed', color: 'rgba(56, 189, 248, 0.8)' } },
      { id: 'edge-4-2', source: 'node-logic-4', target: 'node-action-4', animated: true, style: { stroke: 'rgba(56, 189, 248, 0.6)', strokeWidth: 3 }, markerEnd: { type: 'arrowclosed', color: 'rgba(56, 189, 248, 0.8)' } }
    ]
  },
  {
    id: 'wf-template-5',
    nombre: '5. Bienvenida a Mayoristas',
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: 'node-trigger-5',
        type: 'custom',
        position: { x: 100, y: 200 },
        data: {
          title: 'Nuevo Cliente Creado',
          category: 'Trigger',
          colorTheme: 'cyan',
          iconName: 'Database',
          description: 'Al guardar un nuevo registro en tabla Mayoristas.',
          code: 'console.log("[Info]: Nuevo mayorista registrado: Panadería San José");\nreturn { nombre: "Panadería San José", telefono: "+584121234567" };'
        }
      },
      {
        id: 'node-action-5',
        type: 'custom',
        position: { x: 500, y: 200 },
        data: {
          title: 'Enviar Catálogo PDF',
          category: 'Acción',
          colorTheme: 'emerald',
          iconName: 'MessageSquare',
          description: 'Envía mensaje automático de bienvenida.',
          code: 'console.log(`[Éxito]: Mensaje enviado a ${input.telefono}: ¡Bienvenido ${input.nombre}! Aquí tienes nuestra Lista de Precios Oficial.`);\nreturn true;'
        }
      }
    ],
    edges: [
      { id: 'edge-5-1', source: 'node-trigger-5', target: 'node-action-5', animated: true, style: { stroke: 'rgba(56, 189, 248, 0.6)', strokeWidth: 3 }, markerEnd: { type: 'arrowclosed', color: 'rgba(56, 189, 248, 0.8)' } }
    ]
  },
  {
    id: 'wf-template-6',
    nombre: '6. Alerta de Llegada Tarde',
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: 'node-trigger-6',
        type: 'custom',
        position: { x: 100, y: 200 },
        data: {
          title: 'Fichaje de Personal',
          category: 'Trigger',
          colorTheme: 'cyan',
          iconName: 'Database',
          description: 'Trabajador registra entrada.',
          code: 'console.log("[Info]: Fichaje recibido: Juan Pérez a las 05:25 AM (Turno 05:00 AM)");\nreturn { trabajador: "Juan Pérez", horaFichaje: "05:25", horaTurno: "05:00" };'
        }
      },
      {
        id: 'node-logic-6',
        type: 'custom',
        position: { x: 400, y: 200 },
        data: {
          title: 'Control de Retraso (>15m)',
          category: 'Lógica',
          colorTheme: 'yellow',
          iconName: 'AlertTriangle',
          description: 'Compara horas de entrada.',
          code: 'console.log("[Info]: Evaluando retraso...");\n// Lógica simplificada\nreturn { ...input, esTarde: true, retrasoMinutos: 25 };'
        }
      },
      {
        id: 'node-action-6',
        type: 'custom',
        position: { x: 700, y: 200 },
        data: {
          title: 'Aviso a Recursos Humanos',
          category: 'Acción',
          colorTheme: 'emerald',
          iconName: 'ShieldAlert',
          description: 'Notifica el retraso.',
          code: 'if(input.esTarde) {\n  console.log(`[Éxito]: Alerta enviada: ${input.trabajador} llegó ${input.retrasoMinutos} minutos tarde.`);\n}\nreturn true;'
        }
      }
    ],
    edges: [
      { id: 'edge-6-1', source: 'node-trigger-6', target: 'node-logic-6', animated: true, style: { stroke: 'rgba(56, 189, 248, 0.6)', strokeWidth: 3 }, markerEnd: { type: 'arrowclosed', color: 'rgba(56, 189, 248, 0.8)' } },
      { id: 'edge-6-2', source: 'node-logic-6', target: 'node-action-6', animated: true, style: { stroke: 'rgba(56, 189, 248, 0.6)', strokeWidth: 3 }, markerEnd: { type: 'arrowclosed', color: 'rgba(56, 189, 248, 0.8)' } }
    ]
  },
  {
    id: 'wf-template-7',
    nombre: '7. Marketing (Recuperar Clientes)',
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: 'node-trigger-7',
        type: 'custom',
        position: { x: 100, y: 200 },
        data: {
          title: 'Revisión Semanal',
          category: 'Trigger',
          colorTheme: 'cyan',
          iconName: 'Zap',
          description: 'Se activa todos los lunes para buscar clientes inactivos.',
          code: 'console.log("[Info]: Buscando clientes inactivos...");\nreturn { clientes_inactivos: [{ nombre: "María", ultimo_pedido: "Hace 20 días" }] };'
        }
      },
      {
        id: 'node-action-7',
        type: 'custom',
        position: { x: 500, y: 200 },
        data: {
          title: 'Enviar Promo 15%',
          category: 'Acción',
          colorTheme: 'emerald',
          iconName: 'MessageSquare',
          description: 'Envía cupón de descuento por WhatsApp.',
          code: 'if(input.clientes_inactivos) {\n  console.log(`[Éxito]: Promo enviada a ${input.clientes_inactivos[0].nombre}: ¡Te extrañamos! Tienes 15% de descuento hoy.`);\n  return true;\n}\nreturn false;'
        }
      }
    ],
    edges: [
      { id: 'edge-7-1', source: 'node-trigger-7', target: 'node-action-7', animated: true, style: { stroke: 'rgba(56, 189, 248, 0.6)', strokeWidth: 3 }, markerEnd: { type: 'arrowclosed', color: 'rgba(56, 189, 248, 0.8)' } }
    ]
  },
  {
    id: 'wf-template-8',
    nombre: '8. CM Automático (Redes Sociales)',
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: 'node-trigger-8',
        type: 'custom',
        position: { x: 100, y: 200 },
        data: {
          title: 'Cronograma Diario (09:00)',
          category: 'Trigger',
          colorTheme: 'cyan',
          iconName: 'Zap',
          description: 'Se activa cada mañana para publicar el post del día.',
          code: 'console.log("[Info]: Activando rutina matutina de Redes Sociales...");\nreturn { dia_semana: "Viernes", evento: "Fin de semana dulce" };'
        }
      },
      {
        id: 'node-logic-8',
        type: 'custom',
        position: { x: 400, y: 100 },
        data: {
          title: 'IA Redactora de Posts',
          category: 'IA',
          colorTheme: 'purple',
          iconName: 'Bot',
          description: 'Genera el texto (copy) del post usando Inteligencia Artificial.',
          prompt: 'Escribe un copy alegre y antojador para una panadería un viernes.',
          code: 'console.log("[Info]: IA generando texto creativo...");\nconst copy = "¡El finde huele a pan recién horneado! 🥐 Ven por tus dulces favoritos a Dulce Placer.";\nreturn { ...input, copy_generado: copy };'
        }
      },
      {
        id: 'node-action-8a',
        type: 'custom',
        position: { x: 700, y: 50 },
        data: {
          title: 'Publicar Instagram',
          category: 'Acción',
          colorTheme: 'emerald',
          iconName: 'Share2',
          description: 'Conecta con la API de Meta para publicar en IG.',
          code: 'console.log(`[Éxito]: 📸 Foto subida a Instagram con el texto: "${input.copy_generado}"`);\nreturn true;'
        }
      },
      {
        id: 'node-action-8b',
        type: 'custom',
        position: { x: 700, y: 250 },
        data: {
          title: 'Publicar Facebook',
          category: 'Acción',
          colorTheme: 'emerald',
          iconName: 'Share2',
          description: 'Conecta con la API de Meta para publicar en FB.',
          code: 'console.log(`[Éxito]: 📘 Post publicado en Facebook con el texto: "${input.copy_generado}"`);\nreturn true;'
        }
      }
    ],
    edges: [
      { id: 'edge-8-1', source: 'node-trigger-8', target: 'node-logic-8', animated: true, style: { stroke: 'rgba(56, 189, 248, 0.6)', strokeWidth: 3 }, markerEnd: { type: 'arrowclosed', color: 'rgba(56, 189, 248, 0.8)' } },
      { id: 'edge-8-2', source: 'node-logic-8', target: 'node-action-8a', animated: true, style: { stroke: 'rgba(56, 189, 248, 0.6)', strokeWidth: 3 }, markerEnd: { type: 'arrowclosed', color: 'rgba(56, 189, 248, 0.8)' } },
      { id: 'edge-8-3', source: 'node-logic-8', target: 'node-action-8b', animated: true, style: { stroke: 'rgba(56, 189, 248, 0.6)', strokeWidth: 3 }, markerEnd: { type: 'arrowclosed', color: 'rgba(56, 189, 248, 0.8)' } }
    ]
  },
  {
    id: 'wf-template-9',
    nombre: '9. Chatbot Atención Cliente (WhatsApp)',
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: 'node-trigger-9',
        type: 'custom',
        position: { x: 100, y: 200 },
        data: {
          title: 'Mensaje Recibido (Webhook)',
          category: 'Trigger',
          colorTheme: 'cyan',
          iconName: 'MessageSquare',
          description: 'Detecta cuando un cliente escribe al WhatsApp del negocio.',
          code: 'console.log("[Info]: 📩 Nuevo mensaje de WhatsApp entrante.");\nreturn { cliente: "Roberto", mensaje_cliente: "¿Hasta qué hora abren hoy?" };'
        }
      },
      {
        id: 'node-logic-9',
        type: 'custom',
        position: { x: 400, y: 200 },
        data: {
          title: 'IA Interpretar Intención',
          category: 'IA',
          colorTheme: 'purple',
          iconName: 'BrainCircuit',
          description: 'Analiza si el cliente pide horarios, precios o quiere hacer pedido.',
          prompt: 'Lee el mensaje y determina la intención del cliente.',
          code: 'console.log("[Info]: Analizando intención de: \\"" + input.mensaje_cliente + "\\"");\nconst intencion = "consulta_horario";\nlet respuesta_ia = "";\nif(intencion === "consulta_horario") {\n  respuesta_ia = "¡Hola " + input.cliente + "! Trabajamos de Lunes a Domingo de 6:00 AM a 9:00 PM. ¡Te esperamos!";\n}\nreturn { ...input, intencion, respuesta_ia };'
        }
      },
      {
        id: 'node-action-9',
        type: 'custom',
        position: { x: 700, y: 200 },
        data: {
          title: 'Responder al Cliente',
          category: 'Acción',
          colorTheme: 'emerald',
          iconName: 'Send',
          description: 'Envía la respuesta generada por la IA de vuelta al WhatsApp del cliente.',
          code: 'console.log(`[Éxito]: 🤖 Respuesta automática enviada: "${input.respuesta_ia}"`);\nreturn true;'
        }
      }
    ],
    edges: [
      { id: 'edge-9-1', source: 'node-trigger-9', target: 'node-logic-9', animated: true, style: { stroke: 'rgba(56, 189, 248, 0.6)', strokeWidth: 3 }, markerEnd: { type: 'arrowclosed', color: 'rgba(56, 189, 248, 0.8)' } },
      { id: 'edge-9-2', source: 'node-logic-9', target: 'node-action-9', animated: true, style: { stroke: 'rgba(56, 189, 248, 0.6)', strokeWidth: 3 }, markerEnd: { type: 'arrowclosed', color: 'rgba(56, 189, 248, 0.8)' } }
    ]
  }
];

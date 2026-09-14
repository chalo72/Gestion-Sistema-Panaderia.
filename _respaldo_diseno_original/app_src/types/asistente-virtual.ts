export type FSMState = 
  | 'IDLE'
  | 'SALUDO_Y_MENU'
  | 'CREANDO_PEDIDO_SELECCION'
  | 'CREANDO_PEDIDO_CANTIDAD'
  | 'SUGERENCIA_COMPLEMENTO'
  | 'CONFIRMACION_PAGO'
  | 'MODO_ORACULO';

export type UserIntent = 
  | 'VER_MENU'
  | 'HACER_PEDIDO'
  | 'VER_PROMOS'
  | 'CONFIRMAR'
  | 'CANCELAR'
  | 'TEXTO_LIBRE';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  options?: { label: string; intent: UserIntent; payload?: any }[];
  isTyping?: boolean;
}

export interface OrderContext {
  productoSeleccionado?: string;
  cantidad?: number;
  complementoSugerido?: string;
  total?: number;
}

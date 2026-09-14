import { useState, useCallback } from 'react';
import type { FSMState, UserIntent, ChatMessage, OrderContext } from '@/types/asistente-virtual';

export function useAgentLoop(onOrderComplete: (order: OrderContext) => Promise<void>) {
  const [state, setState] = useState<FSMState>('IDLE');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [context, setContext] = useState<OrderContext>({});

  const addMessage = useCallback((msg: Omit<ChatMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(7);
    setMessages(prev => [...prev, { ...msg, id }]);
  }, []);

  const updateLastMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  }, []);

  // Simulates a thinking delay for microinteractions
  const simulateThinking = useCallback(async (ms: number = 800) => {
    const id = Math.random().toString(36).substring(7);
    setMessages(prev => [...prev, { id, sender: 'agent', text: '', isTyping: true }]);
    await new Promise(resolve => setTimeout(resolve, ms));
    setMessages(prev => prev.filter(m => m.id !== id)); // remove typing indicator
    return id; // can return an id if we want to morph the typing message into the real one, but removing is simpler
  }, []);

  // Transiciones de Estado
  const transition = useCallback(async (intent: UserIntent, payload?: any, rawText?: string) => {
    // Si hay texto libre, lo mostramos
    if (rawText) {
       addMessage({ sender: 'user', text: rawText });
    }

    if (intent === 'TEXTO_LIBRE' && rawText) {
      // MODO_ORACULO - Híbrido LLM fallback
      const prev = state;
      setState('MODO_ORACULO');
      await simulateThinking(1500);
      
      // Aquí llamaríamos a Gemini, por ahora es simulado
      addMessage({
        sender: 'agent',
        text: `🤖 (LLM): Detecto que preguntas sobre "${rawText}". Nuestros panes son horneados frescos todos los días a las 5 AM. ¿Deseas continuar con tu pedido?`,
        options: [
          { label: 'Sí, continuar', intent: 'VER_MENU' },
          { label: 'Cancelar', intent: 'CANCELAR' }
        ]
      });
      // Volvemos al estado anterior lógicamente, o esperamos que pulse continuar
      return;
    }

    // FSM Principal
    switch (state) {
      case 'IDLE':
        if (intent === 'VER_MENU') {
          setState('SALUDO_Y_MENU');
          await simulateThinking();
          addMessage({
            sender: 'agent',
            text: '¡Hola! Bienvenido a Dulce Placer 🥖. ¿En qué te puedo ayudar hoy?',
            options: [
              { label: 'Hacer un Pedido', intent: 'HACER_PEDIDO' },
              { label: 'Ver Promociones', intent: 'VER_PROMOS' }
            ]
          });
        }
        break;

      case 'SALUDO_Y_MENU':
        if (intent === 'HACER_PEDIDO') {
          setState('CREANDO_PEDIDO_SELECCION');
          await simulateThinking();
          addMessage({
            sender: 'agent',
            text: '¡Excelente! ¿Qué pan deseas llevar hoy? (Ej: Pan de Queso, Pan Hawaiano, Croissant)',
            options: [
              { label: 'Pan de Queso ($2,000)', intent: 'TEXTO_LIBRE', payload: 'Pan de Queso' },
              { label: 'Pan Hawaiano ($3,500)', intent: 'TEXTO_LIBRE', payload: 'Pan Hawaiano' }
            ]
          });
        }
        break;

      case 'CREANDO_PEDIDO_SELECCION':
        if (intent === 'TEXTO_LIBRE' && payload) {
          setContext(prev => ({ ...prev, productoSeleccionado: payload, total: payload.includes('Queso') ? 2000 : 3500 }));
          setState('CREANDO_PEDIDO_CANTIDAD');
          await simulateThinking();
          addMessage({
            sender: 'agent',
            text: `Has elegido ${payload}. ¿Cuántas unidades deseas?`,
            options: [
              { label: '1 unidad', intent: 'TEXTO_LIBRE', payload: 1 },
              { label: '2 unidades', intent: 'TEXTO_LIBRE', payload: 2 },
              { label: '5 unidades', intent: 'TEXTO_LIBRE', payload: 5 }
            ]
          });
        }
        break;

      case 'CREANDO_PEDIDO_CANTIDAD':
        if (intent === 'TEXTO_LIBRE' && payload) {
          const qty = parseInt(payload);
          setContext(prev => {
            const newTotal = (prev.total || 0) * qty;
            return { ...prev, cantidad: qty, total: newTotal };
          });
          setState('SUGERENCIA_COMPLEMENTO');
          await simulateThinking(1000);
          addMessage({
            sender: 'agent',
            text: `¡Anotado! ${payload} unidades. ¿Te gustaría agregar un Café Caliente por $1,500 extra para acompañar? ☕`,
            options: [
              { label: 'Sí, agregar Café', intent: 'CONFIRMAR', payload: true },
              { label: 'No, gracias', intent: 'CONFIRMAR', payload: false }
            ]
          });
        }
        break;

      case 'SUGERENCIA_COMPLEMENTO':
        if (intent === 'CONFIRMAR') {
          setState('CONFIRMACION_PAGO');
          let finalTotal = context.total || 0;
          let text = `Perfecto. Tu pedido es: ${context.cantidad}x ${context.productoSeleccionado}.`;
          
          if (payload) {
            finalTotal += 1500;
            text = `Perfecto. Tu pedido es: ${context.cantidad}x ${context.productoSeleccionado} + 1 Café Caliente.`;
            setContext(prev => ({ ...prev, complementoSugerido: 'Café Caliente', total: finalTotal }));
          }

          text += `\nEl total es $${finalTotal.toLocaleString('es-CO')}. ¿Confirmar pedido?`;
          
          await simulateThinking();
          addMessage({
            sender: 'agent',
            text,
            options: [
              { label: '✅ Confirmar Pedido', intent: 'CONFIRMAR', payload: 'final' },
              { label: '❌ Cancelar', intent: 'CANCELAR' }
            ]
          });
        }
        break;

      case 'CONFIRMACION_PAGO':
        if (intent === 'CONFIRMAR' && payload === 'final') {
          await simulateThinking(1500);
          addMessage({
            sender: 'agent',
            text: '¡Pedido confirmado y registrado en la Caja! 🎉 Pasa a recogerlo en 5 minutos.',
          });
          await onOrderComplete(context);
          // Reset
          setTimeout(() => {
            setState('IDLE');
            setContext({});
          }, 3000);
        } else if (intent === 'CANCELAR') {
          await simulateThinking();
          addMessage({
            sender: 'agent',
            text: 'Pedido cancelado. ¡Te esperamos pronto!',
          });
          setTimeout(() => {
            setState('IDLE');
            setContext({});
            setMessages([]);
          }, 2000);
        }
        break;
        
      default:
        if (intent === 'CANCELAR') {
           setState('IDLE');
           setContext({});
           setMessages([]);
        }
        break;
    }
  }, [state, context, addMessage, simulateThinking, onOrderComplete]);

  // Start chat
  const startConversation = useCallback(() => {
    if (state === 'IDLE' && messages.length === 0) {
      transition('VER_MENU');
    }
  }, [state, messages.length, transition]);

  return {
    state,
    messages,
    context,
    transition,
    startConversation
  };
}

import { useState, useEffect, useRef } from 'react';
import { useAgentLoop } from '@/hooks/useAgentLoop';
import type { OrderContext } from '@/types/asistente-virtual';
import { Bot, User, Send, X, Loader2, Sparkles, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Props {
  onClose?: () => void;
  onSaveOrder?: (order: OrderContext) => Promise<void>;
}

export function AsistenteVirtual({ onClose, onSaveOrder }: Props) {
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleOrderComplete = async (order: OrderContext) => {
    if (onSaveOrder) {
      await onSaveOrder(order);
    } else {
      toast.success(`Pedido simulado de ${order.cantidad}x ${order.productoSeleccionado} por $${order.total}`);
    }
  };

  const { messages, transition, startConversation } = useAgentLoop(handleOrderComplete);

  useEffect(() => {
    startConversation();
  }, [startConversation]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendText = () => {
    if (!inputText.trim()) return;
    transition('TEXTO_LIBRE', inputText, inputText);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendText();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-white/10 shadow-2xl relative w-full sm:w-[400px]">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-black/40 border-b border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center relative">
            <Bot className="w-5 h-5 text-indigo-400" />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-slate-900" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1">ClientBot IA <Sparkles className="w-3 h-3 text-amber-400" /></h3>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Asistente de Pedidos</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gradient-to-b from-transparent to-black/20">
        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex w-full", msg.sender === 'user' ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm flex flex-col gap-1 relative",
              msg.sender === 'user' 
                ? "bg-indigo-600 text-white rounded-tr-sm" 
                : "bg-slate-800 border border-white/5 text-slate-200 rounded-tl-sm"
            )}>
              {/* Message text or typing indicator */}
              {msg.isTyping ? (
                <div className="flex items-center gap-1.5 h-6 px-1">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              )}

              {/* Dynamic Action Chips (ICM) */}
              {!msg.isTyping && msg.options && msg.options.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-white/10">
                  {msg.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => transition(opt.intent, opt.payload, opt.intent === 'TEXTO_LIBRE' ? opt.payload : undefined)}
                      className={cn(
                        "text-xs font-bold px-3 py-1.5 rounded-lg border transition-all active:scale-95",
                        opt.intent === 'CONFIRMAR' || opt.intent === 'HACER_PEDIDO' ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30" :
                        opt.intent === 'CANCELAR' ? "bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30" :
                        "bg-white/5 border-white/10 hover:bg-white/10 text-indigo-300"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} className="h-2" />
      </div>

      {/* Input Area */}
      <div className="shrink-0 p-3 bg-black/60 border-t border-white/10 backdrop-blur-md">
        <div className="relative flex items-center bg-slate-900 border border-white/10 rounded-xl px-3 shadow-inner focus-within:border-indigo-500/50 transition-colors">
          <input 
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta o pedido..."
            className="flex-1 bg-transparent border-none text-sm text-white placeholder:text-slate-500 py-3 outline-none"
          />
          <button 
            onClick={handleSendText}
            disabled={!inputText.trim()}
            className="p-2 ml-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-400 text-white rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[9px] text-center text-slate-500 mt-2 font-medium uppercase tracking-widest">
          Sistema Híbrido: NLP + Máquina de Estados
        </p>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CloudDownload, ChevronLeft, Check } from 'lucide-react';
import { pullUsersFromCloud, mergeUsersToLocalStorage } from '@/lib/user-cloud-sync';
import type { Usuario } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  esUsuarioLoginOficial,
  ordenarUsuariosLogin,
  etiquetaRolLogin,
} from '@/lib/usuarios-login-oficiales';

interface LoginProps {
  onLoginSuccess: () => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done'>('idle');
  const [failCount, setFailCount] = useState(0);
  const syncDone = useRef(false);
  const { login, usuarios } = useAuth();
  
  // Solo perfiles oficiales del Director (Admin, Gerente, Panadero, 3 turnos)
  const activeUsers = ordenarUsuariosLogin(usuarios.filter(esUsuarioLoginOficial));

  // Al montar: traer usuarios del cloud
  useEffect(() => {
    if (syncDone.current) return;
    syncDone.current = true;
    setSyncStatus('syncing');
    pullUsersFromCloud()
      .then(remote => { mergeUsersToLocalStorage(remote); setSyncStatus('done'); })
      .catch(() => setSyncStatus('idle'));
  }, []);

  const handleForceSync = async () => {
    setSyncStatus('syncing');
    try {
      const remote = await pullUsersFromCloud();
      mergeUsersToLocalStorage(remote);
      setSyncStatus('done');
      setError('');
      setFailCount(0);
      toast.success('Usuarios actualizados de la nube');
    } catch {
      setSyncStatus('idle');
      toast.error('Error al sincronizar con la nube');
    }
  };

  const handlePinSubmit = async (finalPin: string) => {
    if (!selectedUser) return;
    setError('');
    setIsLoading(true);
    try {
      const result = await login(selectedUser.email, finalPin);
      if (result.success) { 
        onLoginSuccess(); 
        return; 
      }
      
      setError(result.error || 'PIN o contraseña incorrecta');
      setPin(''); // Limpiar PIN al fallar
      setFailCount(prev => prev + 1);
    } catch (err: any) {
      console.error(err);
      setError('Error inesperado al iniciar sesión');
      setPin('');
      setFailCount(prev => prev + 1);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNumberClick = (num: string) => {
    if (pin.length < 10) { // Permitir contraseñas más largas si no son 4 dígitos exactos
      const newPin = pin + num;
      setPin(newPin);
      
      // Auto-submit si la mayoría tiene 4 dígitos (opcional, dejamos que den Enter mejor para evitar bloqueos si alguien tiene 5 dígitos)
      // Pero si tienen 4, autoentrar es mejor para UX. Asumimos PIN de 4.
      if (newPin.length === 4) {
        handlePinSubmit(newPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };
  
  const handleManualSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (pin.length > 0) handlePinSubmit(pin);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden"
         style={{ background: 'linear-gradient(90deg, #1a0533 0%, #0c1a3a 30%, #0a1628 55%, #1a0a2e 80%, #2d0a1a 100%)' }}>

      {/* Glows horizontales de fondo */}
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'linear-gradient(90deg, rgba(109,40,217,0.28) 0%, transparent 45%)' }} />
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'linear-gradient(90deg, transparent 55%, rgba(255,0,127,0.22) 100%)' }} />

      {/* WRAPPER PRINCIPAL */}
      <div className="relative z-10 w-full max-w-2xl"
           style={{ padding: '2px', borderRadius: '1.5rem', overflow: 'hidden' }}>

        <div style={{
          position: 'absolute', width: '200%', height: '200%', top: '-50%', left: '-50%',
          background: 'conic-gradient(from 0deg, transparent 0deg, #ff007f 15deg, #ffffff 20deg, #ff007f 25deg, transparent 40deg, transparent 360deg)',
          animation: 'borderSpin 3s linear infinite',
        }} />

        <div className="relative rounded-3xl p-6 sm:p-10"
             style={{
               background: 'linear-gradient(135deg, rgba(15,12,35,0.95) 0%, rgba(10,18,40,0.95) 100%)',
               backdropFilter: 'blur(24px)',
               WebkitBackdropFilter: 'blur(24px)',
             }}>

          {/* LOGO SUPERIOR */}
          {!selectedUser && (
              <div className="flex flex-col items-center mb-6">
                <div className="relative flex items-center justify-center w-24 h-24 mb-3">
                  <div className="absolute rounded-full border-2 border-white/15 overflow-hidden p-2"
                       style={{ inset: '10%', background: 'rgba(10,12,30,0.92)', backdropFilter: 'blur(12px)', boxShadow: '0 0 30px rgba(255,0,127,0.2)' }}>
                    <img src="/logo.png" alt="Dulce Placer" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                </div>
                <h1 className="text-3xl font-black text-white tracking-tight leading-none text-center">
                  Dulce <span className="text-[#ff007f]">Placer</span>
                </h1>
                
                <div className="flex items-center gap-2 mt-4 px-3 py-1 bg-white/5 border border-white/10 rounded-full cursor-pointer hover:bg-white/10 transition-colors" onClick={handleForceSync}>
                  <CloudDownload className={cn("w-3.5 h-3.5 text-slate-300", syncStatus === 'syncing' && "animate-pulse text-emerald-400")} />
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                    {syncStatus === 'syncing' ? 'Sincronizando Usuarios...' : `${activeUsers.length} Usuarios Disponibles`}
                  </span>
                </div>
              </div>
          )}

          {/* ESTADO 1: SELECTOR DE USUARIOS */}
          {!selectedUser ? (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest text-center mb-6">¿Quién eres?</h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {activeUsers.map(user => (
                  <div 
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#ff007f]/50 cursor-pointer transition-all hover:scale-105 active:scale-95"
                  >
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#ff007f] to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-[#ff007f]/20">
                      {user.avatar ? <img src={user.avatar} className="w-full h-full rounded-full object-cover" alt="" /> : user.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-center">
                      <p className="text-white font-bold text-sm leading-tight">{user.nombre}</p>
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5">{etiquetaRolLogin(user.rol)}</p>
                    </div>
                  </div>
                ))}
              </div>
              {activeUsers.length === 0 && (
                <p className="text-center text-slate-400 text-xs mt-4">
                  Sin perfiles. Toca «Sincronizando Usuarios» o recarga la app.
                </p>
              )}
            </div>
          ) : (
            /* ESTADO 2: PIN PAD */
            <div className="animate-in slide-in-from-right-4 fade-in duration-300 max-w-xs mx-auto">
              
              <button 
                onClick={() => { setSelectedUser(null); setPin(''); setError(''); }}
                className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors mb-6 text-sm font-bold"
              >
                <ChevronLeft className="w-4 h-4" /> Volver a perfiles
              </button>

              <div className="flex flex-col items-center mb-8">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#ff007f] to-indigo-600 flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-xl shadow-[#ff007f]/30 border-4 border-white/10">
                  {selectedUser.avatar ? <img src={selectedUser.avatar} className="w-full h-full rounded-full object-cover" /> : selectedUser.nombre.charAt(0).toUpperCase()}
                </div>
                <h2 className="text-xl font-black text-white">{selectedUser.nombre}</h2>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{etiquetaRolLogin(selectedUser.rol)}</p>
              </div>

              {error && (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/30 text-red-300 rounded-xl mb-6 py-2">
                  <AlertDescription className="text-center font-bold text-xs">{error}</AlertDescription>
                </Alert>
              )}

              {/* PIN DISPLAY */}
              <div className="flex justify-center gap-3 mb-8">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={cn(
                    "w-4 h-4 rounded-full transition-all duration-300",
                    i < pin.length ? "bg-[#ff007f] shadow-[0_0_15px_rgba(255,0,127,0.8)] scale-110" : "bg-white/10"
                  )} />
                ))}
              </div>

              {/* TECLADO */}
              <form onSubmit={handleManualSubmit}>
                {/* Fallback de input oculto para autocompletado o teclados físicos */}
                <input 
                  type="password" 
                  value={pin} 
                  onChange={e => setPin(e.target.value)}
                  className="opacity-0 absolute h-0 w-0 pointer-events-none"
                  autoFocus
                />
                
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleNumberClick(num.toString())}
                      className="h-16 rounded-2xl bg-white/5 border border-white/10 text-white text-2xl font-black hover:bg-white/10 hover:border-[#ff007f]/50 active:bg-[#ff007f]/20 active:scale-95 transition-all"
                    >
                      {num}
                    </button>
                  ))}
                  
                  {/* Cero y acciones */}
                  <button
                    type="button"
                    onClick={handleBackspace}
                    disabled={pin.length === 0}
                    className="h-16 rounded-2xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center disabled:opacity-30"
                  >
                    Borrar
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handleNumberClick('0')}
                    className="h-16 rounded-2xl bg-white/5 border border-white/10 text-white text-2xl font-black hover:bg-white/10 hover:border-[#ff007f]/50 active:bg-[#ff007f]/20 active:scale-95 transition-all"
                  >
                    0
                  </button>
                  
                  <button
                    type="submit"
                    disabled={isLoading || pin.length === 0}
                    className="h-16 rounded-2xl bg-[#ff007f] text-white hover:bg-[#ff007f]/80 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 shadow-[0_0_20px_rgba(255,0,127,0.3)]"
                  >
                    {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-6 h-6" />}
                  </button>
                </div>
              </form>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const result = await login(email, password);
    if (result.success) {
      setTimeout(() => onLoginSuccess(), 100);
    } else {
      setError(result.error || 'Error al iniciar sesión');
    }
    setIsLoading(false);
  };

  return (
    <div className="h-screen w-full flex items-center justify-center p-4 relative overflow-hidden"
         style={{ background: 'linear-gradient(90deg, #1a0533 0%, #0c1a3a 30%, #0a1628 55%, #1a0a2e 80%, #2d0a1a 100%)' }}>

      {/* Glows horizontales de fondo */}
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'linear-gradient(90deg, rgba(109,40,217,0.28) 0%, transparent 45%)' }} />
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'linear-gradient(90deg, transparent 55%, rgba(255,0,127,0.22) 100%)' }} />
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(30,58,138,0.15) 0%, transparent 65%)' }} />

      {/* ── WRAPPER con luz que recorre el borde ── */}
      <div className="relative z-10 w-full max-w-lg"
           style={{ padding: '2px', borderRadius: '1.5rem', overflow: 'hidden' }}>

        {/* Elemento rotatorio — ocupa 200% centrado para cubrir todo el perímetro */}
        <div style={{
          position: 'absolute',
          width: '200%',
          height: '200%',
          top: '-50%',
          left: '-50%',
          background: 'conic-gradient(from 0deg, transparent 0deg, #ff007f 15deg, #ffffff 20deg, #ff007f 25deg, transparent 40deg, transparent 360deg)',
          animation: 'borderSpin 3s linear infinite',
        }} />

        {/* Card glassmorphism — tapa el centro, deja solo 2px de borde */}
        <div className="relative rounded-3xl px-8 py-5 sm:px-10 sm:py-7"
             style={{
               background: 'linear-gradient(135deg, rgba(15,12,35,0.95) 0%, rgba(10,18,40,0.95) 100%)',
               backdropFilter: 'blur(24px)',
               WebkitBackdropFilter: 'blur(24px)',
             }}>

          {/* ── LOGO + NOMBRE ── */}
          <div className="flex flex-col items-center mb-3">

            {/* Anillos orbitales */}
            <div className="relative flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32 mb-3">

              {/* Anillo exterior */}
              <div className="absolute inset-0 rounded-full border border-[#ff007f]/35 animate-spin"
                   style={{ animationDuration: '12s' }}>
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#ff007f] shadow-[0_0_16px_rgba(255,0,127,1)]" />
              </div>

              {/* Anillo interior inverso */}
              <div className="absolute rounded-full border border-violet-400/30"
                   style={{ animation: 'spin 8s linear infinite reverse', inset: '12%' }}>
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,1)]" />
              </div>

              {/* Tercer anillo medio */}
              <div className="absolute rounded-full border border-fuchsia-500/20"
                   style={{ animation: 'spin 16s linear infinite', inset: '25%' }}>
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-fuchsia-400 shadow-[0_0_10px_rgba(232,121,249,0.9)]" />
              </div>

              {/* Glow central */}
              <div className="absolute rounded-full animate-pulse"
                   style={{ inset: '15%', background: 'radial-gradient(circle, rgba(255,0,127,0.2) 0%, transparent 70%)', filter: 'blur(8px)' }} />

              {/* Logo */}
              <div className="absolute rounded-full border-2 border-white/15 overflow-hidden p-3"
                   style={{
                     inset: '14%',
                     background: 'rgba(10,12,30,0.92)',
                     backdropFilter: 'blur(12px)',
                     boxShadow: '0 0 40px rgba(255,0,127,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                   }}>
                <img
                  src="/logo.png"
                  alt="Dulce Placer"
                  className="w-full h-full object-contain"
                  style={{ animation: 'logoFloat 4s ease-in-out infinite' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            </div>

            {/* Nombre */}
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-none text-center">
              Dulce <span className="text-[#ff007f]">Placer</span>
            </h1>
            <p className="text-slate-400 text-xs mt-1 text-center tracking-wide">
              Sistema de Gestión de Panadería
            </p>

            {/* Indicador online */}
            <div className="flex items-center gap-2 mt-2 px-3 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              <span className="text-[10px] font-black text-emerald-400 tracking-widest uppercase">Sistema en línea</span>
            </div>
          </div>

          {/* Divisor */}
          <div className="h-px w-full mb-4"
               style={{ background: 'linear-gradient(90deg, transparent, rgba(255,0,127,0.4), rgba(124,58,237,0.4), transparent)' }} />

          {/* ── FORMULARIO ── */}
          <form onSubmit={handleSubmit} className="space-y-3">

            {error && (
              <Alert variant="destructive" className="bg-red-500/10 border-red-500/30 text-red-300 rounded-xl">
                <AlertDescription>
                  <span className="font-bold block">Error de Acceso</span>
                  <span className="text-sm">{error}</span>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                Correo electrónico
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white/[0.06] border-white/10 text-white placeholder:text-slate-600
                           rounded-xl h-12 px-4 text-base
                           focus:border-[#ff007f]/60 focus:bg-white/[0.09]
                           transition-all duration-200"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-white/[0.06] border-white/10 text-white placeholder:text-slate-600
                             rounded-xl h-12 px-4 pr-12 text-base
                             focus:border-[#ff007f]/60 focus:bg-white/[0.09]
                             transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1.5 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 mt-2
                         bg-[#ff007f] hover:bg-[#ff007f]/90 active:scale-[0.98]
                         text-white text-base font-black rounded-xl
                         shadow-[0_0_30px_rgba(255,0,127,0.45),0_4px_20px_rgba(255,0,127,0.25)]
                         hover:shadow-[0_0_45px_rgba(255,0,127,0.6)]
                         transition-all duration-200 border-0"
            >
              {isLoading ? (
                <span className="flex items-center gap-2.5">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verificando...
                </span>
              ) : 'Entrar al Sistema'}
            </Button>

            {import.meta.env.DEV && (
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  setEmail('Chalo8321@gmail.com');
                  setPassword('dev-bypass'); // Esto solo sirve para disparar la función, corregiremos el login local para aceptarlo
                  setIsLoading(true);
                  // Forzamos el login directo
                  const result = await login('Chalo8321@gmail.com', 'bypass'); 
                  if (result.success) onLoginSuccess();
                  setIsLoading(false);
                }}
                className="w-full h-10 mt-4 border-amber-500/50 text-amber-500 hover:bg-amber-500/10 font-bold text-xs uppercase tracking-widest rounded-xl"
              >
                ⚡ ACCESO RÁPIDO (MODO DEV)
              </Button>
            )}
          </form>

          <p className="text-slate-600 text-xs text-center mt-4">
            © 2026 Panadería Dulce Placer —{' '}
            <span className="text-[#ff007f]/40 italic">Sistema Premium 100% Offline</span>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0px) scale(1); }
          50%       { transform: translateY(-7px) scale(1.05); }
        }
        @keyframes borderSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
      console.log('✅ Login exitoso, redirigiendo...');
      // Pequeño retardo para asegurar que el estado de AuthContext se propague
      setTimeout(() => {
        onLoginSuccess();
      }, 100);
    } else {
      console.error('Detalles del error de login:', result.error);
      setError(result.error || 'Error al iniciar sesión');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Deep con LOGO 2 MONUMENTAL TRASLÚCIDO */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-slate-950" />

      <div className="absolute inset-0 flex items-center justify-center opacity-[0.08] pointer-events-none overflow-hidden">
        <img
          src="/logo.png"
          alt="Watermark"
          className="w-[250%] sm:w-[150%] md:w-[1200px] h-auto object-contain"
          style={{ filter: 'brightness(1.5) blur(2px)' }}
        />
      </div>

      <div className="w-full max-w-5xl relative z-10 flex flex-col items-center">
        {/* Icono Circular Superior */}
        <div className="mb-6 animate-ag-slide-down stagger-1 relative group">
          <div className="absolute inset-0 bg-[#ff007f]/20 blur-3xl rounded-full scale-150 group-hover:bg-[#ff007f]/30 transition-all duration-700" />
          <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full border-2 border-white/20 p-1 bg-slate-900/50 backdrop-blur-xl shadow-[0_0_30px_rgba(255,0,127,0.2)] overflow-hidden">
            <img
              src="/logo.png"
              alt="Logo Circular"
              className="w-full h-full object-contain rounded-full transform group-hover:scale-110 transition-transform duration-500"
            />
          </div>
        </div>

        {/* Login Card - AUTO-AJUSTABLE (Celular, Tablet, PC) */}
        <div className="animate-ag-slide-up stagger-2 w-full max-w-[95%] sm:max-w-[450px] md:max-w-md mx-auto flex-none group">
          <Card className="border-0 shadow-none bg-black/40 md:bg-transparent backdrop-blur-2xl md:backdrop-blur-md border border-[#b5936d]/40 overflow-hidden relative transition-all duration-500 hover:bg-white/[0.02] hover:border-[#b5936d]/60">
            {/* Top Glow Line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#b5936d]/50 to-transparent" />

            <CardHeader className="space-y-2 pb-6 pt-8 md:pt-6">
              <CardTitle className="text-3xl md:text-2xl text-center text-white font-black tracking-tight">Iniciar Sesión</CardTitle>
              <CardDescription className="text-base md:text-sm text-center text-slate-300 md:text-slate-400 px-4">
                Ingresa tus credenciales para acceder al sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="space-y-3">
                    <Alert variant="destructive" className="bg-red-500/10 border-red-500/30 text-red-300">
                      <AlertDescription className="flex flex-col gap-2">
                        <span className="font-bold">Error de Acceso</span>
                        <span>{error}</span>
                      </AlertDescription>
                    </Alert>

                  </div>
                )}

                <div className="space-y-3">
                  <Label htmlFor="email" className="text-lg md:text-sm text-slate-200 md:text-slate-300 font-bold md:font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-14 md:h-12 bg-white/[0.04] md:bg-transparent border-white/20 text-white text-lg md:text-base placeholder:text-slate-500 rounded-xl transition-ag"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="password" className="text-lg md:text-sm text-slate-200 md:text-slate-300 font-bold md:font-medium">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-14 md:h-12 bg-white/[0.04] md:bg-transparent border-white/20 text-white text-lg md:text-base placeholder:text-slate-500 rounded-xl pr-12 transition-ag"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 p-2"
                    >
                      {showPassword ? <EyeOff className="w-6 h-6 md:w-5 md:h-5" /> : <Eye className="w-6 h-6 md:w-5 md:h-5" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-14 md:h-12 bg-[#ff007f] hover:bg-[#ff007f]/90 text-white text-xl md:text-base font-black rounded-xl shadow-[0_0_20px_rgba(255,0,127,0.3)] transition-all active:scale-95 mt-4"
                  disabled={isLoading}
                >
                  {isLoading ? 'Cargando...' : 'Entrar al Sistema'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Footer Responsivo */}
        <div className="flex flex-col items-center gap-4 mt-8 px-6 text-center animate-ag-fade-in stagger-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span className="text-[10px] md:text-xs font-black text-emerald-400 tracking-widest uppercase">
              Servidor Local Detectado (WiFi)
            </span>
          </div>

          <p className="text-slate-500 text-sm font-medium">
            © 2026 Panaderia Dulce Placer. <br className="md:hidden" />
            <span className="text-[#ff007f]/50 italic">Sistema Premium 100% Offline.</span>
          </p>
        </div>
      </div>
    </div>
  );
}

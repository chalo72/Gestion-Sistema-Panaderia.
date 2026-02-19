import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingUp, Eye, EyeOff, Users } from 'lucide-react';
import { ROLE_DESCRIPTIONS, USUARIOS_PRUEBA, CREDENCIALES_PRUEBA } from '@/types';

interface LoginProps {
  onLoginSuccess: () => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDemoUsers, setShowDemoUsers] = useState(false);

  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(email, password);

    if (result.success) {
      onLoginSuccess();
    } else {
      setError(result.error || 'Error al iniciar sesión');
    }

    setIsLoading(false);
  };

  const fillDemoCredentials = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(CREDENCIALES_PRUEBA[demoEmail]);
    setShowDemoUsers(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Floating Orbs */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl animate-ag-orb" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl animate-ag-orb" style={{ animationDelay: '2s' }} />
      <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-purple-600/8 rounded-full blur-3xl animate-ag-orb" style={{ animationDelay: '4s' }} />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8 animate-ag-slide-up">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 kpi-blue shadow-2xl shadow-blue-600/30 animate-ag-float">
            <TrendingUp className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">
            PriceControl <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Pro</span>
          </h1>
          <p className="text-slate-400 mt-2 text-base">Sistema de Gestión de Precios & Proveedores</p>
        </div>

        {/* Login Card */}
        <div className="animate-ag-slide-up stagger-2">
          <Card className="border-0 shadow-2xl bg-white/[0.07] backdrop-blur-2xl border border-white/10 overflow-hidden relative">
            {/* Top Glow Line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />

            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl text-center text-white font-bold">Iniciar Sesión</CardTitle>
              <CardDescription className="text-center text-slate-400">
                Ingresa tus credenciales para acceder al sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <Alert variant="destructive" className="bg-red-500/10 border-red-500/30 text-red-300">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300 font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 bg-white/[0.06] border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/20 rounded-xl transition-ag"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-300 font-medium">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-12 bg-white/[0.06] border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/20 rounded-xl pr-12 transition-ag"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-ag p-1 rounded-lg hover:bg-white/[0.06]"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold btn-gradient-primary rounded-xl"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Iniciando sesión...
                    </span>
                  ) : 'Iniciar Sesión'}
                </Button>
              </form>

              {/* Demo Users Toggle */}
              <div className="mt-6 pt-6 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowDemoUsers(!showDemoUsers)}
                  className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 w-full justify-center transition-ag"
                >
                  <Users className="w-4 h-4" />
                  {showDemoUsers ? 'Ocultar usuarios de prueba' : 'Ver usuarios de prueba'}
                </button>

                {showDemoUsers && (
                  <div className="mt-4 space-y-2 animate-ag-fade-in">
                    <p className="text-xs text-slate-500 text-center mb-3">
                      Todos tienen contraseña: <strong className="text-slate-400">password123</strong>
                    </p>
                    {USUARIOS_PRUEBA.map((user, i) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => fillDemoCredentials(user.email)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] hover:bg-white/[0.06] transition-ag text-left animate-ag-fade-in stagger-${i + 1}`}
                      >
                        <div
                          className="w-3 h-3 rounded-full shadow-lg"
                          style={{
                            backgroundColor: ROLE_DESCRIPTIONS[user.rol].color,
                            boxShadow: `0 0 10px ${ROLE_DESCRIPTIONS[user.rol].color}50`
                          }}
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm text-white">{user.nombre} {user.apellido}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                        <span
                          className="text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{
                            backgroundColor: `${ROLE_DESCRIPTIONS[user.rol].color}20`,
                            color: ROLE_DESCRIPTIONS[user.rol].color
                          }}
                        >
                          {ROLE_DESCRIPTIONS[user.rol].nombre}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-sm mt-8 animate-ag-fade-in stagger-4">
          © 2026 PriceControl Pro. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}

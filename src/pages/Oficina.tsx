import { useState } from 'react';
import { MessageCircle, Monitor, Coffee, Building2, Pin, Send, Users, Star, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/types';

interface OficinaProps {
  publicAppUrl?: string;
}

const ROLE_CONFIG: Record<UserRole, { label: string; emoji: string; color: string; bg: string; deskColor: string }> = {
  ADMIN:     { label: 'Administrador', emoji: '👑', color: 'text-purple-700', bg: 'bg-purple-100 border-purple-300', deskColor: 'from-purple-50 to-purple-100' },
  GERENTE:   { label: 'Gerente',       emoji: '💼', color: 'text-blue-700',   bg: 'bg-blue-100 border-blue-300',   deskColor: 'from-blue-50 to-blue-100'   },
  COMPRADOR: { label: 'Comprador',     emoji: '🛒', color: 'text-green-700',  bg: 'bg-green-100 border-green-300', deskColor: 'from-green-50 to-green-100' },
  VENDEDOR:  { label: 'Vendedor',      emoji: '💰', color: 'text-orange-700', bg: 'bg-orange-100 border-orange-300',deskColor: 'from-orange-50 to-orange-100'},
  PANADERO:  { label: 'Panadero',      emoji: '🍞', color: 'text-amber-700',  bg: 'bg-amber-100 border-amber-300', deskColor: 'from-amber-50 to-amber-100' },
  AUXILIAR:  { label: 'Auxiliar',      emoji: '🔧', color: 'text-gray-700',   bg: 'bg-gray-100 border-gray-300',   deskColor: 'from-gray-50 to-gray-100'   },
};

const ANUNCIOS_INICIALES = [
  { id: 1, autor: 'Sistema', texto: 'Bienvenidos a la Oficina Central de Dulce Placer 🎉', hora: 'Hoy' },
];

export default function Oficina({ publicAppUrl }: OficinaProps) {
  const { usuarios } = useAuth();
  const [anuncios, setAnuncios] = useState(ANUNCIOS_INICIALES);
  const [nuevoAnuncio, setNuevoAnuncio] = useState('');
  const [onlineIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    usuarios.slice(0, Math.ceil(usuarios.length / 2)).forEach(u => ids.add(u.id));
    return ids;
  });

  const appUrl = publicAppUrl || window.location.origin;

  const handleShareWhatsApp = (nombre: string, email: string, rol: UserRole) => {
    const config = ROLE_CONFIG[rol] || ROLE_CONFIG.AUXILIAR;
    const passwords = JSON.parse(localStorage.getItem('pricecontrol_role_passwords') || '{}');
    const password = passwords[rol] || 'Pendiente asignar';
    const mensaje = `🌟 *DULCE PLACER - ACCESO PERSONAL* 🌟\n\nHola *${nombre}* ${config.emoji}, aquí tienes tus credenciales:\n\n🔗 *App:* ${appUrl}\n📧 *Usuario:* ${email}\n🔑 *Tu Clave:* ${password}\n\n⚠️ No compartas estas credenciales.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
    toast.success(`Mensaje enviado a ${nombre}`);
  };

  const handleAnuncioGeneral = () => {
    if (!nuevoAnuncio.trim()) return;
    const mensaje = `📢 *ANUNCIO - DULCE PLACER*\n\n${nuevoAnuncio.trim()}\n\n🔗 App: ${appUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
    setAnuncios(prev => [{ id: Date.now(), autor: 'Tú', texto: nuevoAnuncio.trim(), hora: 'Ahora' }, ...prev]);
    setNuevoAnuncio('');
    toast.success('Anuncio enviado al equipo');
  };

  const usuariosActivos = usuarios.filter(u => u.activo !== false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 p-4 md:p-6">

      {/* Header — letrero de oficina */}
      <div className="relative mb-8 rounded-2xl overflow-hidden shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900" />
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%)', backgroundSize: '8px 8px' }} />
        <div className="relative flex items-center gap-4 px-6 py-5">
          <div className="p-3 bg-amber-700 rounded-xl shadow-inner">
            <Building2 className="w-8 h-8 text-amber-200" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-amber-100 tracking-wide">
              OFICINA CENTRAL
            </h1>
            <p className="text-amber-300 font-semibold text-sm tracking-widest uppercase">
              Panadería Dulce Placer — Equipo de Trabajo
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 bg-amber-700/50 px-4 py-2 rounded-xl">
            <Users className="w-5 h-5 text-amber-200" />
            <span className="text-amber-100 font-bold text-lg">{usuariosActivos.length}</span>
            <span className="text-amber-300 text-sm">agentes</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Planta de la oficina — escritorios */}
        <div className="xl:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Monitor className="w-5 h-5 text-amber-700" />
            <h2 className="font-bold text-amber-900 text-lg">Planta de Escritorios</h2>
            <div className="flex-1 h-px bg-amber-200 ml-2" />
          </div>

          {usuariosActivos.length === 0 ? (
            <div className="text-center py-16 text-amber-600">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No hay agentes registrados aún.</p>
              <p className="text-sm mt-1">Agrega usuarios desde el módulo Equipo de Trabajo.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {usuariosActivos.map((usuario) => {
                const rol = (usuario.rol as UserRole) || 'AUXILIAR';
                const config = ROLE_CONFIG[rol] || ROLE_CONFIG.AUXILIAR;
                const isOnline = onlineIds.has(usuario.id);

                return (
                  <div
                    key={usuario.id}
                    className={`relative rounded-2xl border-2 bg-gradient-to-b ${config.deskColor} shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden`}
                  >
                    {/* Borde superior decorativo — superficie del escritorio */}
                    <div className="h-2 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-300" />

                    {/* Indicador online */}
                    <div className="absolute top-4 right-4 flex items-center gap-1">
                      {isOnline
                        ? <><Wifi className="w-3.5 h-3.5 text-green-500" /><span className="text-xs text-green-600 font-semibold">Online</span></>
                        : <><WifiOff className="w-3.5 h-3.5 text-gray-400" /><span className="text-xs text-gray-400">Offline</span></>
                      }
                    </div>

                    <div className="p-4 pt-3">
                      {/* Avatar + nombre */}
                      <div className="flex flex-col items-center text-center mb-3 mt-1">
                        <div className="text-4xl mb-2 drop-shadow">{config.emoji}</div>
                        <h3 className="font-black text-gray-800 text-base leading-tight">
                          {usuario.nombre} {usuario.apellido || ''}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5 truncate w-full">{usuario.email}</p>
                        <Badge className={`mt-2 text-xs font-bold border ${config.bg} ${config.color}`}>
                          {config.label}
                        </Badge>
                      </div>

                      {/* Monitor decorativo */}
                      <div className="mx-auto w-16 h-10 bg-gray-200 rounded-t-md border-2 border-gray-300 flex items-center justify-center mb-1">
                        <div className="w-12 h-7 bg-gray-700 rounded-sm flex items-center justify-center">
                          <Star className="w-3 h-3 text-amber-400" />
                        </div>
                      </div>
                      <div className="mx-auto w-8 h-1.5 bg-gray-300 rounded-b mb-3" />

                      {/* Botón WhatsApp */}
                      <Button
                        size="sm"
                        className="w-full bg-green-500 hover:bg-green-600 text-white text-xs font-bold gap-1.5 shadow"
                        onClick={() => handleShareWhatsApp(
                          `${usuario.nombre} ${usuario.apellido || ''}`.trim(),
                          usuario.email,
                          rol
                        )}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Enviar acceso
                      </Button>
                    </div>

                    {/* Base del escritorio */}
                    <div className="h-1.5 bg-gradient-to-r from-amber-200 via-amber-300 to-amber-200" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel derecho — Tablón de anuncios */}
        <div className="space-y-5">

          {/* Enviar anuncio general */}
          <div className="rounded-2xl bg-white border-2 border-amber-200 shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 flex items-center gap-2">
              <Send className="w-4 h-4 text-white" />
              <span className="font-bold text-white text-sm">Anuncio General al Equipo</span>
            </div>
            <div className="p-4 space-y-3">
              <Textarea
                placeholder="Escribe un anuncio para todo el equipo..."
                value={nuevoAnuncio}
                onChange={e => setNuevoAnuncio(e.target.value)}
                className="text-sm resize-none border-amber-200 focus:border-amber-400 min-h-[80px]"
              />
              <Button
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold gap-2"
                onClick={handleAnuncioGeneral}
                disabled={!nuevoAnuncio.trim()}
              >
                <MessageCircle className="w-4 h-4" />
                Enviar por WhatsApp
              </Button>
            </div>
          </div>

          {/* Tablón de anuncios — corcho */}
          <div className="rounded-2xl overflow-hidden shadow-md">
            <div className="bg-amber-800 px-4 py-3 flex items-center gap-2">
              <Pin className="w-4 h-4 text-amber-200" />
              <span className="font-bold text-amber-100 text-sm">Tablón de Anuncios</span>
            </div>
            <div
              className="p-4 space-y-3 min-h-[200px]"
              style={{ background: 'repeating-linear-gradient(0deg, #d97706 0px, #b45309 1px, #fbbf24 1px, #fde68a 28px)' }}
            >
              {anuncios.map(a => (
                <div key={a.id} className="relative bg-yellow-100 rounded-lg p-3 shadow-md border border-yellow-300 rotate-[-0.5deg] hover:rotate-0 transition-transform">
                  <div className="absolute -top-2 left-4 w-3 h-3 rounded-full bg-red-500 shadow" />
                  <p className="text-xs text-gray-700 font-medium leading-snug">{a.texto}</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-400 font-semibold">{a.autor}</span>
                    <span className="text-xs text-gray-400">{a.hora}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Zona de descanso */}
          <div className="rounded-2xl bg-white border-2 border-amber-200 shadow-md p-4 flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-xl">
              <Coffee className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <p className="font-bold text-amber-900 text-sm">Sala de Descanso</p>
              <p className="text-xs text-amber-600">El equipo es lo más importante 🍞</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

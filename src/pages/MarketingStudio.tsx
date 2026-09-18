import React, { useState, useRef } from 'react';
import { Bot, Sparkles, Image as ImageIcon, Copy, CheckCircle2, Megaphone, Target, TrendingUp, UserCircle, MapPin, Send, Instagram, PlaySquare, FileText, ShoppingBag, Radar, Upload, RefreshCw, MessageCircle, Check, Share2, Facebook, Video, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { consultarAgente } from '@/constants/agentes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCan } from '@/contexts/AuthContext';
import { publicarEnRedSocial } from '@/lib/marketing-api';
import { scrapeViralTrends, type TrendVideo } from '@/lib/viral-scraper';
import type { Producto } from '@/types';

const STRATEGIES = [
  { id: 'prueba-social', label: '🔥 Prueba Social (Alta Demanda)', desc: 'Demuestra que estás vendiendo mucho para generar FOMO.' },
  { id: 'antojo', label: '🍰 Antojo Irresistible', desc: 'Enfócate en la textura, el sabor y los sentidos.' },
  { id: 'promocion', label: '💸 Promoción Especial (Mover Inventario)', desc: 'Oferta local urgente para acelerar ventas hoy.' },
  { id: 'avatar-andrea', label: '👱‍♀️ Avatar Andrea (Marca Personal)', desc: 'Guion para que Andrea (o su avatar) enseñe o recomiende algo.' },
  { id: 'local-viral', label: '📍 Local Viral (Dulce Placer)', desc: 'Contenido diseñado para que los vecinos compartan y visiten el local.' }
];

interface Props {
  productos?: Producto[];
}

export default function MarketingStudio({ productos = [] }: Props) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [viralTrends, setViralTrends] = useState<TrendVideo[]>([]);
  const [isPublishing, setIsPublishing] = useState<Record<string, boolean>>({});

  const handleScrapeTrends = async () => {
    setIsScraping(true);
    try {
      const trends = await scrapeViralTrends(['reposteria', 'panaderia', 'pasteleria']);
      setViralTrends(trends);
      toast.success(`Se encontraron ${trends.length} videos virales.`);
    } catch (error) {
      toast.error('Error al conectar con el servidor MCP de Puppeteer.');
    } finally {
      setIsScraping(false);
    }
  };
  const [selectedStrategy, setSelectedStrategy] = useState(STRATEGIES[0].id);
  const [selectedProductId, setSelectedProductId] = useState<string>('ninguno');
  const [generatedContent, setGeneratedContent] = useState('');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePublish = async (redSocial: 'WHATSAPP' | 'INSTAGRAM' | 'TIKTOK' | 'AVATAR', texto: string) => {
    try {
      setIsPublishing(prev => ({ ...prev, [redSocial]: true }));
      await publicarEnRedSocial({
        redSocial,
        texto,
        imagenUrl: imagePreview,
        estrategia: selectedStrategy
      });
      toast.success(`¡Enviado a ${redSocial} con éxito! 🚀`);
    } catch (error) {
      toast.error('Error al conectar con la red social. ¿Configuraste el Webhook?');
    } finally {
      setIsPublishing(prev => ({ ...prev, [redSocial]: false }));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        toast.error('La imagen es muy pesada. Máximo 4MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedContent('');
    
    const estrategia = STRATEGIES.find(s => s.id === selectedStrategy);
    const productoObj = productos.find(p => p.id === selectedProductId);
    const nombreProducto = productoObj ? productoObj.nombre : 'mi producto de panadería/repostería';
    
    let baseContext = `Actúa como un experto copywriter de marketing gastronómico y director creativo. `;
    
    if (selectedStrategy === 'avatar-andrea') {
      baseContext += `El objetivo es posicionar la marca personal de "Andrea Cadena", dueña y repostera experta de Dulce Placer. `;
    } else {
      baseContext += `El objetivo es impulsar las ventas locales de la "Panadería Dulce Placer". `;
    }

    baseContext += `La estrategia a usar es "${estrategia?.label}". El producto estrella de esta campaña es: ${nombreProducto}. `;

    if (imagePreview) {
      baseContext += `He subido una foto de referencia. Úsala para inspirarte en los colores, texturas y formas visuales. `;
    }

    if (viralTrends.length > 0) {
      baseContext += `\nIMPORTANTE - TENDENCIAS VIRALES ACTUALES:\nEl navegador fantasma ha detectado que los siguientes videos están virales ahora mismo en TikTok y YouTube Shorts:\n`;
      viralTrends.forEach(trend => {
        baseContext += `- Título: "${trend.titulo}" (${trend.vistas} vistas). Ángulo/Guion: "${trend.guionExtraido}"\n`;
      });
      baseContext += `Por favor, INSPÍRATE en estos ángulos virales, adapta su psicología y ganchos (hooks) al producto "${nombreProducto}", pero dándole la identidad de Dulce Placer.\n`;
    }

    const prompt = `${baseContext}

Genera un plan de contenidos directo y persuasivo con esta estructura EXACTA:

[INSTAGRAM]
(Texto para Instagram y Facebook enfocado en atraer público local. Incluye emojis, hashtags locales y un Call to Action claro para visitar el local o pedir a domicilio)

[WHATSAPP]
(Texto muy corto, cercano y urgente para subir a Estados de WhatsApp o enviar a clientes frecuentes. Debe generar hambre y urgencia)

[TIKTOK_VIRAL]
(Guion exacto para un video corto de 15 a 30 segundos. Formato: Gancho de 3 segundos + Desarrollo + Cierre. Especifíca qué se debe mostrar en cámara en cada segundo)

[AVATAR_PROMPT]
(Un guion de texto exacto para que Andrea, o su Avatar de Inteligencia Artificial, lo lea frente a cámara. Debe sonar natural, experto y empático. Además incluye una breve dirección de arte: cómo debería estar vestida o qué actitud debe tener)`;

    try {
      let accumulatedText = '';
      await consultarAgente('influencer', prompt, (chunk) => {
        accumulatedText += chunk;
        setGeneratedContent(accumulatedText);
      }, imagePreview || undefined);
      toast.success('¡Campaña 360° generada con éxito!');
    } catch (error) {
      toast.error('Hubo un error generando la campaña.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    toast.success('Copiado al portapapeles');
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const parseContent = (content: string) => {
    const sections: Record<string, string> = {};
    const parts = content.split(/\[(INSTAGRAM|WHATSAPP|TIKTOK_VIRAL|AVATAR_PROMPT)\]/i);
    let currentKey = 'OTROS';
    parts.forEach(part => {
      const match = part.toUpperCase().trim();
      if (['INSTAGRAM', 'WHATSAPP', 'TIKTOK_VIRAL', 'AVATAR_PROMPT'].includes(match)) {
        currentKey = match;
      } else if (part.trim()) {
        sections[currentKey] = (sections[currentKey] || '') + part.trim();
      }
    });
    return sections;
  };

  const sections = generatedContent ? parseContent(generatedContent) : {};

  // Solo mostramos productos elaborados, no ingredientes
  const productosFinales = productos.filter(p => p.tipo !== 'ingrediente').sort((a,b) => a.nombre.localeCompare(b.nombre));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in zoom-in-95 duration-500 pb-32">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-500 border border-fuchsia-500/20">
              <Megaphone className="w-6 h-6" />
            </div>
            Marketing Studio 360°
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Motor de crecimiento local para Dulce Placer y construcción de marca personal para Andrea.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-6">
          
          {/* SELECCIÓN DE PRODUCTO */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-500" /> 1. ¿Qué vamos a impulsar?
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Selecciona un producto de tu inventario (Opcional)</Label>
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="w-full bg-slate-50 dark:bg-slate-900 h-11 border-slate-200 dark:border-slate-800">
                    <SelectValue placeholder="Elige un producto..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguno">-- Campaña de Marca (General) --</SelectItem>
                    {productosFinales.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* RADAR VIRAL MCP */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Radar className="w-4 h-4 text-violet-500" /> Radar Viral (Navegador Fantasma)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <Button 
                onClick={handleScrapeTrends} 
                disabled={isScraping} 
                variant="outline" 
                className="w-full text-xs font-bold border-violet-200 hover:bg-violet-50 hover:text-violet-700 dark:border-violet-900 dark:hover:bg-violet-900/20"
              >
                {isScraping ? <><Radar className="w-4 h-4 mr-2 animate-spin text-violet-500" /> Escaneando TikTok y YouTube...</> : <><Radar className="w-4 h-4 mr-2 text-violet-500" /> Escanear Tendencias de Repostería</>}
              </Button>
              
              {viralTrends.length > 0 && (
                <div className="space-y-3 mt-3">
                  {viralTrends.map(trend => (
                    <div key={trend.id} className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{trend.titulo}</span>
                        <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded font-black">{trend.vistas}</span>
                      </div>
                      <p className="text-slate-500 italic">"{trend.guionExtraido}"</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ESTRATEGIA */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-fuchsia-500" /> 2. Elige el Enfoque (Ángulo)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {STRATEGIES.map(strategy => (
                <div key={strategy.id} onClick={() => setSelectedStrategy(strategy.id)} className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedStrategy === strategy.id ? 'border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-900/20' : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}>
                  <h3 className={`text-sm font-bold ${selectedStrategy === strategy.id ? 'text-fuchsia-600 dark:text-fuchsia-400' : 'text-slate-700 dark:text-slate-300'}`}>{strategy.label}</h3>
                  <p className="text-xs text-slate-500 mt-1">{strategy.desc}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* FOTO (OPCIONAL) */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-500" /> 3. Referencia Visual (Opcional)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
              {!imagePreview ? (
                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                    <Upload className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Sube una foto del producto</p>
                  <p className="text-[10px] text-slate-500 mt-1">Ayuda a la IA a describir los detalles</p>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden group">
                  <img src={imagePreview} alt="Preview" className="w-full h-auto object-cover max-h-48 rounded-xl" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Button onClick={() => fileInputRef.current?.click()} variant="secondary" size="sm" className="gap-2">
                      <RefreshCw className="w-4 h-4" /> Cambiar foto
                    </Button>
                  </div>
                </div>
              )}
              
              <Button onClick={handleGenerate} disabled={isGenerating} className="w-full h-12 mt-6 bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white shadow-lg shadow-fuchsia-500/25 font-black uppercase tracking-wider text-xs">
                {isGenerating ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Creando Campaña...</> : <><Sparkles className="w-4 h-4 mr-2" /> Generar Campaña 360°</>}
              </Button>
            </CardContent>
          </Card>

        </div>

        <div className="lg:col-span-8">
          <Card className="h-full border-slate-200 dark:border-slate-800 shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl min-h-[600px]">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between py-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" /> Resultados de la Campaña
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {!generatedContent ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 py-24">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Megaphone className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Selecciona el producto y presiona Generar.</p>
                    <p className="text-xs max-w-sm mx-auto">Crearé los textos virales para TikTok, WhatsApp y los guiones para el avatar de Andrea de forma automática.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* WHATSAPP */}
                  {sections['WHATSAPP'] && (
                    <div className="space-y-2 animate-in slide-in-from-bottom-2">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black tracking-widest text-[10px] uppercase">
                          <MessageCircle className="w-4 h-4" /> 1. Estados de WhatsApp (Venta Rápida)
                        </Label>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleCopy(sections['WHATSAPP'], 'wa')} className="h-8 text-xs gap-1.5">
                            {copiedSection === 'wa' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />} Copiar
                          </Button>
                          <Button 
                            variant="default" 
                            size="sm" 
                            disabled={isPublishing['WHATSAPP']}
                            onClick={() => handlePublish('WHATSAPP', sections['WHATSAPP'])} 
                            className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                          >
                            {isPublishing['WHATSAPP'] ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />} 
                            Auto-Publicar
                          </Button>
                        </div>
                      </div>
                      <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/50 whitespace-pre-wrap text-sm text-emerald-900 dark:text-emerald-300 font-medium">
                        {sections['WHATSAPP']}
                      </div>
                    </div>
                  )}

                  {/* INSTAGRAM */}
                  {sections['INSTAGRAM'] && (
                    <div className="space-y-2 animate-in slide-in-from-bottom-2" style={{ animationDelay: '100ms' }}>
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-pink-600 dark:text-pink-400 font-black tracking-widest text-[10px] uppercase">
                          <Instagram className="w-4 h-4" /> 2. Post Instagram & Facebook (Local)
                        </Label>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleCopy(sections['INSTAGRAM'], 'ig')} className="h-8 text-xs gap-1.5">
                            {copiedSection === 'ig' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />} Copiar
                          </Button>
                          <Button 
                            variant="default" 
                            size="sm" 
                            disabled={isPublishing['INSTAGRAM']}
                            onClick={() => handlePublish('INSTAGRAM', sections['INSTAGRAM'])} 
                            className="h-8 text-xs gap-1.5 bg-pink-600 hover:bg-pink-700"
                          >
                            {isPublishing['INSTAGRAM'] ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Facebook className="w-3.5 h-3.5" />} 
                            Auto-Publicar
                          </Button>
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                        {sections['INSTAGRAM']}
                      </div>
                    </div>
                  )}

                  {/* TIKTOK VIRAL */}
                  {sections['TIKTOK_VIRAL'] && (
                    <div className="space-y-2 animate-in slide-in-from-bottom-2" style={{ animationDelay: '200ms' }}>
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-slate-900 dark:text-white font-black tracking-widest text-[10px] uppercase">
                          <Video className="w-4 h-4" /> 3. Guion TikTok / Reels Viral
                        </Label>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleCopy(sections['TIKTOK_VIRAL'], 'tk')} className="h-8 text-xs gap-1.5">
                            {copiedSection === 'tk' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />} Copiar
                          </Button>
                          <Button 
                            variant="default" 
                            size="sm" 
                            disabled={isPublishing['TIKTOK']}
                            onClick={() => handlePublish('TIKTOK', sections['TIKTOK_VIRAL'])} 
                            className="h-8 text-xs gap-1.5 bg-slate-900 hover:bg-slate-800 text-white"
                          >
                            {isPublishing['TIKTOK'] ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />} 
                            Mandar a TikTok
                          </Button>
                        </div>
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 italic shadow-inner">
                        {sections['TIKTOK_VIRAL']}
                      </div>
                    </div>
                  )}

                  {/* AVATAR ANDREA */}
                  {sections['AVATAR_PROMPT'] && (
                    <div className="space-y-2 animate-in slide-in-from-bottom-2" style={{ animationDelay: '300ms' }}>
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-fuchsia-600 dark:text-fuchsia-400 font-black tracking-widest text-[10px] uppercase">
                          <User className="w-4 h-4" /> 4. Guion para Avatar (Andrea Cadena)
                        </Label>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleCopy(sections['AVATAR_PROMPT'], 'av')} className="h-8 text-xs gap-1.5">
                            {copiedSection === 'av' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />} Copiar
                          </Button>
                          <Button 
                            variant="default" 
                            size="sm" 
                            disabled={isPublishing['AVATAR']}
                            onClick={() => handlePublish('AVATAR', sections['AVATAR_PROMPT'])} 
                            className="h-8 text-xs gap-1.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white"
                          >
                            {isPublishing['AVATAR'] ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <User className="w-3.5 h-3.5" />} 
                            Enviar a IA Avatar
                          </Button>
                        </div>
                      </div>
                      <div className="bg-fuchsia-50/50 dark:bg-fuchsia-950/20 p-4 rounded-xl border border-fuchsia-200 dark:border-fuchsia-900/50 whitespace-pre-wrap text-sm text-fuchsia-900 dark:text-fuchsia-300 font-medium">
                        {sections['AVATAR_PROMPT']}
                      </div>
                    </div>
                  )}

                  {sections['OTROS'] && (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-xl whitespace-pre-wrap text-sm">
                      {sections['OTROS']}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* FÁBRICA DE VIDEO (PRODUCCIÓN Y N8N) */}
          <Card className="h-auto border-slate-200 dark:border-slate-800 shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl mt-6">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between py-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <PlaySquare className="w-4 h-4 text-rose-500" /> Fábrica de Video Automática (N8N)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* ZONA DE SUBIDA */}
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">1. Sube el Video o Audio Base</Label>
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Arrastra la grabación de Andrea</p>
                    <p className="text-[10px] text-slate-500 mt-1">Soporta .MP4, .MOV, .MP3 (Máx 50MB)</p>
                  </div>
                </div>

                {/* ZONA DE ÓRDENES */}
                <div className="space-y-4">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">2. Órdenes para N8N</Label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded border-slate-300 text-fuchsia-600 focus:ring-fuchsia-600" />
                      <span>Extraer Subtítulos Dinámicos IA</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded border-slate-300 text-fuchsia-600 focus:ring-fuchsia-600" />
                      <span>Generar Portada (Thumbnail) Viral</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded border-slate-300 text-fuchsia-600 focus:ring-fuchsia-600" />
                      <span>Añadir Logo de Dulce Placer</span>
                    </label>
                  </div>
                </div>
              </div>

              <Button 
                disabled={isPublishing['N8N_VIDEO']}
                onClick={() => {
                  toast.success('Enviando video y órdenes a N8N para su procesamiento...');
                }}
                className="w-full h-12 bg-gradient-to-r from-rose-600 to-fuchsia-600 hover:from-rose-500 hover:to-fuchsia-500 text-white shadow-lg shadow-rose-500/25 font-black uppercase tracking-wider text-xs"
              >
                <Sparkles className="w-4 h-4 mr-2" /> Iniciar Edición IA y Publicar Múltiple
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}

import React, { useState, useRef } from 'react';
import { 
  Megaphone, Upload, Sparkles, Image as ImageIcon, Copy, Check, Facebook, Instagram, MessageCircle, Share2, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { consultarAgente } from '@/constants/agentes';

const STRATEGIES = [
  { id: 'prueba-social', label: '🔥 Prueba Social (Alta Demanda)', desc: 'Demuestra que estás vendiendo mucho para generar FOMO.' },
  { id: 'antojo', label: '🍰 Antojo Irresistible', desc: 'Enfócate en la textura, el sabor y los sentidos.' },
  { id: 'promocion', label: '💸 Promoción Especial', desc: 'Oferta por tiempo limitado para acelerar ventas.' },
  { id: 'tras-bambalinas', label: '👨‍🍳 Tras Bambalinas', desc: 'Muestra el esfuerzo y la calidad artesanal del proceso.' }
];

export default function MarketingStudio() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState(STRATEGIES[0].id);
  const [generatedContent, setGeneratedContent] = useState('');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!imagePreview) {
      toast.error('Sube una foto primero para que la IA la analice.');
      return;
    }
    setIsGenerating(true);
    setGeneratedContent('');
    const estrategia = STRATEGIES.find(s => s.id === selectedStrategy);
    const prompt = Actúa como un experto copywriter de marketing gastronómico. He subido una foto de mi panadería/repostería. Mi objetivo es aplicar la estrategia de "". \n\nGenera un plan de contenidos directo y persuasivo con esta estructura EXACTA:\n\n[INSTAGRAM]\n(Texto para Instagram y Facebook con emojis y hashtags)\n\n[WHATSAPP]\n(Texto corto y muy vendedor para subir a los Estados de WhatsApp o enviar a clientes)\n\n[TIKTOK]\n(Idea de guion de 15 segundos narrando lo que se ve en el video);

    try {
      let accumulatedText = '';
      await consultarAgente('influencer', prompt, (chunk) => {
        accumulatedText += chunk;
        setGeneratedContent(accumulatedText);
      }, imagePreview);
      toast.success('¡Campaña generada con éxito!');
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
    const parts = content.split(/\[(INSTAGRAM|WHATSAPP|TIKTOK)\]/i);
    let currentKey = 'OTROS';
    parts.forEach(part => {
      const match = part.toUpperCase().trim();
      if (['INSTAGRAM', 'WHATSAPP', 'TIKTOK'].includes(match)) {
        currentKey = match;
      } else if (part.trim()) {
        sections[currentKey] = (sections[currentKey] || '') + part.trim();
      }
    });
    return sections;
  };

  const sections = generatedContent ? parseContent(generatedContent) : {};

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in zoom-in-95 duration-500 pb-32">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-500 border border-fuchsia-500/20">
              <Megaphone className="w-6 h-6" />
            </div>
            Marketing Studio IA
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Convierte fotos de tus productos o de tus operaciones diarias en campañas virales persuasivas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-sm flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-fuchsia-500" /> 1. La Foto (La Evidencia)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
              {!imagePreview ? (
                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Sube la foto del pedido</p>
                  <p className="text-xs text-slate-500 mt-1">Toca aquí o arrastra la imagen</p>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden group">
                  <img src={imagePreview} alt="Preview" className="w-full h-auto object-cover max-h-64 rounded-xl" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Button onClick={() => fileInputRef.current?.click()} variant="secondary" size="sm" className="gap-2">
                      <RefreshCw className="w-4 h-4" /> Cambiar foto
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-fuchsia-500" /> 2. El Ángulo (Estrategia)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {STRATEGIES.map(strategy => (
                <div key={strategy.id} onClick={() => setSelectedStrategy(strategy.id)} className={p-3 rounded-xl border-2 cursor-pointer transition-all }>
                  <h3 className={	ext-sm font-bold }>{strategy.label}</h3>
                  <p className="text-xs text-slate-500 mt-1">{strategy.desc}</p>
                </div>
              ))}
              <Button onClick={handleGenerate} disabled={isGenerating || !imagePreview} className="w-full h-12 mt-4 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white shadow-lg shadow-fuchsia-500/25">
                {isGenerating ? <><RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Analizando...</> : <><Sparkles className="w-5 h-5 mr-2" /> Lanzar Campaña a la IA</>}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-7">
          <Card className="h-full border-slate-200 dark:border-slate-800 shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl min-h-[500px]">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Share2 className="w-4 h-4 text-indigo-500" /> 3. Textos Listos para Publicar
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {!generatedContent ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 py-20">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Megaphone className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                  </div>
                  <p className="text-sm text-center max-w-sm">Sube tu foto y presiona generar para redactar tu campaña en segundos.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {sections['INSTAGRAM'] && (
                    <div className="space-y-2 animate-in slide-in-from-bottom-2">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-pink-600 dark:text-pink-400 font-black tracking-widest text-[10px] uppercase">
                          <Instagram className="w-4 h-4" /> Instagram & Facebook
                        </Label>
                        <Button variant="ghost" size="sm" onClick={() => handleCopy(sections['INSTAGRAM'], 'ig')} className="h-8 text-xs gap-1.5">
                          {copiedSection === 'ig' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />} Copiar
                        </Button>
                      </div>
                      <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                        {sections['INSTAGRAM']}
                      </div>
                    </div>
                  )}
                  {sections['WHATSAPP'] && (
                    <div className="space-y-2 animate-in slide-in-from-bottom-2" style={{ animationDelay: '100ms' }}>
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black tracking-widest text-[10px] uppercase">
                          <MessageCircle className="w-4 h-4" /> Estados de WhatsApp
                        </Label>
                        <Button variant="ghost" size="sm" onClick={() => handleCopy(sections['WHATSAPP'], 'wa')} className="h-8 text-xs gap-1.5">
                          {copiedSection === 'wa' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />} Copiar
                        </Button>
                      </div>
                      <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/50 whitespace-pre-wrap text-sm text-emerald-900 dark:text-emerald-300 font-medium">
                        {sections['WHATSAPP']}
                      </div>
                    </div>
                  )}
                  {sections['TIKTOK'] && (
                    <div className="space-y-2 animate-in slide-in-from-bottom-2" style={{ animationDelay: '200ms' }}>
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-slate-900 dark:text-white font-black tracking-widest text-[10px] uppercase">
                          <Share2 className="w-4 h-4" /> Guion TikTok / Reels
                        </Label>
                        <Button variant="ghost" size="sm" onClick={() => handleCopy(sections['TIKTOK'], 'tk')} className="h-8 text-xs gap-1.5">
                          {copiedSection === 'tk' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />} Copiar
                        </Button>
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 italic">
                        {sections['TIKTOK']}
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
        </div>
      </div>
    </div>
  );
}

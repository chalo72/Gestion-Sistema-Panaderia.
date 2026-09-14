import React, { useCallback, useEffect, useState, useMemo, createContext, useContext } from 'react';
import { db } from '@/lib/database';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  NodeResizer,
  type Connection,
  type Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
  BrainCircuit, AlertTriangle, Zap, Package, X, Settings, 
  Database, Webhook, Globe, Bot, Mail, MessageSquare, Code, Save, Trash2, Link, Info, Lightbulb,
  HardDrive, ShieldAlert, Play, Share2, Send, Minimize2, Maximize2
} from 'lucide-react';
import { useWorkflowEngine } from '@/hooks/useWorkflowEngine';
import { workflowTemplates } from './templates';

// ── CONTEXTO PARA CONFIGURACIÓN ──────────────────────────────────────────────
const WorkflowContext = createContext<{ 
  openSettings: (id: string) => void;
  deleteNode: (id: string) => void;
}>({ 
  openSettings: () => {},
  deleteNode: () => {}
});

// ── DICCIONARIO DE ICONOS PARA EL ESTADO ─────────────────────────────────────
const iconMap: Record<string, React.ReactNode> = {
  Webhook: <Webhook className="w-5 h-5" />,
  Database: <Database className="w-5 h-5" />,
  Globe: <Globe className="w-5 h-5" />,
  Bot: <Bot className="w-5 h-5" />,
  Mail: <Mail className="w-5 h-5" />,
  MessageSquare: <MessageSquare className="w-5 h-5" />,
  Code: <Code className="w-5 h-5" />,
  Zap: <Zap className="w-5 h-5" />,
  AlertTriangle: <AlertTriangle className="w-5 h-5" />,
  BrainCircuit: <BrainCircuit className="w-5 h-5" />,
  HardDrive: <HardDrive className="w-5 h-5" />,
  ShieldAlert: <ShieldAlert className="w-5 h-5" />,
  Share2: <Share2 className="w-5 h-5" />,
  Send: <Send className="w-5 h-5" />
};

const themeClasses: Record<string, any> = {
  blue: {
    border: 'border-blue-500',
    shadow: 'shadow-[0_0_15px_rgba(59,130,246,0.2)]',
    bgLight: 'bg-blue-500/50',
    bgSolid: 'bg-blue-500',
    handle: 'bg-blue-400',
    iconBg: 'bg-blue-500/20',
    text: 'text-blue-400',
    textDark: 'text-blue-500'
  },
  cyan: {
    border: 'border-cyan-500',
    shadow: 'shadow-[0_0_15px_rgba(6,182,212,0.2)]',
    bgLight: 'bg-cyan-500/50',
    bgSolid: 'bg-cyan-500',
    handle: 'bg-cyan-400',
    iconBg: 'bg-cyan-500/20',
    text: 'text-cyan-400',
    textDark: 'text-cyan-500'
  },
  yellow: {
    border: 'border-yellow-500',
    shadow: 'shadow-[0_0_15px_rgba(234,179,8,0.2)]',
    bgLight: 'bg-yellow-500/50',
    bgSolid: 'bg-yellow-500',
    handle: 'bg-yellow-400',
    iconBg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    textDark: 'text-yellow-500'
  },
  emerald: {
    border: 'border-emerald-500',
    shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.2)]',
    bgLight: 'bg-emerald-500/50',
    bgSolid: 'bg-emerald-500',
    handle: 'bg-emerald-400',
    iconBg: 'bg-emerald-500/20',
    text: 'text-emerald-400',
    textDark: 'text-emerald-500'
  },
  purple: {
    border: 'border-purple-500',
    shadow: 'shadow-[0_0_15px_rgba(168,85,247,0.2)]',
    bgLight: 'bg-purple-500/50',
    bgSolid: 'bg-purple-500',
    handle: 'bg-purple-400',
    iconBg: 'bg-purple-500/20',
    text: 'text-purple-400',
    textDark: 'text-purple-500'
  }
};

// ── COMPONENTE DE NODO PERSONALIZADO ─────────────────────────────────────────
const CustomNode = ({ id, data, selected }: any) => {
  const theme = themeClasses[data.colorTheme] || themeClasses.blue;
  const { openSettings, deleteNode } = useContext(WorkflowContext);

  return (
    <>
      <NodeResizer 
        color="#3b82f6" 
        isVisible={selected} 
        minWidth={100} 
        minHeight={50} 
        handleClassName="w-5 h-5 bg-white border-4 border-blue-500 rounded-md cursor-nwse-resize shadow-lg"
        lineClassName="border-blue-500 border-2"
      />
      
      <div className={`p-3 rounded-xl border transition-all h-full w-full flex flex-col ${
        selected 
          ? `${theme.border} ${theme.shadow} bg-slate-900` 
          : 'border-slate-800 bg-slate-900/90'
        } backdrop-blur-xl relative group`}
      >
        {/* Luz superior decorativa */}
        <div className={`absolute top-0 left-0 w-full h-0.5 rounded-t-xl ${theme.bgLight} group-hover:${theme.bgSolid} transition-colors`}></div>
        
        {/* Entradas/Salidas dinámicas (Excepto Triggers puros que no tienen entrada) */}
        {data.category !== 'Trigger' && (
          <Handle type="target" position={Position.Left} className={`!w-3 !h-3 ${theme.handle} !border-2 !border-white !bg-blue-400 z-50`} />
        )}
        
        {/* Botones Flotantes (Aparecen al pasar el ratón) */}
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
          <button 
            onClick={(e) => { e.stopPropagation(); openSettings(id); }}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-blue-600 transition-all shadow-lg"
            title="Abrir Configuración"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); deleteNode(id); }}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-rose-600 transition-all shadow-lg"
            title="Eliminar Nodo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-2 pr-6">
          <div className={`w-7 h-7 rounded-lg flex shrink-0 items-center justify-center shadow-inner shadow-white/10 ${theme.iconBg} ${theme.text}`}>
             {React.cloneElement(data.icon || <Package />, { className: 'w-4 h-4' })}
          </div>
          <div className="flex-1 overflow-hidden leading-tight">
            <p className={`text-[8px] uppercase font-black tracking-widest ${theme.textDark} mb-0.5`}>{data.category || 'Nodo'}</p>
            <p className="font-bold text-white text-xs leading-snug text-balance" title={data.title}>{data.title || 'Nodo Sin Título'}</p>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
           <p className="text-[9px] text-slate-400 leading-relaxed text-balance">
             {data.description || 'Sin configuración... Usa el icono de engranaje para editar.'}
           </p>
        </div>

        <Handle type="source" position={Position.Right} className={`!w-3 !h-3 ${theme.handle} !border-2 !border-white !bg-blue-400 z-50`} />
      </div>
    </>
  );
};

export function ConstructorNodos({ onClose }: { onClose?: () => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isSaving, setIsSaving] = useState(false);
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  const [terminalHeight, setTerminalHeight] = useState(250);
  const [isTerminalExpanded, setIsTerminalExpanded] = useState(false);

  const [workflowsList, setWorkflowsList] = useState<any[]>([]);
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string>('main-workflow');
  const [currentWorkflowName, setCurrentWorkflowName] = useState<string>('Flujo Principal');

  const { runWorkflow, status: engineStatus, currentLogs, setStatus: setEngineStatus, setLogs } = useWorkflowEngine();

  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = terminalHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const newHeight = Math.max(100, Math.min(window.innerHeight - 200, startHeight + deltaY));
      setTerminalHeight(newHeight);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  useEffect(() => {
    async function load() {
      const all = await db.getAllWorkflows();
      if (all && all.length > 0) {
        setWorkflowsList(all);
        const main = all.find((w: any) => w.id === 'main-workflow') || all[0];
        if (main) {
          setCurrentWorkflowId(main.id);
          setCurrentWorkflowName(main.nombre || 'Flujo Sin Nombre');
          if (main.nodes) {
            const safeNodes = main.nodes.map((n: any) => ({
              ...n,
              style: n.style || { width: 150, height: 70 }
            }));
            setNodes(safeNodes);
          }
          if (main.edges) setEdges(main.edges);
        }
      }
    }
    load();
  }, [setNodes, setEdges]);

  const guardarFlujo = async () => {
    setIsSaving(true);
    try {
      await db.saveWorkflow({
        id: currentWorkflowId,
        nombre: currentWorkflowName,
        nodes,
        edges,
        updatedAt: new Date().toISOString()
      });
      const all = await db.getAllWorkflows();
      setWorkflowsList(all || []);
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsSaving(false), 500);
    }
  };

  const cargarPlantillas = async () => {
    try {
      for (const t of workflowTemplates) {
        await db.saveWorkflow(t);
      }
      const all = await db.getAllWorkflows();
      setWorkflowsList(all || []);
      if (workflowTemplates.length > 0) {
        await cargarFlujoEspecifico(workflowTemplates[0].id);
      }
    } catch (e) {
      console.error('Error cargando plantillas', e);
    }
  };

  const crearNuevoFlujo = () => {
    const newId = `wf-${Date.now()}`;
    setCurrentWorkflowId(newId);
    setCurrentWorkflowName('Nuevo Flujo');
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
  };

  const cargarFlujoEspecifico = async (id: string) => {
    const wf = workflowsList.find(w => w.id === id);
    if (wf) {
      setCurrentWorkflowId(wf.id);
      setCurrentWorkflowName(wf.nombre || 'Flujo Sin Nombre');
      setNodes(wf.nodes ? wf.nodes.map((n: any) => ({...n, style: n.style || { width: 150, height: 70 }})) : []);
      setEdges(wf.edges || []);
      setSelectedNodeId(null);
    }
  };

  const agregarNodo = (template: any) => {
    const newId = `node-${Date.now()}`;
    const x = Math.random() * 200 + 300;
    const y = Math.random() * 200 + 200;

    const newNode: any = {
      id: newId,
      type: 'custom',
      position: { x, y },
      style: { width: 150, height: 70 },
      data: {
        title: template.title,
        category: template.category,
        colorTheme: template.colorTheme,
        iconName: template.iconName,
        icon: iconMap[template.iconName],
        description: template.description || 'Listo para configurar.',
        settings: template.settings || {}
      }
    };
    setNodes((nds: any) => [...nds, newNode]);
    setSelectedNodeId(newId);
  };

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ 
      ...params, 
      animated: true, 
      style: { stroke: 'rgba(56, 189, 248, 0.6)', strokeWidth: 3 }, 
      markerEnd: { type: 'arrowclosed' as any, color: 'rgba(56, 189, 248, 0.8)' }
    }, eds)),
    [setEdges]
  );

  const onNodesDelete = useCallback((deleted: any[]) => {
    if (deleted.some(n => n.id === selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [selectedNodeId]);

  const onPaneClick = useCallback(() => {}, []);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  const updateNodeData = (field: string, value: any) => {
    if (!selectedNodeId) return;
    setNodes(nds => nds.map(n => {
      if (n.id === selectedNodeId) {
        if (field === 'iconName') {
            return { ...n, data: { ...n.data, [field]: value, icon: iconMap[value as string] } };
        }
        return { ...n, data: { ...n.data, [field]: value } };
      }
      return n;
    }));
  };

  const deleteSelectedNode = () => {
    if (selectedNodeId) {
      setNodes(nds => nds.filter(n => n.id !== selectedNodeId));
      setEdges(eds => eds.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId));
      setSelectedNodeId(null);
    }
  };

  const deleteSpecificNode = useCallback((id: string) => {
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
  }, [selectedNodeId, setNodes, setEdges]);

  return (
    <WorkflowContext.Provider value={{ openSettings: setSelectedNodeId, deleteNode: deleteSpecificNode }}>
      <div className="flex flex-col h-full w-full bg-slate-950 rounded-2xl border border-white/10 overflow-hidden relative font-sans min-h-0 min-w-0">
        
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-900/95 backdrop-blur-xl z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.2)]">
              <BrainCircuit className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2">
                Motor de Workflows <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[9px]">PRO</span>
              </h2>
              <p className="text-slate-400 text-xs">Constructor Universal de Automatizaciones</p>
            </div>
          </div>
          
          <div className="flex flex-col items-center flex-1 px-4 max-w-md mx-auto">
            <input 
              type="text" 
              value={currentWorkflowName}
              onChange={(e) => setCurrentWorkflowName(e.target.value)}
              className="bg-transparent text-white font-bold text-lg text-center focus:outline-none focus:border-b-2 focus:border-blue-500 w-full mb-1 transition-colors"
              placeholder="Nombre del flujo..."
            />
            <div className="flex items-center gap-2 justify-center w-full">
              <select 
                value={currentWorkflowId} 
                onChange={(e) => cargarFlujoEspecifico(e.target.value)}
                className="bg-slate-800 text-xs text-slate-300 rounded-lg px-3 py-1 outline-none border border-slate-700 hover:border-slate-500 transition-colors max-w-[200px] truncate"
              >
                {!workflowsList.some(w => w.id === currentWorkflowId) && (
                  <option value={currentWorkflowId}>{currentWorkflowName} (No guardado)</option>
                )}
                {workflowsList.map(wf => (
                  <option key={wf.id} value={wf.id}>{wf.nombre || 'Sin nombre'}</option>
                ))}
              </select>
              <button 
                onClick={crearNuevoFlujo} 
                className="text-[10px] uppercase font-bold tracking-wider bg-slate-800 hover:bg-emerald-600 hover:text-white text-emerald-400 px-3 py-1 rounded-lg border border-slate-700 transition-colors shadow-sm"
              >
                + Nuevo Flujo
              </button>
              <button 
                onClick={cargarPlantillas} 
                className="text-[10px] uppercase font-bold tracking-wider bg-slate-800 hover:bg-purple-600 hover:text-white text-purple-400 px-3 py-1 rounded-lg border border-slate-700 transition-colors shadow-sm flex items-center gap-1"
              >
                <Zap className="w-3 h-3" /> Plantillas
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => runWorkflow(nodes, edges)}
              disabled={engineStatus === 'running'}
              className={`flex items-center gap-2 px-5 py-2.5 ${engineStatus === 'running' ? 'bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-500'} text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 mr-2`}
            >
              {engineStatus === 'running' ? 'Ejecutando...' : <><Play className="w-4 h-4"/> Ejecutar Flujo</>}
            </button>
            <button 
              onClick={guardarFlujo}
              disabled={isSaving}
              className={`flex items-center gap-2 px-5 py-2.5 ${isSaving ? 'bg-cyan-600' : 'bg-blue-600 hover:bg-blue-500'} text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20`}
            >
              {isSaving ? 'Guardado ✅' : <><Save className="w-4 h-4"/> Guardar Producción</>}
            </button>
            {onClose && (
              <button onClick={onClose} className="p-2.5 bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 w-full h-full relative flex min-h-0">
          
          <div className="w-72 border-r border-white/10 bg-slate-900/50 backdrop-blur-md flex flex-col z-10 overflow-y-auto">
              <div className="p-4 bg-blue-500/10 border-b border-blue-500/20">
                  <div className="flex items-center gap-2 text-blue-400 mb-2">
                      <Lightbulb className="w-4 h-4" />
                      <h3 className="text-xs font-black uppercase tracking-widest">¿Cómo Automatizar?</h3>
                  </div>
                  <ol className="text-[10px] text-slate-300 space-y-1.5 leading-relaxed">
                      <li><span className="font-bold text-cyan-400">1. Trigger:</span> Selecciona el "Evento" que disparará todo.</li>
                      <li><span className="font-bold text-yellow-400">2. Lógica:</span> Conecta a un nodo condicional.</li>
                      <li><span className="font-bold text-emerald-400">3. Acción:</span> Envía los datos hacia el exterior.</li>
                  </ol>
              </div>
              
              <div className="p-3">
                  <div className="mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-500 px-1">Eventos (Triggers)</p>
                  </div>
                  <div className="space-y-1.5">
                      <button onClick={() => agregarNodo({ title: 'Webhook In', category: 'Trigger', colorTheme: 'cyan', iconName: 'Webhook' })} className="w-full flex items-center gap-3 p-2 bg-slate-800/50 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/30 rounded-lg transition-all text-left group">
                          <div className="w-7 h-7 rounded-md bg-cyan-500/20 flex items-center justify-center text-cyan-400"><Webhook className="w-4 h-4"/></div>
                          <span className="text-xs font-bold text-slate-300 group-hover:text-cyan-300">Webhook In</span>
                      </button>
                      <button onClick={() => agregarNodo({ title: 'Base de Datos', category: 'Trigger', colorTheme: 'cyan', iconName: 'Database' })} className="w-full flex items-center gap-3 p-2 bg-slate-800/50 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/30 rounded-lg transition-all text-left group">
                          <div className="w-7 h-7 rounded-md bg-cyan-500/20 flex items-center justify-center text-cyan-400"><Database className="w-4 h-4"/></div>
                          <span className="text-xs font-bold text-slate-300 group-hover:text-cyan-300">Eventos DB</span>
                      </button>
                  </div>
              </div>

              <div className="p-3 border-t border-white/5 bg-slate-900/30">
                  <div className="mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-500 px-1">Lógica y Rutas</p>
                  </div>
                  <div className="space-y-1.5">
                      <button onClick={() => agregarNodo({ title: 'IF / ELSE', category: 'Lógica', colorTheme: 'yellow', iconName: 'AlertTriangle' })} className="w-full flex items-center gap-3 p-2 bg-slate-800/50 hover:bg-yellow-500/10 border border-transparent hover:border-yellow-500/30 rounded-lg transition-all text-left group">
                          <div className="w-7 h-7 rounded-md bg-yellow-500/20 flex items-center justify-center text-yellow-400"><AlertTriangle className="w-4 h-4"/></div>
                          <span className="text-xs font-bold text-slate-300 group-hover:text-yellow-300">Condición IF</span>
                      </button>
                      <button onClick={() => agregarNodo({ title: 'Bloque Código', category: 'Lógica', colorTheme: 'yellow', iconName: 'Code' })} className="w-full flex items-center gap-3 p-2 bg-slate-800/50 hover:bg-yellow-500/10 border border-transparent hover:border-yellow-500/30 rounded-lg transition-all text-left group">
                          <div className="w-7 h-7 rounded-md bg-yellow-500/20 flex items-center justify-center text-yellow-400"><Code className="w-4 h-4"/></div>
                          <span className="text-xs font-bold text-slate-300 group-hover:text-yellow-300">Script Manual</span>
                      </button>
                  </div>
              </div>

              <div className="p-3 border-t border-white/5">
                  <div className="mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 px-1">Acciones (Outputs)</p>
                  </div>
                  <div className="space-y-1.5">
                      <button onClick={() => agregarNodo({ title: 'Agente IA', category: 'IA', colorTheme: 'purple', iconName: 'Bot' })} className="w-full flex items-center gap-3 p-2 bg-slate-800/50 hover:bg-purple-500/10 border border-transparent hover:border-purple-500/30 rounded-lg transition-all text-left group">
                          <div className="w-7 h-7 rounded-md bg-purple-500/20 flex items-center justify-center text-purple-400"><Bot className="w-4 h-4"/></div>
                          <span className="text-xs font-bold text-slate-300 group-hover:text-purple-300">Agente LLM</span>
                      </button>
                      <button onClick={() => agregarNodo({ title: 'HTTP Request', category: 'Acción', colorTheme: 'emerald', iconName: 'Globe' })} className="w-full flex items-center gap-3 p-2 bg-slate-800/50 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/30 rounded-lg transition-all text-left group">
                          <div className="w-7 h-7 rounded-md bg-emerald-500/20 flex items-center justify-center text-emerald-400"><Globe className="w-4 h-4"/></div>
                          <span className="text-xs font-bold text-slate-300 group-hover:text-emerald-300">Petición HTTP</span>
                      </button>
                  </div>
              </div>
          </div>
          
          <div className="flex-1 relative min-h-0 flex flex-col">
              <div className="flex-1 relative">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodesDelete={onNodesDelete}
                  onConnect={onConnect}
                  onPaneClick={onPaneClick}
                  nodeTypes={nodeTypes}
                  fitView
                  colorMode="dark"
                  proOptions={{ hideAttribution: true }}
                >
                  <Background variant={BackgroundVariant.Dots} gap={16} size={1.5} color="rgba(255,255,255,0.05)" />
                  <Controls className="bg-slate-900 border-white/10 fill-white text-white shadow-xl" />
                  <MiniMap className="bg-slate-900 border-white/10 shadow-xl rounded-xl overflow-hidden" />
                </ReactFlow>
              </div>

              {/* ── TERMINAL INFERIOR ──────────────────────────────────────────────────────── */}
              <div 
                className="bg-black flex flex-col shrink-0 font-mono relative transition-all duration-300 ease-in-out border-t border-white/10"
                style={{ height: isTerminalExpanded ? '80%' : `${terminalHeight}px` }}
              >
                {!isTerminalExpanded && (
                  <div 
                    onMouseDown={handleResizeStart}
                    className="absolute top-0 left-0 right-0 h-1.5 cursor-row-resize bg-slate-800 hover:bg-blue-500 z-10 transition-colors"
                  />
                )}

                <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-white/10">
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                      Terminal de Ejecución 100% Real
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${engineStatus === 'idle' ? 'bg-slate-500' : engineStatus === 'running' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider">{engineStatus}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsTerminalExpanded(!isTerminalExpanded)}
                      className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
                      title={isTerminalExpanded ? "Restaurar tamaño" : "Maximizar terminal"}
                    >
                      {isTerminalExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => {
                      setLogs([]);
                      setEngineStatus('idle');
                    }} className="text-[9px] uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded transition-colors">
                      Limpiar Consola
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-1.5 text-emerald-400 bg-black">
                  {currentLogs.length === 0 ? (
                    <div className="text-slate-600 italic">Esperando ejecución... (Haz clic en "Ejecutar Flujo" arriba)</div>
                  ) : (
                    currentLogs.map((log, i) => (
                      <div key={i} className={`${log.includes('Error') ? 'text-rose-400' : log.includes('completado') ? 'text-blue-400' : 'text-emerald-400'} whitespace-pre-wrap break-all font-mono`}>
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </div>
          </div>

          {/* ── PANEL DERECHO: CONFIGURACIÓN DE NODO ────────────────────────────── */}
          {selectedNode && (
              <div className="w-80 border-l border-white/10 bg-slate-900/95 backdrop-blur-xl flex flex-col z-20 shadow-2xl absolute right-0 top-0 h-full animate-in slide-in-from-right duration-200">
                  <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-800/50">
                      <div className="flex items-center gap-2">
                          <Settings className="w-4 h-4 text-blue-400" />
                          <h3 className="text-xs font-black uppercase tracking-widest text-white">Configuración del Nodo</h3>
                      </div>
                      <button onClick={() => setSelectedNodeId(null)} className="text-slate-400 hover:text-white hover:bg-white/10 p-1 rounded transition-colors">
                          <X className="w-4 h-4" />
                      </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-5 space-y-5">
                      {/* Campos Generales */}
                      <div className="space-y-3">
                          <div>
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Nombre del Nodo</label>
                              <input 
                                  type="text" 
                                  value={selectedNode.data.title || ''}
                                  onChange={(e) => updateNodeData('title', e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                              />
                          </div>
                          <div>
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Descripción (Opcional)</label>
                              <textarea 
                                  value={selectedNode.data.description || ''}
                                  onChange={(e) => updateNodeData('description', e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors h-20 resize-none"
                              />
                          </div>
                          <div>
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Icono Visual</label>
                              <select 
                                  value={selectedNode.data.iconName || 'Package'}
                                  onChange={(e) => updateNodeData('iconName', e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                              >
                                  {Object.keys(iconMap).map(k => <option key={k} value={k}>{k}</option>)}
                              </select>
                          </div>
                      </div>

                      <div className="h-px bg-white/10 w-full" />

                      {/* Propiedades Dinámicas Según Tipo */}
                      <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1 block">Propiedades de Ejecución</label>
                          
                          {(selectedNode.data.title?.includes('HTTP') || selectedNode.data.title?.includes('Webhook')) && (
                              <>
                                  <div>
                                      <label className="text-[10px] text-slate-400 block mb-1">Método HTTP</label>
                                      <select 
                                          value={selectedNode.data.httpMethod || 'GET'}
                                          onChange={(e) => updateNodeData('httpMethod', e.target.value)}
                                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                      >
                                          <option>GET</option>
                                          <option>POST</option>
                                          <option>PUT</option>
                                          <option>DELETE</option>
                                      </select>
                                  </div>
                                  <div>
                                      <label className="text-[10px] text-slate-400 block mb-1">URL / Endpoint Externo</label>
                                      <input 
                                          type="text" 
                                          value={selectedNode.data.httpUrl || ''}
                                          onChange={(e) => updateNodeData('httpUrl', e.target.value)}
                                          placeholder="https://hook.n8n.com/..." 
                                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono text-xs" 
                                      />
                                  </div>
                              </>
                          )}
                          
                          {(selectedNode.data.title?.includes('Agente') || selectedNode.data.title?.includes('Bot') || selectedNode.data.title?.includes('IA')) && (
                              <div>
                                  <label className="text-[10px] text-slate-400 block mb-1">Prompt / Instrucción IA</label>
                                  <textarea 
                                      value={selectedNode.data.prompt || ''}
                                      onChange={(e) => updateNodeData('prompt', e.target.value)}
                                      placeholder="Eres un asistente experto en..." 
                                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono text-xs h-32 resize-none" 
                                  />
                              </div>
                          )}

                          {(selectedNode.data.title?.includes('Código') || selectedNode.data.title?.includes('Script')) && (
                              <div>
                                  <label className="text-[10px] text-slate-400 block mb-1">Código Javascript (Usa 'input' como variable)</label>
                                  <textarea 
                                      value={selectedNode.data.code || 'return input;'}
                                      onChange={(e) => updateNodeData('code', e.target.value)}
                                      placeholder="return input.toUpperCase();" 
                                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono text-[10px] h-48 resize-none" 
                                  />
                              </div>
                          )}

                          {!selectedNode.data.title?.includes('Agente') && !selectedNode.data.title?.includes('IA') && !selectedNode.data.title?.includes('HTTP') && !selectedNode.data.title?.includes('Webhook') && !selectedNode.data.title?.includes('Código') && !selectedNode.data.title?.includes('Script') && (
                              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-center">
                                  <Info className="w-5 h-5 text-slate-500 mx-auto mb-2" />
                                  <p className="text-xs text-slate-400">Las variables dinámicas estarán disponibles cuando conectes este nodo a un Trigger inicial.</p>
                              </div>
                          )}
                      </div>
                  </div>

                  <div className="p-4 border-t border-white/10 bg-slate-950">
                      <button onClick={deleteSelectedNode} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg font-bold text-xs uppercase tracking-widest transition-colors">
                          <Trash2 className="w-4 h-4" /> Eliminar Nodo
                      </button>
                  </div>
              </div>
          )}
        </div>
      </div>
    </WorkflowContext.Provider>
  );
}

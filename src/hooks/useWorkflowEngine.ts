import { useState, useCallback } from 'react';
import { consultarAgente as llamarAgente, type AgenteId } from '@/constants/agentes';
import type { Node, Edge } from '@xyflow/react';

export type EngineStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

export interface NodeExecution {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: string;
  error?: string;
}

export function useWorkflowEngine() {
  const [status, setStatus] = useState<EngineStatus>('idle');
  const [executions, setExecutions] = useState<Record<string, NodeExecution>>({});
  const [currentLogs, setCurrentLogs] = useState<string[]>([]);

  const log = (msg: string) => {
    setCurrentLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const executeNode = async (node: Node, inputData?: string): Promise<string> => {
    setExecutions(prev => ({ ...prev, [node.id]: { id: node.id, status: 'running' } }));
    
    // Dispatch nexus-task to sync with Bitácora if it's an AI agent
    let isAgent = false;
    let agenteId: AgenteId = 'gerente';
    
    const nodeTitle = node.data?.title as string || '';
    const nodeCategory = node.data?.category as string || '';
    const prompt = (node.data?.prompt || node.data?.description || '') as string;

    // Map node title to AgenteId for bitácora display
    if (nodeTitle.includes('Analista') || nodeCategory.includes('IA') || nodeTitle.includes('Agente')) {
       isAgent = true;
       if (nodeTitle.includes('Datos') || nodeTitle.includes('Inventario')) agenteId = 'analista-datos';
       else if (nodeTitle.includes('Marketing') || nodeTitle.includes('Redactor')) agenteId = 'redactor-creativo';
       else if (nodeTitle.includes('Atención') || nodeTitle.includes('WhatsApp')) agenteId = 'atencion-cliente';
       else agenteId = 'gerente';

       window.dispatchEvent(new CustomEvent('nexus-engine-task', { 
         detail: { agente: agenteId, tarea: prompt, estado: 'working' } 
       }));
    }

    try {
      let finalResult = '';

      if (nodeCategory === 'Trigger' || nodeCategory === 'Eventos (Triggers)' || nodeTitle.includes('Trigger')) {
        finalResult = 'Trigger activado. Contexto: ' + (inputData || 'Iniciado por el usuario');
      } else if (nodeCategory === 'Lógica') {
        if (nodeTitle.includes('Código') || nodeTitle.includes('Script')) {
            const code = (node.data?.code as string) || 'return input;';
            try {
                // eslint-disable-next-line no-new-func
                const fn = new Function('input', `return (async () => { ${code} })();`);
                const res = await fn(inputData);
                finalResult = typeof res === 'object' ? JSON.stringify(res, null, 2) : String(res);
            } catch (err: any) {
                throw new Error(`Error en código JS: ${err.message}`);
            }
        } else {
            finalResult = `Lógica ejecutada con input: ${inputData}`;
        }
      } else if (nodeTitle.includes('Agente') || nodeTitle.includes('IA') || nodeTitle.includes('Bot')) {
        let chunkResponse = '';
        const instruction = `${prompt}\n\nDatos de entrada (Output del nodo anterior): ${inputData || ''}`;
        
        await llamarAgente(agenteId, instruction, (chunk) => {
          chunkResponse += chunk;
        });
        finalResult = chunkResponse;
      } else if (nodeTitle.includes('HTTP Request') || nodeTitle.includes('Webhook')) {
        const method = (node.data?.httpMethod as string) || 'GET';
        const url = (node.data?.httpUrl as string) || '';
        
        if (!url) {
            throw new Error('URL no configurada para HTTP Request');
        }

        const options: RequestInit = { method };
        if (method !== 'GET' && method !== 'HEAD' && inputData) {
            try {
                // Verificar si ya es un JSON string o enviar como texto
                JSON.parse(inputData);
                options.headers = { 'Content-Type': 'application/json' };
            } catch {
                options.headers = { 'Content-Type': 'text/plain' };
            }
            options.body = inputData;
        }

        const res = await fetch(url, options);
        if (!res.ok) {
            throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
        }
        
        const text = await res.text();
        try {
            finalResult = JSON.stringify(JSON.parse(text), null, 2);
        } catch {
            finalResult = text;
        }
      } else {
         // Fallback
         finalResult = `Nodo ${nodeTitle} ejecutado correctamente. Input: ${inputData || 'N/A'}`;
      }

      setExecutions(prev => ({ ...prev, [node.id]: { id: node.id, status: 'completed', result: finalResult } }));
      
      if (isAgent) {
        window.dispatchEvent(new CustomEvent('nexus-engine-task', { 
          detail: { agente: agenteId, tarea: prompt, estado: 'done', respuesta: finalResult } 
        }));
      }

      return finalResult;
    } catch (err: any) {
      setExecutions(prev => ({ ...prev, [node.id]: { id: node.id, status: 'error', error: err.message } }));
      
      if (isAgent) {
        window.dispatchEvent(new CustomEvent('nexus-engine-task', { 
          detail: { agente: agenteId, tarea: prompt, estado: 'error', respuesta: `Error: ${err.message}` } 
        }));
      }
      throw err;
    }
  };

  const runWorkflow = useCallback(async (nodes: Node[], edges: Edge[], initialData?: string) => {
    if (nodes.length === 0) {
      log('El lienzo está vacío. Agrega nodos primero.');
      return;
    }

    setStatus('running');
    setExecutions({});
    setCurrentLogs([]);
    log('Iniciando Motor de Workflows...');

    try {
      // Create execution session in Bitacora
      window.dispatchEvent(new CustomEvent('nexus-engine-start', {
        detail: {
          comando: 'Ejecución de Flujo Visual (Motor de Workflows PRO)',
          id: Date.now()
        }
      }));

      // Encontrar el Trigger inicial (nodos que no son target de ningún edge)
      const targets = new Set(edges.map(e => e.target));
      let startNodes = nodes.filter(n => !targets.has(n.id) && (n.data?.category === 'Trigger' || n.data?.category === 'Eventos (Triggers)' || n.data?.title?.toString().includes('Trigger') || n.data?.title?.toString().includes('Webhook') || n.data?.title?.toString().includes('In')));

      if (startNodes.length === 0) {
        // Fallback: Si no hay un nodo marcado explícitamente como Trigger, tomar el primero que no sea Target
        startNodes = nodes.filter(n => !targets.has(n.id));
        if (startNodes.length === 0) {
          throw new Error('No se encontró un nodo inicial. Revisa las conexiones.');
        }
      }

      // BFS transversal simple
      let queue: { node: Node, inputData: string | undefined }[] = startNodes.map(n => ({ node: n, inputData: initialData }));
      
      while (queue.length > 0) {
        const { node, inputData } = queue.shift()!;
        
        log(`Ejecutando nodo: ${node.data?.title} (${node.id})`);
        
        const output = await executeNode(node, inputData);
        log(`Nodo completado: ${node.data?.title}. Salida obtenida.`);

        // Encontrar nodos siguientes
        const outgoingEdges = edges.filter(e => e.source === node.id);
        for (const edge of outgoingEdges) {
          const targetNode = nodes.find(n => n.id === edge.target);
          if (targetNode) {
            queue.push({ node: targetNode, inputData: output });
          }
        }
      }

      log('Workflow completado con éxito.');
      
      // End session in Bitacora
      window.dispatchEvent(new CustomEvent('nexus-engine-end', {}));
      
      setStatus('completed');
    } catch (error: any) {
      log(`Error crítico en Workflow: ${error.message}`);
      window.dispatchEvent(new CustomEvent('nexus-engine-end', {}));
      setStatus('error');
    }
  }, []);

  const resetEngine = () => {
    setStatus('idle');
    setExecutions({});
    setCurrentLogs([]);
  };

  return {
    status,
    executions,
    currentLogs,
    runWorkflow,
    resetEngine
  };
}

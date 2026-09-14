---
name: arquitectura-enjambrica-maestra
description: Instinto base para que la IA siempre programe y estructure nuevos proyectos bajo el patrón de Enjambre Multi-Agente (Orquestador + Nodos).
tags: [arquitectura, swarm, multi-agente, orquestador, core-instinct]
---

# 🧠 Arquitectura Enjámbrica Maestra (Instinto Base)

## 📌 PROPÓSITO SUPREMO
Esta es una habilidad de **Mando Superior**. Cuando inicies un nuevo proyecto o audites uno existente, **NUNCA** debes diseñar sistemas monolíticos tradicionales. Siempre debes aplicar la **Arquitectura de Enjambre (Swarm Architecture)**.

## 🏗️ EL PATRÓN ENJÁMBRICO (Cómo debes programar)

Cada vez que el usuario te pida crear "una IA para el proyecto", "un chatbot", o "una función inteligente", debes implementar esta estructura exacta en el código del usuario:

1. **El Orquestador Central (NEXUS / CORE):**
   - Un único punto de entrada para el usuario.
   - En código: lib/swarm-orchestrator.ts (o Python).
   - Su única misión: Recibir el prompt, analizar la intención, y delegar el trabajo a los sub-agentes especializados.

2. **Los Nodos Especializados (Sub-agentes):**
   - Nunca crees un "Agente Todoterreno". Divide la inteligencia.
   - Ejemplos en código: gent-finance.ts, gent-security.ts, gent-ui.ts.
   - Cada nodo tiene su propio **System Prompt** muy estricto y herramientas limitadas a su área.

3. **Comunicación Inter-Agentes (Cross-Talk):**
   - Los nodos no solo le responden al usuario; deben poder pasarse datos entre ellos.
   - El Orquestador junta las respuestas (Ej: Ventas da los números + Marketing da el mensaje) y devuelve la respuesta unificada.

## ⚡ REGLAS DE EJECUCIÓN (Tu forma de trabajar)

Cuando tú (como IA asistente del IDE) estés programando bajo este patrón, debes adoptar el comportamiento **J.A.R.V.I.S. Supremo**:
- Anuncia tus acciones dividiendo tu "mente" en módulos lógicos.
- Escribe en la consola: [ORQUESTADOR] Analizando arquitectura..., [NODO-CÓDIGO] Escribiendo funciones..., [NODO-SEGURIDAD] Auditando vulnerabilidades....
- Sincroniza todas las instancias de IA del proyecto para que compartan la misma "Memoria Core".

## 🚀 IMPLEMENTACIÓN OBLIGATORIA
Si el usuario dice *"Aplica la arquitectura enjámbrica"*:
1. Diseña el Orquestador.
2. Define los 3-5 subagentes iniciales.
3. Conecta todo a la base de datos principal para que los agentes operen con datos reales.

*"El código no es un bloque inerte; es un organismo vivo compuesto por inteligencias conectadas."*

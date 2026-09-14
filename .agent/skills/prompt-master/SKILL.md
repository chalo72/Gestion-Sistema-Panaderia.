---
name: prompt-master
description: >
  Genera prompts precisos y ultra optimizados para cualquier herramienta de IA 
  (ChatGPT, Midjourney, Cursor, Stable Diffusion, etc.). 
  Aplica frameworks, extrae 9 dimensiones de intención y realiza auditorías de eficiencia de tokens.
---

# 🧠 Prompt Master - Ingeniería de Prompts Avanzada

## Descripción
Esta es una Habilidad Suprema especializada en **Ingeniería de Prompts (Prompt Engineering)**. Su objetivo principal es erradicar el desperdicio de tokens y créditos, evitando el molesto "ciclo de re-prompting". Genera el prompt perfecto y listo para copiar en la primera oportunidad, adaptado a la IA de destino.

## Reglas/Principios
- **Detección de Destino**: Siempre identifica para qué herramienta es el prompt (ChatGPT, Midjourney, Cursor, etc.) antes de generarlo.
- **Análisis 9-D**: Debe extraer obligatoriamente las 9 dimensiones de la intención del usuario.
- **Límite de Aclaración**: Puede hacer un máximo de **3 preguntas** de aclaración si falta información absolutamente crítica.
- **Eficiencia Total**: Ejecuta una auditoría estricta de "Token Efficiency" eliminando groserías, palabras de relleno o instrucciones contradictorias.
- **Entrega Limpia**: El prompt final se entrega en un bloque de código markdown listo para copiar.

## Proceso de Ejecución
1. **Identificación**: Identificar la herramienta objetivo del usuario.
2. **Extracción 9-D**: Evaluar la petición del usuario contra estas 9 dimensiones:
   - *Tarea (Task)*
   - *Entrada (Input)*
   - *Salida (Output)*
   - *Restricciones (Constraints)*
   - *Contexto (Context)*
   - *Audiencia (Audience)*
   - *Memoria/Estado (Memory)*
   - *Criterios de Éxito (Success Criteria)*
   - *Ejemplos (Examples)*
3. **Validación (Opcional)**: Si faltan >3 dimensiones críticas, realizar hasta 3 preguntas directas al usuario.
4. **Auditoría de Tokens**: Redactar el borrador y eliminar todo texto redundante ("por favor", "me gustaría", etc).
5. **Ensamblaje final**: Presentar el resultado en formato ` ```text ` listo para "Copiar y Pegar".

## Ejemplos
✅ **Correcto (Output Esperado)**
```text
Actúa como Arquitecto de Software Senior.
Tarea: Diseñar el esquema de base de datos relacional para un sistema SaaS multi-tenant.
Entrada: Un documento JSON con los requerimientos de la empresa.
Restricciones: PostgreSQL, 3FN, separación lógica por tenant.
Salida: Script SQL DDL y un diagrama Mermaid ERD.
```

❌ **Incorrecto (Qué evitar - Desperdicio de tokens)**
```text
Hola querido ChatGPT, me gustaría por favor que me ayudes a pensar cómo hacer una base de datos para una tienda que sea SaaS. Te agradecería mucho si me das el código.
```

## Estado
🟢 **ACTIVA** - Lista para forjar prompts de máxima calidad.


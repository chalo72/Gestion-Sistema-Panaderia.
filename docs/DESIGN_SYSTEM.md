# 🎨 Design System — PriceControl Pro

Manual de identidad técnica. Todo diseño sigue estos tokens.

---

## Tokens de Color (HSL)

| Token | Light | Dark | Uso |
|-------|-------|------|-----|
| `--primary` | `230 80% 56%` | `230 80% 64%` | Acciones principales, links |
| `--accent` | `250 75% 57%` | `250 75% 65%` | Acentos, badges |
| `--destructive` | `0 84% 60%` | `0 62% 30%` | Errores, eliminar |
| `--ag-success` | `160 84% 39%` | — | Éxito, KPI positivo |
| `--ag-warning` | `38 92% 50%` | — | Alertas, precaución |
| `--electric-cyan` | `190 100% 50%` | — | Glow, hero gradients |
| `--deep-violet` | `258 70% 55%` | — | Gradientes premium |
| `--hot-pink` | `330 85% 60%` | — | Acentos vibrantes |

## Paleta Electric Tropical

```css
--gradient-hero:   linear-gradient(135deg, void-black → deep-space → violeta → deep-space)
--gradient-accent: linear-gradient(135deg, electric-cyan → deep-violet → hot-pink)
--gradient-text:   linear-gradient(90deg, electric-cyan → deep-violet → hot-pink)
```

---

## Tipografía

| Propiedad | Valor |
|-----------|-------|
| Font Family | `'Inter', system-ui, sans-serif` |
| Pesos usados | 300, 400, 500, 600, 700, 800 |
| Tamaños base | `0.75rem` (xs) → `2.5rem` (3xl) |
| Line height | `1.5` (body), `1.2` (headings) |

---

## Espaciado (Base 4px)

`--space-1` (4px) → `--space-16` (64px). Siempre múltiplos de 4.

---

## Glassmorphism (3 Capas)

| Clase | Blur | Opacidad | Uso |
|-------|------|----------|-----|
| `.glass-layer-1` | 12px | 40% | Fondos sutiles |
| `.glass-layer-2` | 20px | 50% | Cards y paneles |
| `.glass-layer-3` | 30px | 60% | Modales y overlays |

---

## Componentes Clave

| Clase | Descripción |
|-------|-------------|
| `.glass-card` | Card con glassmorphism + refracción |
| `.btn-gradient-primary` | Botón con gradiente + hover lift |
| `.btn-organic` | Botón orgánico con respiración |
| `.jelly-element` | Interacción con efecto jelly/spring |
| `.tilt-card` | Card con tilt 3D en hover |
| `.blob-card` | Card con bordes orgánicos animados |
| `.living-card` | Card flotante que respira |
| `.neomorph-dark` | Neumorphism oscuro |
| `.neomorph-electric` | Neumorphism con glow cyan |

---

## Animaciones

| Nombre | Duración | Easing | Uso |
|--------|----------|--------|-----|
| `ag-fade-in` | 500ms | ease-out | Entrada de elementos |
| `ag-slide-up` | 600ms | spring | Entrada desde abajo |
| `jellyBounce` | 800ms | spring | Entrada con rebote |
| `breathe` | 4s | ease-in-out ∞ | Respiración orgánica |
| `page-enter` | 400ms | spring | Transición de página |

---

## Convenciones de Código

| Contexto | Convención |
|----------|------------|
| Variables/funciones TS | `camelCase` |
| Componentes React | `PascalCase` |
| Constantes | `UPPER_SNAKE_CASE` |
| Archivos componente | `PascalCase.tsx` |
| CSS classes (custom) | `kebab-case` (prefijo `ag-`, `glass-`, `kpi-`) |
| CSS variables | `--categoria-propiedad` |

---

## Reglas Obligatorias (The Law)

1. ✅ Todo valor visual viene de un token — nunca hardcodear
2. ✅ `prefers-reduced-motion` siempre respetado
3. ✅ Glassmorphism con `-webkit-backdrop-filter` para Safari
4. ✅ `will-change` solo en elementos animados activos
5. ❌ NUNCA crear estilos inline para colores o tamaños
6. ❌ NUNCA importar librerías de animación pesadas (Framer > 50KB)

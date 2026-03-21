# ============================================
# Dulce Placer - Dockerfile de Producción
# Optimizado para Dokploy / Docker Compose
# ============================================

# ── Etapa 1: Build ──────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Recibir variables de entorno de Supabase en tiempo de build
# (VITE_* se embeben en el bundle, no son secretos de runtime)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_MASTER_PASSWORD=admin2026
ARG VITE_GUEST_PASSWORD=invitado123
ARG VITE_APP_VERSION=5.0.0

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_MASTER_PASSWORD=$VITE_MASTER_PASSWORD
ENV VITE_GUEST_PASSWORD=$VITE_GUEST_PASSWORD
ENV VITE_APP_VERSION=$VITE_APP_VERSION

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# ── Etapa 2: Servidor Nginx ──────────────────
FROM nginx:alpine AS production

# Copiar el build
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuración de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

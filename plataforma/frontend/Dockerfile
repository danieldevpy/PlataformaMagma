# --- deps ---------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- builder --------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Vars NEXT_PUBLIC_* são embutidas no bundle do cliente durante o build.
# Usamos caminhos relativos (/api) como padrão pra funcionar tanto acesso
# por IP quanto por domínio sem rebuild — nginx serve os dois na mesma
# origem. Ver docker-compose.prod.yml.
ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_MEDIA_HOST
ARG NEXT_PUBLIC_NOANIM
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_MEDIA_HOST=$NEXT_PUBLIC_MEDIA_HOST \
    NEXT_PUBLIC_NOANIM=$NEXT_PUBLIC_NOANIM

RUN npm run build

# --- runner -----------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]

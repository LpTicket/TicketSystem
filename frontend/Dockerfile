FROM node:20-slim AS builder
WORKDIR /app

# Declaramos los ARGs para que estén disponibles en tiempo de BUILD
ARG NEXT_PUBLIC_API_URL
ARG APP_URL

COPY package*.json ./
RUN npm install

COPY . .

# Deshabilitar telemetría
ENV NEXT_TELEMETRY_DISABLED=1
# Pasamos los ARGs a ENVs para el proceso de build de Next.js
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV APP_URL=$APP_URL

RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copiar archivos necesarios para standalone
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
# Railway define el puerto, pero Next standalone usa PORT por defecto
ENV PORT=3000

CMD ["node", "server.js"]

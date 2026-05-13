FROM node:20-slim AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ARG APP_URL

COPY package*.json ./
RUN npm install

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV APP_URL=$APP_URL

RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Railway inyecta PORT dinámicamente — NO lo sobreescribimos aquí
CMD ["node", "server.js"]

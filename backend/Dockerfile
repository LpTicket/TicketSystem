FROM node:20-slim AS builder

# Instalamos dependencias del sistema para módulos nativos (bcrypt, sodium-native, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:20-slim

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/chatbot-prompt.txt ./chatbot-prompt.txt

# Crear carpeta para subidas
RUN mkdir -p uploads

EXPOSE 3001

CMD ["npm", "run", "start:prod"]

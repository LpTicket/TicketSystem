FROM node:18-alpine AS builder

# Instalamos dependencias del sistema necesarias para módulos nativos (sodium-native, bcrypt, etc.)
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
# Usamos npm ci para una instalación limpia y determinista
RUN npm install

COPY . .
RUN npm run build

FROM node:18-alpine

# Instalamos las herramientas mínimas en el runner por si algún módulo las requiere en tiempo de ejecución
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Crear carpeta para subidas
RUN mkdir -p uploads

EXPOSE 3001

CMD ["npm", "run", "start:prod"]

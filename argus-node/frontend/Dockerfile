FROM node:20-alpine

WORKDIR /app

# Copiar el package.json y package-lock.json (si existe)
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Exponer el puerto de Vite
EXPOSE 5173

# Arrancar el servidor de desarrollo (que tiene Hot Reload)
CMD ["npm", "run", "dev"]

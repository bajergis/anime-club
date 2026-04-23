FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS final
COPY . .
RUN mkdir -p /data
EXPOSE 3001
CMD ["node", "server.js"]
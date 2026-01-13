# ABOUTME: Dockerfile for Masterportal MCP standalone HTTP server
# ABOUTME: Generates Masterportal zip packages from geodata

FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 8080

ENV PORT=8080
CMD ["npm", "run", "start:http"]

FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
VOLUME /app/images
COPY server.js ./
CMD ["node", "server.js"]

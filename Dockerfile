FROM mcr.microsoft.com/playwright:v1.54.1-noble

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]

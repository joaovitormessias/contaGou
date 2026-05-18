FROM node:lts-alpine

WORKDIR /app

COPY package*.json ./
COPY .npmrc ./

RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]

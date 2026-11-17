# Stage 1: install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Stage 2: development server and tests (source is mounted by docker-compose)
FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

# Stage 3: run the tests, then build the static files
FROM deps AS build
COPY . .
RUN npm test && npm run build

# Stage 4: serve the finished app
FROM nginx:alpine AS web
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

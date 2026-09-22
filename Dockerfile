FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_GOOGLE_CLIENT_ID=
ARG VITE_GOOGLE_MAPS_API_KEY=
ENV VITE_APP_SERVER_URL=/api VITE_FASTAPI_URL=/analytics
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
RUN npm run build
FROM nginx:stable-alpine
# The official entrypoint renders this template using the runtime environment.
ENV API_UPSTREAM=backend:3000 ANALYTICS_UPSTREAM=analytics:8000 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 TRUST_PROXY_HEADERS=0 \
    NGINX_ENVSUBST_FILTER="^(API_UPSTREAM|ANALYTICS_UPSTREAM|NGINX_LOCAL_RESOLVERS|TRUST_PROXY_HEADERS)$"
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

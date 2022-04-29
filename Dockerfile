# dockerfile
# build stage
FROM registry.cn-hangzhou.aliyuncs.com/dyjutil/node:v14.8.0 as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run docs:build

# production stage
FROM nginx:stable-alpine as production-stage
COPY --from=build-stage /app/docs/.vuepress/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
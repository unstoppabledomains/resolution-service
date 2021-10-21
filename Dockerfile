FROM node:14.16.1-alpine
RUN apk add --no-cache git
RUN apk add gcc make g++ zlib-dev xfce4-dev-tools postgresql-client cairo-dev pango-dev
ADD ./ /app
WORKDIR /app
RUN rm -rf node_modules && \
    yarn install && \
    yarn build

ENTRYPOINT ["node", "build/src/index.js"]

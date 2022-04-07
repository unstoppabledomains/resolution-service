FROM node:14.19-alpine
RUN apk add --no-cache git gcc make g++ zlib-dev xfce4-dev-tools postgresql-client cairo-dev pango-dev && \
    mkdir /app

WORKDIR /app
# We need to add package.json in separate step to get node_modules as separate docker layer and cache it
ADD ./package.json ./package.json

# Run yarn install separately from build to get node_modules as separate docker layer and cache ti
RUN yarn install --production=false --no-lockfile

ADD . ./
RUN yarn build

# Cleanup development packages
RUN yarn install --production=true --no-lockfile --offline

ENTRYPOINT ["node", "build/src/index.js"]

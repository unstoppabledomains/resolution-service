ENV NEW_RELIC_NO_CONFIG_FILE=true
FROM node:14.16.1-alpine
WORKDIR /resolution-service
COPY package.json yarn.lock ./
RUN yarn install
COPY . .
RUN yarn build
CMD ["node", "build/index.js"]

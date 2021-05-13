FROM node:14.16.1-alpine
WORKDIR /resolution-service
COPY package.json yarn.lock ./
RUN yarn install
COPY . .
RUN yarn build
ENTRYPOINT ["node", "build/src/index.js"]

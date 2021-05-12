FROM node:14.16.1-alpine
WORKDIR /resolution-service
COPY package.json yarn.lock ./
RUN yarn install
COPY . .
RUN yarn build
CMD ["node", "build/src/index.js"]

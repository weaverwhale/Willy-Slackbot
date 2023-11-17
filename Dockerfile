FROM node:20

WORKDIR /

COPY . .

RUN yarn

ENV NODE_ENV=production

EXPOSE 3000

CMD [ "yarn", "start" ]
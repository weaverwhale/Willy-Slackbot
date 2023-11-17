FROM node:20

WORKDIR /

COPY . .

RUN yarn

ENV NODE_ENV=production

EXPOSE 8080

EXPOSE 3000

CMD [ "yarn", "start" ]
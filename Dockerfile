FROM node:20

WORKDIR /

COPY . .

EXPOSE 80

CMD [ "yarn", "start" ]
FROM node:18
WORKDIR .
COPY userService/package.json ./
RUN npm install
COPY . .
EXPOSE 8001
CMD ["npm", "run", "dev"]

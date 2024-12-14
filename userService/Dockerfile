FROM node:18
WORKDIR /app
COPY userService/package.json ./
RUN npm install
COPY . .
EXPOSE 8001
CMD ["npm", "run", "dev"]

FROM node:18
WORKDIR /app
COPY routineService/package.json ./
RUN npm install
COPY . .
EXPOSE 8002
CMD ["npm", "run", "dev"]

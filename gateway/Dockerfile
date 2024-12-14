FROM node:18
WORKDIR /app
COPY gateway/package.json ./
RUN npm install
COPY gateway/ .
EXPOSE 8000
CMD ["npm", "start"]


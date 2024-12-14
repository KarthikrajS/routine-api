FROM node:18
WORKDIR .
COPY gateway/package.json ./
RUN npm install
COPY . .
EXPOSE 8000
CMD ["npm", "start"]

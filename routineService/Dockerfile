FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY routineService/package.json ./
RUN npm install

# Copy the rest of the application code
COPY routineService/ .

# Expose the desired port
EXPOSE 8002

# Set the command to start the app
CMD ["npm", "run", "dev"]

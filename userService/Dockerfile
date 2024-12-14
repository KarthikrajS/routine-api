FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY userService/package.json ./
RUN npm install

# Copy the rest of the application code
COPY userService/ .

# Expose the desired port
EXPOSE 8001

# Set the command to start the app
CMD ["npm", "run", "dev"]

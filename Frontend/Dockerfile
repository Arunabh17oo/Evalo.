# Use Node.js for building
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Run Vite in host mode so it's accessible from outside the container
CMD ["npm", "run", "dev", "--", "--host"]

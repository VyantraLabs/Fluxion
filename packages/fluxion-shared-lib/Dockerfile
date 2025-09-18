FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the library
RUN npm run build

# Expose the built library
VOLUME ["/app/dist", "/app/node_modules"]

CMD ["npm", "run", "build:watch"]
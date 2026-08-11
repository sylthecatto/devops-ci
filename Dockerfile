# Use a stable, official Node.js image
FROM node:18

# Set the working directory inside the container
WORKDIR /usr/src/app

# Optimize performance for Express apps
ENV NODE_ENV=production

# Inject dynamic version from Jenkins
ARG APP_VERSION=unknown
ENV APP_VERSION=$APP_VERSION

# Copy package files first to cache the dependencies
COPY package*.json ./

# Install exact dependencies from package-lock.json
RUN npm ci

# Copy the rest of the application files
COPY . .

# Run as a non-root user for security
USER node

# Document that the app listens on port 3000 by default
EXPOSE 3000

# Start the application
CMD ["node", "src/app.js"]

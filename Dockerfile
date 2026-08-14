# ==============================================================================
# 1. BASE IMAGE SELECTION
# ==============================================================================
# -> METHOD USED:    FROM node:18
# -> WHY NOT 'latest'?
#    Using 'node:latest' is non-deterministic. An unexpected major version release 
#    (e.g., Node 20 -> 22) can silently break production builds overnight.
# -> WHY NOT 'ubuntu/alpine base from scratch'?
#    Building on raw OS images requires manually installing Node/npm dependencies, 
#    increasing Dockerfile maintenance, image size, and security attack surface.
# -> WHY THIS:
#    Pins a verified, stable LTS (Long Term Support) runtime with official security
#    patches and consistent behavior across all environments.
# ==============================================================================
FROM node:18

# ==============================================================================
# 2. WORKING DIRECTORY
# ==============================================================================
# -> METHOD USED:    WORKDIR /usr/src/app
# -> WHY NOT '/' (root) or '/root'?
#    Pollutes container root filesystem, risks overwriting system files, and exposes
#    application files to system-level permissions.
# -> WHY NOT 'RUN cd /app'?
#    'cd' only affects the current subshell. Each Dockerfile instruction runs in a 
#    new layer, so 'cd' does not persist to subsequent instructions.
# -> WHY THIS:
#    Creates a dedicated, isolated application directory and automatically sets it
#    as the persistent working directory for all subsequent COPY, RUN, and CMD commands.
# ==============================================================================
WORKDIR /usr/src/app

# ==============================================================================
# 3. ENVIRONMENT OPTIMIZATION
# ==============================================================================
# -> METHOD USED:    ENV NODE_ENV=production
# -> WHY NOT default (development mode)?
#    In development mode, Express leaks full error stack traces to clients, skips
#    view template caching, and runs 2x-5x slower with higher memory usage.
# -> WHY THIS:
#    Enables production-grade performance optimizations across Express, database
#    drivers, and Node.js core modules.
# ==============================================================================
ENV NODE_ENV=production

# ==============================================================================
# 4. BUILD-TIME VERSION INJECTION
# ==============================================================================
# -> METHOD USED:    ARG APP_VERSION=unknown  /  ENV APP_VERSION=$APP_VERSION
# -> WHY NOT hardcoding versions in package.json or source code?
#    Hardcoding requires a manual Git commit for every single release or pipeline run.
# -> WHY NOT passing only via ARG (without ENV)?
#    ARG variables are only available during image BUILD time and disappear at runtime.
# -> WHY THIS:
#    Allows Jenkins CI/CD to pass dynamic metadata (Git short commit SHA or SemVer tag)
#    via '--build-arg APP_VERSION=...' and promotes it to ENV so the running app
#    can expose its version via '/health', telemetry, or logs.
# ==============================================================================
ARG APP_VERSION=unknown
ENV APP_VERSION=$APP_VERSION

# ==============================================================================
# 5. DOCKER LAYER CACHING STRATEGY (CRITICAL)
# ==============================================================================
# -> METHOD USED:    COPY package*.json ./  (BEFORE copying source code)
# -> WHY NOT 'COPY . .' right at the beginning?
#    If you copy all files first, ANY one-line code or comment change invalidates
#    Docker's layer cache. Docker would be forced to re-download all npm packages
#    on EVERY build, slowing CI pipeline builds from seconds to minutes.
# -> WHY THIS:
#    Package manifests change much less frequently than application code. Placing
#    them first allows Docker to cache the 'node_modules' layer and reuse it across builds.
# ==============================================================================
COPY package*.json ./

# ==============================================================================
# 6. DETERMINISTIC DEPENDENCY INSTALLATION
# ==============================================================================
# -> METHOD USED:    RUN npm ci
# -> WHY NOT 'npm install'?
#    1. 'npm install' can update 'package-lock.json' and install newer minor/patch
#       versions allowed by '^' or '~', causing "works on my machine but breaks in CI/prod".
#    2. 'npm install' performs dependency resolution checks which are slower.
# -> WHY THIS:
#    'npm ci' (Clean Install) strictly installs the exact versions locked in 
#    package-lock.json without modifying it, guaranteeing 100% reproducible builds.
# ==============================================================================
RUN npm ci

# ==============================================================================
# 7. APPLICATION SOURCE COPY
# ==============================================================================
# -> METHOD USED:    COPY . .
# -> WHY NOT copying without a .dockerignore?
#    Without .dockerignore, local host 'node_modules' (which may be compiled for
#    macOS/Windows), local secrets (.env), and .git folders get copied into the image,
#    causing architecture crashes, massive image bloat, and secret leaks.
# -> WHY THIS:
#    Copies only the necessary application source code (src/, public/, etc.) on top
#    of the already cached dependency layer.
# ==============================================================================
COPY . .

# ==============================================================================
# 8. PRINCIPLE OF LEAST PRIVILEGE (CONTAINER SECURITY)
# ==============================================================================
# -> METHOD USED:    USER node
# -> WHY NOT default 'root' user?
#    If an application running as root has a Remote Code Execution (RCE) vulnerability
#    or vulnerable dependency, the attacker gains full root control over the container
#    and can attempt container breakout / host system exploitation.
# -> WHY THIS:
#    Switches execution to the built-in, unprivileged 'node' user (UID 1000) provided
#    by the official image, adhering to DevSecOps best practices.
# ==============================================================================
USER node

# ==============================================================================
# 9. PORT DOCUMENTATION & METADATA
# ==============================================================================
# -> METHOD USED:    EXPOSE 3000
# -> WHY NOT assume it automatically publishes the port?
#    EXPOSE does NOT open ports on the host by itself (unlike 'docker run -p 3000:3000').
# -> WHY THIS:
#    Acts as formal documentation for operators, Docker network bridges, and Kubernetes
#    Service descriptors indicating the target container port.
# ==============================================================================
EXPOSE 3000

# ==============================================================================
# 10. ENTRYPOINT / PROCESS EXECUTION FORM
# ==============================================================================
# -> METHOD USED:    CMD ["node", "src/app.js"]  (Exec Form)
# -> WHY NOT 'CMD npm start'?
#    'npm' runs as PID 1 and does NOT forward OS signals (SIGTERM / SIGINT) to child
#    Node processes. When Kubernetes or Docker tries to stop the container, the app
#    hangs until the grace period expires (30s) and gets forcefully killed (SIGKILL),
#    causing dropped database connections and incomplete HTTP requests.
# -> WHY NOT 'CMD node src/app.js' (Shell Form)?
#    Shell form wraps the command in '/bin/sh -c', which also fails to pass signals.
# -> WHY THIS:
#    Exec form (JSON array) runs the Node process directly as PID 1, allowing it
#    to catch SIGTERM signals for graceful shutdowns and instant container recycling.
# ==============================================================================
CMD ["node", "src/app.js"]

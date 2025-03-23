/**
 * Main server implementation for WS-Hub WebSocket server
 *
 * This file contains the core server functionality including:
 * - HTTP/HTTPS server creation
 * - Socket.IO server setup
 * - SSL/TLS certificate handling and hot-reloading
 * - Automatic certificate watching for updates
 * - Express server routes for health checks and debugging
 *
 * The server can run in both secure (HTTPS) and non-secure (HTTP) modes,
 * and is compatible with standalone deployment or IIS integration.
 */
import { createServer } from 'http';
import { Server } from 'socket.io';
import express from 'express';
import fs, { FSWatcher, watch } from 'fs';
import path from 'path';
import https from 'https';

import { EventEmitter } from 'events';
import { getConfiguration } from './utils/config';
import { setupSocketEventHandlers } from './socket/handlers';

// Export certificate refresh event emitter to allow external modules to listen for cert changes
export const certEvents = new EventEmitter();

// Global references to allow cleanup and modification
let certWatcher: FSWatcher | null = null;
let httpsServer: https.Server | null = null;
let currentServer: any = null; // Will be either http.Server or https.Server

/**
 * Starts the Socket.IO WebSocket server
 *
 * @param options Configuration options to override defaults
 *   - httpPort: Port for HTTP connections
 *   - httpsPort: Port for HTTPS connections
 *   - runningUnderIIS: Whether the server is running under IIS
 */
export function startSocketServer (options?: {
  httpPort?: number;
  httpsPort?: number;
  runningUnderIIS?: boolean;
}): void {
  try {
    const config = getConfiguration();
    const app = express();
    const certDir = path.join(__dirname, '../certs');
    const keyPath = path.join(certDir, 'key.pem');
    const certPath = path.join(certDir, 'cert.pem');

    // Use provided ports or fall back to configuration/defaults
    const httpPort = options?.httpPort || config.server.httpPort;
    const httpsPort = options?.httpsPort || config.server.httpsPort;
    const runningUnderIIS = options?.runningUnderIIS || false;

    // Check if SSL certificates exist
    const useSSL = fs.existsSync(keyPath) && fs.existsSync(certPath);

    // Add a basic health check endpoint for monitoring
    app.get('/health', (req, res) => {
      res.status(200).send({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: runningUnderIIS ? 'IIS' : 'Standalone'
      });
    });

    // Create appropriate server based on SSL availability and environment
    if (useSSL && !runningUnderIIS) {
      // Use HTTPS when certificates are available and not running under IIS
      // When under IIS, SSL is handled by IIS, so use HTTP even with certs available
      startWithSSL(app, keyPath, certPath, httpsPort);
    } else {
      startWithoutSSL(app, httpPort, runningUnderIIS);
    }

    // Watch certificate directory for changes if not under IIS
    // (when under IIS, certificate updates would be handled by IIS)
    if (!runningUnderIIS) {
      setupCertificateWatcher(certDir, app, httpPort, httpsPort);
    }

    // Log proxy configuration help (not needed for iisnode)
    if (!runningUnderIIS) {
      logReverseProxyHelp(useSSL, httpPort, httpsPort);
    }
  } catch (error) {
    console.error('Failed to start server:', error);
  }
}

/**
 * Starts the server in SSL/TLS mode (HTTPS)
 *
 * @param app Express application instance
 * @param keyPath Path to the SSL private key file
 * @param certPath Path to the SSL certificate file
 * @param port HTTPS port to listen on
 */
function startWithSSL (app: express.Application, keyPath: string, certPath: string, port: number): void {
  try {
    const config = getConfiguration();

    // Load SSL certificates from filesystem
    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };

    console.log(`Starting server with SSL encryption (HTTPS) on port ${port}`);

    // Create HTTPS server with SSL options
    httpsServer = https.createServer(httpsOptions, app);
    currentServer = httpsServer;

    // Add CORS middleware to Express before defining routes
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

      // Handle preflight requests - important for CORS to work properly
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      next();
    });

    // Define Socket.IO options with correct CORS settings
    // Type assertion to 'any' is used to bypass TypeScript's strict typing
    // for some Socket.IO options that aren't fully typed
    const socketIoOptions: any = {
      cors: {
        origin: '*', // Allow all origins
        methods: ['GET', 'POST', 'OPTIONS'],
        credentials: true,
        preflightContinue: false
      },
      // Add path for IIS reverse proxy support - important for path routing
      path: '/socket.io',
      // Add ping configuration from configuration for connection health monitoring
      pingTimeout: config.heartbeat.timeout,
      pingInterval: config.heartbeat.interval,
      // Add maxHttpBufferSize from configuration to limit message size
      maxHttpBufferSize: config.security.maxMessageSize
    };

    // Create Socket.IO server with options including ping settings
    const io = new Server(httpsServer, socketIoOptions);

    // Setup Socket.IO event handlers
    setupSocketHandlers(io);

    // Create an Express route to help with debugging
    app.get('/', (req, res) => {
      res.send(`
        <h1>WS-Hub WebSocket Server</h1>
        <p>Status: Running (HTTPS mode)</p>
        <p>Port: ${port}</p>
        <p>WebSocket URL: wss://${req.hostname}:${port}/socket.io/</p>
        <p>Socket.IO client URL: https://${req.hostname}:${port}/socket.io/socket.io.js</p>
      `);
    });

    // Listen on all network interfaces (0.0.0.0) instead of just localhost
    // This allows connections from other machines on the network
    httpsServer.listen({
      port,
      host: '0.0.0.0'
    }, () => {
      console.log(`Socket.IO server running on HTTPS port ${port}`);
      console.log(`Local URL: https://localhost:${port}`);
      console.log(`External URL: https://<your-ip-or-domain>:${port}`);
      console.log(`WebSocket URL: wss://localhost:${port}/socket.io`);
      console.log('Press Ctrl+C to stop the server and return to the menu');
    });
  } catch (error) {
    console.error('Error starting SSL server:', error);
    // Fall back to non-SSL if SSL fails - better to have a non-secure server than no server
    console.log('Falling back to non-SSL server...');
    startWithoutSSL(app, 8080);
  }
}

/**
 * Starts the server in non-SSL mode (HTTP)
 *
 * @param app Express application instance
 * @param port HTTP port to listen on
 * @param runningUnderIIS Whether the server is running under IIS
 */
function startWithoutSSL (app: express.Application, port: number, runningUnderIIS: boolean = false): void {
  const config = getConfiguration();

  // Create HTTP server (no SSL)
  const httpServer = createServer(app);
  currentServer = httpServer;

  // Adjust logging based on environment
  if (runningUnderIIS) {
    console.log(`Starting server under IIS on port ${port}`);
  } else {
    console.log(`Starting server without SSL encryption (HTTP) on port ${port}`);
    console.log('Run the "Generate SSL Certificate" option first if you want to use HTTPS');
  }

  // Add CORS middleware to Express before defining routes
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Define Socket.IO options with correct CORS settings
  const socketIoOptions: any = {
    cors: {
      origin: '*', // Allow all origins
      methods: ['GET', 'POST', 'OPTIONS'],
      credentials: true,
      preflightContinue: false
    },
    // Add path for reverse proxy/IIS support
    path: '/socket.io',
    // Add ping configuration from configuration
    pingTimeout: config.heartbeat.timeout,
    pingInterval: config.heartbeat.interval,
    // Add maxHttpBufferSize from configuration
    maxHttpBufferSize: config.security.maxMessageSize
  };

  // Create Socket.IO server with options including ping settings
  const io = new Server(httpServer, socketIoOptions);

  // Setup Socket.IO event handlers with the improved event structure
  setupSocketHandlers(io);

  // Create an Express route to help with debugging
  app.get('/', (req, res) => {
    res.send(`
      <h1>WS-Hub WebSocket Server</h1>
      <p>Status: Running (HTTP mode)</p>
      <p>Port: ${port}</p>
      <p>WebSocket URL: ws://${req.hostname}:${port}/socket.io/</p>
      <p>Socket.IO client URL: http://${req.hostname}:${port}/socket.io/socket.io.js</p>
    `);
  });

  // Listen on all network interfaces (0.0.0.0) instead of just localhost
  httpServer.listen({
    port,
    host: '0.0.0.0'
  }, () => {
    console.log(`Socket.IO server running on HTTP port ${port}`);

    if (!runningUnderIIS) {
      console.log(`Local URL: http://localhost:${port}`);
      console.log(`External URL: http://<your-ip-or-domain>:${port}`);
      console.log(`WebSocket URL: ws://localhost:${port}/socket.io`);
      console.log('Press Ctrl+C to stop the server and return to the menu');
    } else {
      console.log('Server running under IIS control');
    }
  });
}

/**
 * Setup Socket.IO event handlers and configure additional server events
 *
 * @param io The Socket.IO server instance
 */
function setupSocketHandlers (io: Server): void {
  const config = getConfiguration();

  // Log ping configuration from config
  console.log(`WebSocket ping configured: interval=${config.heartbeat.interval}ms, timeout=${config.heartbeat.timeout}ms`);

  // Setup event handlers for connections
  setupSocketEventHandlers(io);

  // Listen for certificate refresh events to notify clients
  certEvents.on('certificatesUpdated', () => {
    console.log('Notifying all clients about certificate update...');
    io.emit('system:certificateRefresh', {
      message: 'Server SSL certificates have been updated. You may need to reconnect.',
      timestamp: new Date()
    });
  });
}

/**
 * Sets up a file system watcher to monitor certificate changes
 * This allows the server to hot-reload certificates without restart
 *
 * @param certDir Directory containing the SSL certificates
 * @param app Express application to pass to new servers if needed
 * @param httpPort HTTP port for fallback
 * @param httpsPort HTTPS port for secure server
 */
function setupCertificateWatcher (certDir: string, app: express.Application, httpPort: number, httpsPort: number): void {
  try {
    // Create certificate directory if it doesn't exist
    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
    }

    // Clean up previous watcher if it exists
    if (certWatcher) {
      certWatcher.close();
    }

    // Watch certificate directory for changes
    console.log(`Watching certificate directory: ${certDir}`);
    certWatcher = watch(certDir, { persistent: true }, async (eventType, filename) => {
      if (filename && (filename === 'cert.pem' || filename === 'key.pem')) {
        console.log(`Certificate file changed: ${filename}`);

        // Check if both certificate files exist
        const keyPath = path.join(certDir, 'key.pem');
        const certPath = path.join(certDir, 'cert.pem');

        if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
          console.log('Both certificate files exist, updating SSL context...');

          try {
            // Hot-reload the certificates for the HTTPS server
            if (httpsServer) {
              console.log('Reloading SSL certificates for existing HTTPS server...');

              // Load new certificates
              const newKey = fs.readFileSync(keyPath);
              const newCert = fs.readFileSync(certPath);

              // Update the SSL context - this is a Node.js feature that allows changing
              // certificates without restarting the server
              httpsServer.setSecureContext({
                key: newKey,
                cert: newCert
              });

              console.log('SSL certificates updated successfully!');

              // Emit event for certificate update so clients can be notified
              certEvents.emit('certificatesUpdated');
            } else if (currentServer) {
              console.log('Current server is not using HTTPS. Preparing to switch to HTTPS...');

              // Notify clients about server upgrade
              certEvents.emit('serverRestarting');

              // Stop current server
              currentServer.close(() => {
                console.log('HTTP server closed, restarting with SSL...');

                // Start new server with SSL
                startWithSSL(app, keyPath, certPath, httpsPort);

                console.log(`Server upgraded from HTTP to HTTPS (port ${httpPort} to ${httpsPort})`);
              });
            }
          } catch (error) {
            console.error('Error updating SSL certificates:', error);
          }
        }
      }
    });
  } catch (error) {
    console.error('Error setting up certificate watcher:', error);
  }
}

/**
 * Logs helpful information for configuring a reverse proxy with IIS
 *
 * @param useSSL Whether the server is using SSL
 * @param httpPort HTTP port being used
 * @param httpsPort HTTPS port being used
 */
function logReverseProxyHelp (useSSL: boolean, httpPort: number, httpsPort: number): void {
  const port = useSSL ? httpsPort : httpPort;
  const protocol = useSSL ? 'https' : 'http';

  console.log('\n=== IIS Reverse Proxy Configuration Help ===');
  console.log('To integrate this WebSocket server with IIS:');
  console.log('1. Install the URL Rewrite module and Application Request Routing for IIS');
  console.log('2. Set up a website in IIS for your domain (example.com)');
  console.log('3. Add the following to the web.config in your IIS website root:');
  console.log(`\n<configuration>
    <system.webServer>
        <rewrite>
            <rules>
                <rule name="ReverseProxySocketIO" stopProcessing="true">
                    <match url="socket.io/(.*)"/>
                    <action type="Rewrite" url="${protocol}://localhost:${port}/socket.io/{R:1}"/>
                </rule>
            </rules>
        </rewrite>
        <webSocket enabled="false"/>
    </system.webServer>
</configuration>\n`);
  console.log('4. Configure your client to connect to the main website URL:');
  console.log('   const socket = io(\'wss://example.com\', { path: \'/socket.io\' });\n');
}

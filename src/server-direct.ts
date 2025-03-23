import { startSocketServer, certEvents } from './server';
import { getConfiguration } from './utils/config';
import path from 'path';
import fs from 'fs';

// Determine if we're running under IIS via iisnode
// Be more explicit about checking for IIS to avoid false positives
const runningUnderIisNode = typeof process.env.IISNODE_VERSION === 'string' && 
                           process.env.IISNODE_VERSION.length > 0;

// Log the environment for debugging
console.log('Environment check:', { 
  NODE_ENV: process.env.NODE_ENV,
  IISNODE_VERSION: process.env.IISNODE_VERSION,
  runningUnderIisNode
});

// Configure process listeners
process.on('SIGINT', () => {
  console.log('Received SIGINT signal. Shutting down server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal. Shutting down server...');
  process.exit(0);
});

// Register certificate events listener for logging
certEvents.on('certificatesUpdated', () => {
  console.log('[SERVER-DIRECT] SSL certificates updated at', new Date().toISOString());
});

// Create necessary directories regardless of environment
const setupDirectories = () => {
  // Directories needed for the application
  const dirs = [
    path.join(__dirname, '../certs'), 
    path.join(__dirname, '../logs')
  ];
  
  // Add iisnode logs directory if running under IIS
  if (runningUnderIisNode) {
    dirs.push(path.join(__dirname, '../iisnode'));
  }
  
  // Create directories if they don't exist
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Make sure required directories exist
setupDirectories();

// Start server with appropriate configuration
const startServer = () => {
  const config = getConfiguration();
  
  if (runningUnderIisNode) {
    console.log('Running under IIS with iisnode');
    
    // IIS provides %WEBSITE_SITE_NAME% as an environment variable
    const siteName = process.env.WEBSITE_SITE_NAME || 'IIS Website';
    console.log(`Running as IIS website: ${siteName}`);
    
    // Start the Socket.IO server with IIS-compatible configuration
    console.log('Starting Socket.IO server for IIS integration...');
    startSocketServer({
      // When running under IIS with iisnode, we typically use process.env.PORT
      // which IIS automatically assigns, but we can use our config for HTTP
      httpPort: parseInt(process.env.PORT || config.server.httpPort.toString()),
      httpsPort: config.server.httpsPort,
      runningUnderIIS: true
    });
  } else {
    // Standard standalone mode - flexible enough for both development and production
    console.log('Starting Socket.IO server in standalone mode...');
    
    // Check if we have environment variables for ports (useful for containerization/cloud)
    const httpPort = process.env.HTTP_PORT ? parseInt(process.env.HTTP_PORT) : config.server.httpPort;
    const httpsPort = process.env.HTTPS_PORT ? parseInt(process.env.HTTPS_PORT) : config.server.httpsPort;
    
    startSocketServer({
      httpPort,
      httpsPort,
      runningUnderIIS: false
    });
  }
};

// Start the server
startServer();

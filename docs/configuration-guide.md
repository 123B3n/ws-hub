# Configuration Guide

This guide explains how to configure the WebSocket Server to suit your specific needs.

## Configuration Files

The server uses a hierarchy of configuration files:

1. **`config.json`** - Base configuration for all environments
2. **`config.development.json`** - Development-specific settings (when `NODE_ENV=development`)
3. **`config.production.json`** - Production-specific settings (when `NODE_ENV=production`)

Settings in environment-specific files override the base configuration.

## Configuration Structure

The configuration contains several sections:

- **server**: Basic server settings like ports
- **heartbeat**: Connection health monitoring
- **security**: CORS, rate-limiting, and message size limits
- **logging**: Log levels and file locations
- **notifications**: Settings for the notification system
- **customSettings**: Application-specific settings

## Example Configuration

Here's a fully annotated configuration file explaining each option:

```json
{
  "server": {
    "httpPort": 8080,        // Port for HTTP connections
    "httpsPort": 8443,       // Port for HTTPS connections
    "host": "0.0.0.0"        // Interface to bind to (0.0.0.0 = all interfaces)
  },
  
  "heartbeat": {
    "enabled": true,         // Enable/disable heartbeat system
    "interval": 30000,       // Milliseconds between heartbeats (30 seconds)
    "timeout": 5000,         // Milliseconds to wait for heartbeat response (5 seconds)
    "maxMissed": 5           // Maximum consecutive missed heartbeats before disconnect
  },
  
  "security": {
    "corsOrigins": ["*"],    // CORS allowed origins (* = all, or specify domains)
    "disableCors": false,    // Disable CORS entirely (useful for development)
    "maxMessageSize": 102400, // Maximum message size in bytes (100KB)
    "rateLimit": {           // Rate limiting for connections
      "enabled": true,
      "maxRequestsPerMinute": 300
    }
  },
  
  "logging": {
    "level": "info",         // Log level: debug, info, warn, error
    "logToFile": true,       // Whether to save logs to files
    "logDir": "logs",        // Directory for log files
    "logClientEvents": false // Whether to log all client events (verbose)
  },
  
  "notifications": {
    "maxFollowerNotifications": 10000, // Maximum recipients for a notification
    "throttleMs": 0,         // Delay between notifications (0 = no throttling)
    "maxContentSize": 10240  // Maximum notification content size in bytes (10KB)
  },
  
  "customSettings": {
    "appName": "WebSocket Server",
    "appVersion": "1.0.0",
    "adminContact": "admin@example.com",
    "typingTimeout": 5000    // Typing indicator timeout in milliseconds (5 seconds)
  }
}
```

## Environment-Specific Configuration

### Development Environment

For local development, you might want more verbose logging and local-only connections:

```json
// config.development.json
{
  "server": {
    "httpPort": 8080,
    "httpsPort": 8443,
    "host": "localhost"  // Only accept local connections
  },
  "logging": {
    "level": "debug",    // More verbose logging
    "logClientEvents": true
  },
  "security": {
    "disableCors": true  // Disable CORS for easier local development
  },
  "customSettings": {
    "enableDebugFeatures": true
  }
}
```

### Production Environment

For production, you should tighten security and optimize performance:

```json
// config.production.json
{
  "server": {
    "httpPort": 8080,
    "httpsPort": 8443,
    "host": "0.0.0.0"    // Accept connections on all interfaces
  },
  "heartbeat": {
    "interval": 60000,   // Less frequent heartbeats to reduce overhead
    "timeout": 10000     // Longer timeout for unreliable networks
  },
  "security": {
    "corsOrigins": ["https://yourdomain.com"],  // Restrict to your domain
    "disableCors": false,
    "rateLimit": {
      "maxRequestsPerMinute": 200  // Stricter rate limiting
    }
  },
  "logging": {
    "level": "warn",     // Less verbose logging
    "logClientEvents": false
  }
}
```

## Configuration Methods

There are several ways to configure the server:

### 1. Edit Configuration Files Directly

Edit the JSON files in the project root directory.

### 2. Environment Variables

Some core settings can be overridden with environment variables:

- `NODE_ENV` - Sets the environment (development, production)
- `HTTP_PORT` - Overrides the HTTP port
- `HTTPS_PORT` - Overrides the HTTPS port

Example:

```bash
NODE_ENV=production HTTP_PORT=9000 npm start
```

### 3. Command Line Arguments

The server menu provides options to configure ports interactively.

## Setting Up SSL/TLS

For secure WebSocket connections (WSS), you need SSL certificates:

### Option 1: Let's Encrypt (Built-in)

Generate certificates using the built-in Let's Encrypt integration:

1. From the server menu, select "Generate SSL Certificate"
2. Follow the prompts to specify your domain and contact email
3. Certificates will be automatically installed in the `certs` folder

### Option 2: Custom Certificates

To use existing certificates:

1. Place your certificate files in the `certs` directory:
   - `cert.pem` - Your certificate
   - `key.pem` - Your private key
2. The server will automatically use these certificates when starting

## Advanced Configuration

### CORS Configuration

Cross-Origin Resource Sharing controls which domains can connect to your WebSocket server:

```json
"security": {
  "corsOrigins": [
    "https://example.com",
    "https://admin.example.com"
  ],
  "disableCors": false
}
```

Set `corsOrigins` to `["*"]` to allow all domains, or list specific domains.

### Heartbeat Settings

The heartbeat system keeps connections alive and detects disconnections:

```json
"heartbeat": {
  "enabled": true,
  "interval": 30000,  // 30 seconds between heartbeats
  "timeout": 5000,    // 5 seconds to respond
  "maxMissed": 5      // Disconnect after 5 missed heartbeats
}
```

- Decrease `interval` for more responsive disconnection detection
- Increase `timeout` and `maxMissed` for unreliable networks

### Rate Limiting

Rate limiting protects against abuse:

```json
"rateLimit": {
  "enabled": true,
  "maxRequestsPerMinute": 300
}
```

### WebSocket Transport Options

Socket.IO transport options are configured internally:

- Both `polling` and `websocket` transports are enabled by default
- This provides maximum compatibility with clients and proxies

## IIS-Specific Configuration

When running under IIS with iisnode, some settings are handled differently:

- SSL/TLS is typically managed by IIS, not the Node.js application
- The `PORT` environment variable provided by IIS is used instead of the configured `httpPort`

See the [IIS Guide](iis-guide.md) for more information.

## Cloudflare Integration

When using Cloudflare for SSL/TLS:

- Configure your server according to your chosen Cloudflare SSL mode
- Update the CORS settings to include your domain:

```json
"corsOrigins": ["https://yourdomain.com"]
```

See the [Cloudflare Guide](cloudflare-guide.md) for more information.

# WS-Hub WebSocket Server

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-GPL-3.0-blue)](LICENSE)

A robust Socket.IO WebSocket server providing real-time bidirectional communication with secure connections support and flexible deployment options.

## 🌟 Features

- **Real-time Communication**: Using Socket.IO for reliable WebSocket connections
- **Multi-platform**: Runs on Windows, Linux and in cloud environments
- **Secure**: Built-in SSL/TLS support with automatic certificate management
- **IIS Integration**: Deploy directly to IIS or as a standalone application
- **Typing Indicators**: Real-time typing status for chat applications
- **User Management**: Track online users and manage user relationships
- **Notification System**: Send notifications to followers

## 📋 Requirements

- Node.js 14 or higher
- For SSL certificate generation:
  - Windows: Admin rights and Chocolatey package manager
  - Linux: sudo privileges
  - Port 80 open for Let's Encrypt validation

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/123B3n/ws-hub.git
cd ws-hub

# Install dependencies
npm install

# Create required directories
node env-setup.js
```

### Running in Development Mode

```bash
# Start with hot reloading
npm run dev
```

### Building & Running in Production

```bash
# Build the project
npm run build

# Start the server
npm start
```

## 🔐 SSL Certificate Options

You have several options for handling secure connections:

1. **Let's Encrypt**: Generate certificates directly through the application
2. **Cloudflare**: Let Cloudflare handle SSL/TLS
3. **IIS**: Use IIS's SSL capabilities when running as an IIS application

To generate a Let's Encrypt certificate:

```bash
npm run ssl
```

## 🖥️ Deployment Options

### Standalone Deployment

Run as a standard Node.js application using:

```bash
npm start
```

### IIS Deployment

See our [IIS Integration Wiki](../../wiki/IIS-Integration-Guide) for detailed instructions.

## 📚 Documentation

All documentation is available in the [project Wiki](https://github.com/123B3n/ws-hub/wiki):

- [Home](https://github.com/123B3n/ws-hub/wiki)
- [IIS Integration Guide](https://github.com/123B3n/ws-hub/wiki/IIS-Integration-Guide)
- [Cloudflare Guide](https://github.com/123B3n/ws-hub/wiki/Cloudflare-Guide)
- [Configuration Guide](https://github.com/123B3n/ws-hub/wiki/Configuration-Guide)
- [Client Integration Guide](https://github.com/123B3n/ws-hub/wiki/Client-Integration-Guide)
- [API Documentation](https://github.com/123B3n/ws-hub/wiki/API-Documentation)
- [Troubleshooting Guide](https://github.com/123B3n/ws-hub/wiki/Troubleshooting-Guide)

## 🛠️ Configuration

The server uses configuration files in the root directory:

- `config.json` - Default configuration
- `config.development.json` - Development environment overrides
- `config.production.json` - Production environment overrides

See our [Configuration Guide](../../wiki/Configuration-Guide) for details.

## 🔍 Troubleshooting

If you encounter issues, please check our [Troubleshooting Guide](../../wiki/Troubleshooting-Guide).

For connectivity issues, run:

```bash
node check-connectivity.js
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

# Troubleshooting Guide

This document provides solutions for common issues with the WebSocket Server.

## Connection Refused Issues

If you're getting "Connection Refused" errors when trying to access your WebSocket server:

### 1. Check the Server Status

Make sure the server is actually running:

```bash
# Check if the process is running
ps aux | grep node
# or on Windows
tasklist | findstr node
```

### 2. Verify Port Configuration

Check which ports the server is listening on:

```bash
# On Linux
netstat -tulpn | grep LISTEN
# On Windows
netstat -an | findstr LISTENING
```

### 3. Check Firewall Settings

Ensure ports 8080 and 8443 (or your configured ports) are open:

- **Windows**: Check Windows Firewall
  - Run `WF.msc` to open Windows Firewall with Advanced Security
  - Ensure there are inbound rules allowing your ports

- **Linux**: Check iptables or ufw
  - `sudo ufw status` to check ufw status
  - `sudo iptables -L -n` to check iptables rules

- **Cloud Providers**:
  - Check security groups (AWS)
  - Check firewall rules (Azure, Google Cloud)

### 4. Run the Connectivity Checker

We've included a connectivity checker script:

```bash
node check-connectivity.js
```

### 5. Test Local Connectivity First

Before trying remote connections, verify the server works locally:

```bash
curl http://localhost:8080/health
```

### 6. Server Binding Issues

The server might be binding only to localhost. Check the configuration to ensure it's binding to `0.0.0.0` (all interfaces):

```json
// In config.json
{
  "server": {
    "host": "0.0.0.0"
  }
}
```

### 7. HTTPS Certificate Issues

If SSL/TLS is enabled, certificate problems could cause connection issues:

- Ensure certificate files exist in the `/certs` directory
- Check certificate validity
- Consider using Cloudflare for SSL termination

### 8. IIS Mode Detection Issues

The server might incorrectly detect it's running under IIS. Debug by:

1. Setting environment variables explicitly:
   ```bash
   NODE_ENV=production node dist/server-direct.js
   ```

2. Check the server output for environment detection messages

### 9. Cloudflare Issues

If you're using Cloudflare:

- Ensure WebSockets are enabled in Cloudflare's Network settings
- Try setting SSL/TLS mode to "Flexible" for testing
- Temporarily bypass Cloudflare (gray cloud icon in DNS settings)

## Common Error Messages and Solutions

### EADDRINUSE

```
Error: listen EADDRINUSE: address already in use :::8080
```

**Solution**: Another process is using the port. Either stop that process or change the port in config.json.

### EACCES

```
Error: listen EACCES: permission denied :::80
```

**Solution**: Use ports above 1024 or run with sudo (not recommended for production).

### Certificate Errors

```
Error: self signed certificate
```

**Solution**: Either properly install a signed certificate or disable certificate validation in client (for testing only).

## Logging Tips

Enable detailed logging to diagnose issues:

```json
// In config.json
{
  "logging": {
    "level": "debug",
    "logClientEvents": true
  }
}
```

## Client-side Troubleshooting

For clients unable to connect:

1. **Check CORS Settings**:
   - Ensure the client origin is allowed in the server config
   - Temporary fix: set CORS to allow all origins (`"*"`)

2. **Transport Issues**:
   - Try forcing long polling:
     ```javascript
     const socket = io('https://your-domain.com:8443', {
       transports: ['polling']
     });
     ```

3. **Network Issues**:
   - Check browser console for errors
   - Verify client can reach the server (try opening the server URL in browser)

## Getting Help

If you're still having issues:

1. Collect logs from both server and client
2. Note your environment (OS, Node version, deployment method)
3. Check the GitHub issues for similar problems

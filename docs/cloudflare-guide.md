# Cloudflare SSL/TLS Integration Guide

![Cloudflare Logo](https://www.cloudflare.com/img/logo-cloudflare-dark.svg)

This guide explains how to use Cloudflare as your SSL/TLS provider for the WebSocket Server, eliminating the need to manually generate and renew Let's Encrypt certificates.

## Benefits of Using Cloudflare

Using Cloudflare as your SSL/TLS provider offers several advantages:

- **Free SSL/TLS Certificates**: No need to manage Let's Encrypt renewals
- **Automatic Certificate Management**: Cloudflare handles all certificate maintenance
- **DDoS Protection**: Basic protection even on free plans
- **Global CDN**: Faster content delivery worldwide
- **Easy Configuration**: Simple dashboard interface
- **Additional Security Features**: WAF, Bot Management, and more

## Setup Options

Cloudflare offers multiple SSL/TLS encryption modes:

| Mode | Description | Recommended For |
|------|-------------|-----------------|
| **Flexible** | HTTPS between user and Cloudflare, HTTP between Cloudflare and your server | Quick setup; less secure |
| **Full** | HTTPS everywhere; self-signed certificate on your server is acceptable | General use |
| **Full (Strict)** | HTTPS everywhere with validated certificate on your server | Highest security |
| **Origin Server** | Use your server's certificate exclusively | Specific requirements |

## Setup Steps

### 1. Create a Cloudflare Account

1. Sign up at [cloudflare.com](https://cloudflare.com) if you don't already have an account
2. Verify your email address

### 2. Add Your Domain to Cloudflare

1. Log in to your Cloudflare account
2. Click "Add a Site" and enter your domain name
3. Select a plan (the Free plan works for most users)
4. Cloudflare will scan for existing DNS records
5. Verify the DNS records are correct
6. Follow the instructions to change your domain nameservers to Cloudflare's nameservers
7. Wait for DNS propagation (usually takes a few hours)

### 3. Configure SSL/TLS Settings

1. Go to the "SSL/TLS" tab in your Cloudflare dashboard
2. Choose the appropriate encryption mode:
   - For the simplest setup, select "Flexible" (no certificates needed on your server)
   - For better security, select "Full" (self-signed certificate on your server)
3. Keep "Always Use HTTPS" enabled in the Edge Certificates section

### 4. Enable WebSocket Support

WebSocket support is critical for the WebSocket Server:

1. Go to the "Network" tab
2. Ensure "WebSockets" is set to "On"

![WebSockets Setting](assets/cloudflare-websocket-setting.png)

### 5. Create DNS Record for Your WebSocket Server

1. Go to the "DNS" tab
2. Create an "A" record pointing to your server's IP address:
   - Name: Enter subdomain or `@` for root domain
   - IPv4 address: Your server's public IP address
   - Proxy status: Proxied (orange cloud)

### 6. Configure Your Server

When using Cloudflare with your WebSocket server, your configuration depends on the SSL/TLS mode:

#### For Flexible SSL/TLS Mode

Configure your server to accept HTTP traffic:

```json
// config.json
{
  "server": {
    "httpPort": 8080,
    "host": "0.0.0.0"
  }
}
```

#### For Full or Full (Strict) SSL/TLS Mode

Configure your server with SSL:

```json
// config.json
{
  "server": {
    "httpsPort": 8443,
    "host": "0.0.0.0"
  }
}
```

Then generate SSL certificates (self-signed for Full mode or valid certificate for Strict mode).

### 7. Client Connection Code

Connect to your WebSocket server from client applications:

```javascript
// Connect to WebSocket server through Cloudflare
const socket = io('wss://your-domain.com', {
  path: '/socket.io',
  reconnection: true,
  timeout: 20000
});
```

## Handling WebSocket Connections with Cloudflare

Cloudflare has some limitations for WebSocket connections:

- Free Cloudflare plans have a 100-second timeout for WebSocket connections
- Business and Enterprise plans have longer timeouts (typically 30 minutes)

To handle these limitations:

1. Implement reconnection logic in your client code
2. Use ping/pong messages to keep connections alive

```javascript
// Client-side reconnection example
const socket = io('wss://your-domain.com', {
  path: '/socket.io',
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  timeout: 20000
});

// Handle disconnections
socket.on('disconnect', (reason) => {
  console.log(`Disconnected: ${reason}`);
  if (reason === 'io server disconnect') {
    // The server has forcefully disconnected
    socket.connect();
  }
  // else the socket will automatically try to reconnect
});
```

## Using IIS with Cloudflare

If you're using IIS with Cloudflare:

1. Configure IIS to handle the HTTP traffic from Cloudflare (Flexible mode) or HTTPS (Full/Strict mode)
2. Ensure WebSocket processing is correctly set up in your web.config
3. Set the correct binding in IIS for your site

See our [IIS Guide](iis-guide.md) for more detailed instructions.

## Security Considerations

1. **IP Restrictions**: Be cautious with IP-based security rules as traffic will come from Cloudflare's IPs
2. **Cloudflare Token**: Consider using Cloudflare's authenticated origin pulls for additional security
3. **Rate Limiting**: Set up rate limiting in Cloudflare to prevent abuse

## Troubleshooting

### WebSocket Connection Errors

1. Verify WebSocket is enabled in Cloudflare Network settings
2. Ensure your firewall allows Cloudflare IPs (available in the Cloudflare dashboard)
3. Check that your server is correctly handling WebSocket upgrade requests

### Mixed Content Warnings

If your site has mixed content warnings:
1. Enable "Always Use HTTPS" in Cloudflare SSL/TLS settings
2. Set up Page Rules to redirect HTTP to HTTPS

### "Error 1102" or "Connection Refused"

This typically means your origin server isn't accepting connections from Cloudflare:
1. Ensure your server is running and accepting connections
2. Check firewall rules to confirm Cloudflare IPs are allowed

## Additional Resources

- [Cloudflare Documentation](https://developers.cloudflare.com/fundamentals/)
- [Cloudflare WebSockets Support](https://developers.cloudflare.com/fundamentals/network/websockets/)
- [Cloudflare SSL/TLS Documentation](https://developers.cloudflare.com/ssl/)
- [Cloudflare IP Ranges](https://www.cloudflare.com/ips/)

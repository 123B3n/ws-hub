# Microsoft IIS Integration Guide

This guide explains how to deploy the WebSocket server with Microsoft Internet Information Services (IIS).

## Overview

There are two ways to deploy the WebSocket Server with IIS:

1. **Reverse Proxy Method**: Run the Node.js server as a separate process and proxy WebSocket connections through IIS
2. **Direct Hosting Method**: Host the Node.js application directly within IIS using the iisnode module

Each approach has advantages and you can choose the one that best fits your environment.

## Prerequisites

For both deployment methods, you'll need:

- Windows Server with IIS installed
- Node.js installed on the server
- URL Rewrite Module for IIS ([download](https://www.iis.net/downloads/microsoft/url-rewrite))

For the direct hosting method, you'll also need:
- iisnode module installed ([download](https://github.com/Azure/iisnode/releases))

## Method 1: Reverse Proxy (Recommended for Most Users)

This method runs the Node.js server as a separate process while IIS acts as a reverse proxy.

### Step 1: Configure Your WebSocket Server

Ensure your config.json has appropriate settings:

```json
{
  "server": {
    "httpPort": 8080,
    "httpsPort": 8443,
    "host": "localhost"
  }
}
```

### Step 2: Set Up Your Website in IIS

1. Open IIS Manager
2. Create a new website or use an existing one
3. Configure site bindings for your domain

### Step 3: Configure URL Rewrite Rules

Create a `web.config` file in your website's root directory:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <system.webServer>
        <rewrite>
            <rules>
                <rule name="ReverseProxySocketIO" stopProcessing="true">
                    <match url="socket.io/(.*)"/>
                    <action type="Rewrite" url="http://localhost:8080/socket.io/{R:1}"/>
                </rule>
            </rules>
        </rewrite>
        <webSocket enabled="false"/>
    </system.webServer>
</configuration>
```

### Step 4: Install Application Request Routing (ARR)

1. Download and install [Application Request Routing](https://www.iis.net/downloads/microsoft/application-request-routing)
2. Open IIS Manager
3. Select the server in the left panel
4. Double-click "Application Request Routing Cache"
5. Click "Server Proxy Settings..." in the right panel
6. Check "Enable proxy" and click "Apply"

### Step 5: Start Your Node.js Server

Run the server as a background service using a process manager like pm2:

```bash
npm install -g pm2
pm2 start npm -- start
pm2 save
pm2 startup
```

### Step 6: Configure Your Client

Connect from your client application using the IIS website URL:

```javascript
const socket = io('wss://your-domain.com', {
  path: '/socket.io'
});
```

## Method 2: Direct Hosting with iisnode

This method hosts your Node.js application directly within IIS using the iisnode module.

### Step 1: Prepare Your Application

Build your application and prepare it for IIS:

```bash
npm run prepare:iis
```

This runs the build process and sets up the required files including web.config.

### Step 2: Create an IIS Website

1. Open IIS Manager
2. Right-click on "Sites" and select "Add Website"
3. Fill in the required information:
   - Site name: `WebSocket`
   - Physical path: Select the path to your project folder
   - Binding: Set host name, IP address, and port as needed
4. Click OK

### Step 3: Configure Application Pool

1. Select "Application Pools" in the connections panel
2. Find the application pool for your website
3. Right-click and select "Advanced Settings"
4. Make these changes:
   - Set "Enable 32-Bit Applications" to "False" if using 64-bit Node.js
   - Set "Identity" to a user with appropriate permissions
   - Click OK

### Step 4: Set Directory Permissions

Ensure the IIS application pool identity has read and write access to your application directory:

1. Right-click on your project folder and select "Properties"
2. Go to the "Security" tab
3. Click "Edit" and then "Add"
4. Add the application pool identity (typically `IIS AppPool\WebSocket`)
5. Grant "Read & Execute", "List folder contents", and "Read" permissions
6. Add write permission to the `certs`, `iisnode`, and `logs` directories

### Step 5: Test Your Deployment

1. Browse to your website URL
2. Check for any errors in:
   - The browser developer console
   - The iisnode logs (in the `iisnode` directory)
   - Windows Event Viewer

## Managing SSL with IIS

When running under IIS, SSL certificates are typically managed by IIS rather than within the Node.js application:

### For Reverse Proxy Method

1. Configure SSL certificate in your IIS site binding
2. Update the web.config to use HTTPS in the rewrite rule if your Node.js server uses HTTPS:

```xml
<rule name="ReverseProxySocketIO" stopProcessing="true">
    <match url="socket.io/(.*)"/>
    <action type="Rewrite" url="https://localhost:8443/socket.io/{R:1}"/>
</rule>
```

### For Direct Hosting Method

1. Configure SSL certificate in your IIS site binding
2. The Node.js application will run in HTTP mode, but IIS will handle the SSL termination

## Troubleshooting IIS Deployment

### Cannot Connect to WebSocket Server

- Verify WebSockets are enabled in IIS:
  - Open IIS Manager > Select your server > WebSocket > Enable
- Make sure Application Request Routing proxy is enabled (for Reverse Proxy method)
- Check URL Rewrite rules are correctly configured

### 503 Service Unavailable

- Make sure your Node.js server is running (for Reverse Proxy method)
- Check the application pool is running
- Review Event Viewer for application crashes

### 500 Internal Server Error

Check the iisnode logs in the `iisnode` directory in your application folder.

### 404 File Not Found

- Verify the physical path for your website is correct
- Check that the Node.js entry point file exists

## Additional Resources

- [IIS URL Rewrite Module Documentation](https://docs.microsoft.com/en-us/iis/extensions/url-rewrite-module/using-the-url-rewrite-module)
- [Application Request Routing Documentation](https://docs.microsoft.com/en-us/iis/extensions/planning-for-arr/using-the-application-request-routing-module)
- [iisnode GitHub Repository](https://github.com/Azure/iisnode)
- [Socket.IO Behind Proxy Documentation](https://socket.io/docs/v4/using-multiple-nodes/)

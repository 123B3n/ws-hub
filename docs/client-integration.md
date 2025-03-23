# Client Integration Guide

This guide explains how to integrate client applications with the WebSocket Server.

## Quick Start

### Basic Connection

```javascript
// Connect to the WebSocket server
const socket = io('https://your-domain.com', {
  path: '/socket.io',
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

// Connection event handlers
socket.on('connect', () => {
  console.log('Connected to server with ID:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected from server:', reason);
});

socket.on('system:error', (data) => {
  console.error('Socket error:', data);
});
```

### Setting User Data

Set your username and other information:

```javascript
// Set basic user info
socket.emit('system:setData', {
  username: 'AstroHunter',
  following: ['StellarTrader42', 'CosmicCollector', 'NebulaNomad'],
  profile: {
    displayName: 'Jamie',
    avatar: 'https://example.com/avatar.png',
    bio: 'WebSocket enthusiast'
  }
});
```

### Sending Messages

```javascript
// Send a general broadcast
socket.emit('system:general', {
  type: 'chatMessage',
  message: 'Hello world!'
});

// Send a direct message
socket.emit('direct', {
  target: 'StellarTrader42',  // Username of recipient
  type: 'privateMessage',
  message: 'Hi there, just for you'
});
```

## Socket.IO Client Setup

### Web Browser

Include the Socket.IO client library:

```html
<script src="https://cdn.socket.io/4.6.0/socket.io.min.js"></script>
```

### Node.js

Install and import the Socket.IO client:

```bash
npm install socket.io-client
```

```javascript
import { io } from 'socket.io-client';
```

### React Native

Install the Socket.IO client:

```bash
npm install socket.io-client
```

```javascript
import { io } from 'socket.io-client';
```

## Connection Options

### Standard Connection

```javascript
const socket = io('https://your-domain.com', {
  path: '/socket.io',
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});
```

### Connection with SSL/TLS

```javascript
// Secure WebSocket connection (wss://)
const socket = io('wss://your-domain.com', {
  path: '/socket.io'
});
```

### Connection with Custom Port

```javascript
const socket = io('https://your-domain.com:8443', {
  path: '/socket.io'
});
```

### Connection with Transport Options

```javascript
const socket = io('https://your-domain.com', {
  path: '/socket.io',
  transports: ['websocket', 'polling'] // Try WebSocket first, fall back to polling
});
```

## Key Features

### Real-time Messaging

#### General Broadcast

Send messages to all connected clients:

```javascript
// Send a broadcast - only 'type' is required, all other fields are flexible
socket.emit('system:general', {
  type: 'chatMessage',      // Required field
  message: 'Hello everyone!',
  // Add any additional fields you need - they will be preserved
  importance: 'high',
  category: 'announcement',
  formatting: {
    bold: true,
    color: 'red'
  }
});

// Receive broadcasts - includes all original fields plus sender metadata
socket.on('system:general', (data) => {
  console.log(`Broadcast from ${data.sender.username}: ${data.message}`);
  console.log(`Importance: ${data.importance}`); // Your custom fields are preserved
  console.log(`Category: ${data.category}`);     // Your custom fields are preserved
  
  // Even complex nested objects are preserved
  if (data.formatting) {
    applyFormatting(data.message, data.formatting);
  }
});
```

#### Direct Messages

Send messages to specific users:

```javascript
// Send a direct message - 'target' and 'type' are required, other fields are flexible
socket.emit('system:direct', {
  target: 'CosmicCollector',   // Required - username of recipient
  type: 'privateMessage',      // Required - message type
  message: 'Hello just to you!',
  // Add any additional fields you need
  isUrgent: true,
  replyTo: 'message-123',
  attachments: [
    { type: 'image', url: 'https://example.com/image.jpg' }
  ]
});

// Receive direct messages - includes all original fields plus sender metadata
socket.on('system:direct', (data) => {
  console.log(`Message from ${data.sender.username}: ${data.message}`);
  
  // Access any custom fields you sent
  if (data.isUrgent) {
    playUrgentNotification();
  }
  
  if (data.attachments && data.attachments.length > 0) {
    displayAttachments(data.attachments);
  }
});
```

### Typing Indicators

Show when users are typing:

```javascript
// Send typing indicator when user starts typing
function handleUserTyping(isTyping, recipientUsername) {
  if (isTyping) {
    socket.emit('system:typingStart', { target: recipientUsername });
  } else {
    socket.emit('system:typingStop', { target: recipientUsername });
  }
}

// Listen for typing indicators from others
socket.on('system:typingUpdate', (data) => {
  if (data.isTyping) {
    showTypingIndicator(data.sender.username);
  } else {
    hideTypingIndicator(data.sender.username);
  }
});

// Example implementation with a textarea
const messageInput = document.getElementById('messageInput');
let typingTimer;
let isCurrentlyTyping = false;

messageInput.addEventListener('keyup', function() {
  clearTimeout(typingTimer);
  
  if (this.value.length > 0) {
    // User is typing
    if (!isCurrentlyTyping) {
      handleUserTyping(true, recipientUsername);
      isCurrentlyTyping = true;
    }
    
    // Set a timeout to detect when typing stops
    typingTimer = setTimeout(() => {
      handleUserTyping(false, recipientUsername);
      isCurrentlyTyping = false;
    }, 1000);
  } else {
    // Input is empty
    handleUserTyping(false, recipientUsername);
    isCurrentlyTyping = false;
  }
});
```

### Notifications

Send notifications to followers:

```javascript
// Send notification to all followers - 'type' and 'content' are required
// The structure of 'content' is flexible and depends on the notification type
socket.emit('system:notification', {
  type: 'post',  // Required - identifies notification category
  content: {     // Required - flexible structure based on type
    postId: '12345',
    title: 'Check out my new article',
    summary: 'Learn about WebSocket integration',
    // Add any additional content fields
    thumbnail: 'https://example.com/thumb.jpg',
    readTimeMinutes: 5,
    tags: ['websockets', 'tutorial']
  },
  // Add optional metadata outside the content object
  priority: 'normal',
  groupId: 'tech-posts'
});

// Receive notifications - includes all original fields plus sender metadata
socket.on('system:notification', (notification) => {
  console.log(`Notification from ${notification.sender.username}`);
  console.log(`Type: ${notification.type}`);
  
  // Access the content with its flexible structure
  const content = notification.content;
  displayNotification({
    title: content.title,
    body: content.summary,
    image: content.thumbnail,
    tags: content.tags,
    // Access any custom fields you sent
    readTime: content.readTimeMinutes ? `${content.readTimeMinutes} min read` : null,
    priority: notification.priority
  });
});
```

### Following Users

Update your following list to receive notifications:

```javascript
// Update who you're following
socket.emit('system:setData', {
  following: ['StellarTrader42', 'CosmicCollector', 'NebulaNomad']
});

// Listen for new followers
socket.on('system:followed', (data) => {
  console.log(`${data.username} started following you!`);
});
```

## Handling Connection Events

### Reconnection

Handle reconnection scenarios:

```javascript
// Configure reconnection
const socket = io('https://your-domain.com', {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000
});

// Track reconnection attempts
socket.on('reconnect_attempt', (attempt) => {
  console.log(`Reconnection attempt ${attempt}`);
});

socket.on('reconnect', () => {
  console.log('Reconnected to server');
  // Re-establish session data
  setUserData();
});

socket.on('reconnect_error', (error) => {
  console.error('Reconnection error:', error);
});

socket.on('reconnect_failed', () => {
  console.error('Failed to reconnect after all attempts');
});
```

### Heartbeats

The server uses heartbeats to detect disconnections. Your client should automatically respond to these:

```javascript
socket.on('system:heartbeat', (data) => {
  // Respond immediately with acknowledgment
  socket.emit('system:heartbeat-ack', { id: data.id });
});
```

## Security Considerations

### Authentication

The WebSocket server itself doesn't handle authentication, but you can implement it by:

1. Authenticating with your main application
2. Passing authentication tokens in connection parameters
3. Setting user identity after connection

Example with authentication token:

```javascript
// Connect with auth token
const socket = io('https://your-domain.com', {
  path: '/socket.io',
  auth: {
    token: 'user-auth-token'
  }
});

// Set up authError handler
socket.on('system:authError', (err) => {
  console.error('Authentication error:', err);
  // Redirect to login page
  window.location.href = '/login';
});
```

### Data Validation

Always validate data from clients and servers:

```javascript
// Validate incoming messages
socket.on('system:direct', (data) => {
  // Validate message has required fields
  if (!data || !data.sender || !data.type) {
    console.error('Invalid message format:', data);
    return;
  }
  
  // Process validated message
  console.log(`Message from ${data.sender.username}: ${data.message}`);
});
```

## Troubleshooting

### Unable to Connect

If you're having trouble connecting:

- Check that the server is running
- Verify the URL, port, and path are correct
- Ensure SSL certificates are valid for secure connections
- Check browser console for CORS errors

### Connection Drops Frequently

If connections are unstable:

- Increase heartbeat timeout in server config
- Add reconnection logic to your client
- Check network stability and latency
- Verify Cloudflare timeouts if you're using Cloudflare

### Cross-Origin (CORS) Issues

If you see CORS errors:

- Make sure your client domain is allowed in the server's CORS settings
- For development, enable `disableCors: true` in server config
- Use matching protocols (HTTP/HTTPS) for client and server

### Debugging Tips

Enable more verbose logging:

```javascript
// Enable Socket.IO debug logs
localStorage.debug = 'socket.io-client:*';

// Connect with additional debugging
const socket = io('https://your-domain.com', {
  path: '/socket.io',
  debug: true
});

// Log all events
const originalOnEvent = socket.onevent;
socket.onevent = function(packet) {
  console.log('Event:', packet.data[0], packet.data.slice(1));
  originalOnEvent.call(this, packet);
};
```

## Complete Example Client

Here's a complete example showing a basic chat application:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chat Example</title>
    <script src="https://cdn.socket.io/4.6.0/socket.io.min.js"></script>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .chat-container { border: 1px solid #ddd; border-radius: 8px; height: 400px; display: flex; flex-direction: column; }
        .message-list { flex: 1; overflow-y: auto; padding: 10px; }
        .message-input { display: flex; padding: 10px; border-top: 1px solid #ddd; }
        .message-input input { flex: 1; padding: 8px; }
        .message-input button { margin-left: 10px; }
        .message { margin: 5px 0; padding: 5px; }
        .message.own { background-color: #e6f7ff; text-align: right; }
        .message.other { background-color: #f2f2f2; }
        .status { color: #666; font-style: italic; margin: 5px 0; }
        .typing-indicator { color: #666; font-style: italic; height: 20px; }
    </style>
</head>
<body>
    <h1>Chat Example</h1>
    
    <div>
        <label for="server-url">Server URL:</label>
        <input type="text" id="server-url" value="http://localhost:8080" />
        <label for="username">Username:</label>
        <input type="text" id="username" value="User_" />
        <button id="connect-btn">Connect</button>
        <span id="connection-status">Disconnected</span>
    </div>

    <div class="chat-container">
        <div id="message-list" class="message-list"></div>
        <div id="typing-indicator" class="typing-indicator"></div>
        <div class="message-input">
            <input type="text" id="recipient" placeholder="Recipient username" />
            <input type="text" id="message-input" placeholder="Type a message..." disabled />
            <button id="send-btn" disabled>Send</button>
        </div>
    </div>

    <script>
        // DOM elements
        const serverUrlInput = document.getElementById('server-url');
        const usernameInput = document.getElementById('username');
        const connectBtn = document.getElementById('connect-btn');
        const connectionStatus = document.getElementById('connection-status');
        const messageList = document.getElementById('message-list');
        const typingIndicator = document.getElementById('typing-indicator');
        const recipientInput = document.getElementById('recipient');
        const messageInput = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-btn');
        
        let socket;
        let username;
        let connected = false;
        let typingTimer;
        let isCurrentlyTyping = false;
        
        // Generate random username if not provided
        if (usernameInput.value === 'User_') {
            usernameInput.value += Math.floor(Math.random() * 1000);
        }
        
        // Connect to server
        connectBtn.addEventListener('click', () => {
            const serverUrl = serverUrlInput.value;
            username = usernameInput.value;
            
            if (!serverUrl || !username) {
                alert('Please enter both server URL and username');
                return;
            }
            
            try {
                socket = io(serverUrl, {
                    path: '/socket.io',
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1000,
                    transports: ['polling', 'websocket']
                });
                
                // Connection events
                socket.on('connect', () => {
                    connected = true;
                    connectionStatus.textContent = `Connected (${socket.id})`;
                    messageInput.disabled = false;
                    sendBtn.disabled = false;
                    addStatusMessage(`Connected to server`);
                    
                    // Set username
                    socket.emit('system:setData', { username });
                    addStatusMessage(`Set username to ${username}`);
                });
                
                socket.on('disconnect', () => {
                    connected = false;
                    connectionStatus.textContent = 'Disconnected';
                    messageInput.disabled = true;
                    sendBtn.disabled = true;
                    addStatusMessage(`Disconnected from server`);
                });
                
                // Handle errors
                socket.on('system:error', (data) => {
                    addStatusMessage(`Error: ${data.message}`);
                });
                
                // Direct messages
                socket.on('system:direct', (data) => {
                    addMessage(data.sender.username, data.message, false);
                });
                
                // Typing indicators
                socket.on('system:typingUpdate', (data) => {
                    if (data.isTyping) {
                        typingIndicator.textContent = `${data.sender.username} is typing...`;
                    } else {
                        typingIndicator.textContent = '';
                    }
                });
                
                // Heartbeat handler
                socket.on('system:heartbeat', (data) => {
                    socket.emit('system:heartbeat-ack', { id: data.id });
                });
                
            } catch (error) {
                addStatusMessage(`Connection error: ${error.message}`);
            }
        });
        
        // Send message
        sendBtn.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        
        function sendMessage() {
            const recipient = recipientInput.value;
            const messageText = messageInput.value;
            
            if (!socket || !connected) {
                alert('Not connected to server');
                return;
            }
            
            if (!recipient) {
                alert('Please enter a recipient username');
                return;
            }
            
            if (!messageText) {
                return;
            }
            
            // Send direct message
            socket.emit('system:direct', {
                target: recipient,
                type: 'chatMessage',
                message: messageText
            });
            
            // Stop typing indicator
            if (isCurrentlyTyping) {
                socket.emit('system:typingStop', { target: recipient });
                isCurrentlyTyping = false;
            }
            
            // Display in our message list
            addMessage(username, messageText, true);
            
            // Clear input
            messageInput.value = '';
        }
        
        // Typing indicator
        messageInput.addEventListener('keyup', function() {
            if (!connected) return;
            
            const recipient = recipientInput.value;
            if (!recipient) return;
            
            clearTimeout(typingTimer);
            
            if (this.value.length > 0) {
                if (!isCurrentlyTyping) {
                    socket.emit('system:typingStart', { target: recipient });
                    isCurrentlyTyping = true;
                }
                
                typingTimer = setTimeout(() => {
                    socket.emit('system:typingStop', { target: recipient });
                    isCurrentlyTyping = false;
                }, 1000);
            } else {
                if (isCurrentlyTyping) {
                    socket.emit('system:typingStop', { target: recipient });
                    isCurrentlyTyping = false;
                }
            }
        });
        
        // Helper functions
        function addMessage(sender, text, isOwn) {
            const messageElement = document.createElement('div');
            messageElement.className = `message ${isOwn ? 'own' : 'other'}`;
            messageElement.innerHTML = `<strong>${sender}:</strong> ${text}`;
            messageList.appendChild(messageElement);
            messageList.scrollTop = messageList.scrollHeight;
        }
        
        function addStatusMessage(text) {
            const statusElement = document.createElement('div');
            statusElement.className = 'status';
            statusElement.textContent = text;
            messageList.appendChild(statusElement);
            messageList.scrollTop = messageList.scrollHeight;
        }
    </script>
</body>
</html>
```

## Data Structure Flexibility

The WebSocket Server is designed to be as flexible as possible when it comes to message structures. This allows developers to extend the system with custom fields and data without modifying the server.

### General Principles

1. **Required vs. Optional Fields**: Each event type has a minimal set of required fields (documented above), but you can include any additional fields.

2. **Data Preservation**: Any fields you include in your messages will be preserved and sent to recipients without modification (except for server-added metadata like sender information and timestamps).

3. **Handling Unknown Fields**: When receiving messages, be prepared to handle fields that weren't in your original message. Other clients or future versions might add new fields.

4. **Type-Safe Coding**: When building robust applications, consider using TypeScript interfaces to define your expected message structures while still allowing for extensions.

### Example of Extended Message Types

```typescript
// Example TypeScript interface for a chat message with custom fields
interface ChatMessage {
  // Required fields
  type: 'chatMessage';
  
  // Common optional fields
  message?: string;
  
  // Application-specific extensions
  formatting?: {
    bold?: boolean;
    italic?: boolean;
    color?: string;
  };
  replyTo?: string;
  attachments?: Attachment[];
  reactions?: Record<string, number>;
}

// The server will preserve and forward all these fields
```

# API Documentation

This document provides a comprehensive reference for all WebSocket events supported by the WS-Hub WebSocket Server.

## Table of Contents

- [Connection Events](#connection-events)
- [System Events](#system-events)
- [General Messages](#general-messages)
- [Direct Messages](#direct-messages)
- [Notifications](#notifications)
- [Typing Indicators](#typing-indicators)
- [Heartbeat System](#heartbeat-system)
- [Error Handling](#error-handling)
- [Complete Event Reference](#complete-event-reference)

## Connection Events

These events are part of the Socket.IO connection lifecycle.

### Client Events

| Event Name | Description | Parameters |
|------------|-------------|------------|
| `connect` | Emitted when connection is established | None |
| `disconnect` | Emitted when disconnected from server | `reason`: String - reason for disconnection |
| `system:error` | Emitted on connection error | Error object |
| `reconnect` | Emitted when successfully reconnected | `attemptNumber`: Number - which retry succeeded |
| `reconnect_attempt` | Emitted on each reconnection attempt | `attemptNumber`: Number - attempt count |
| `reconnect_failed` | Emitted when all reconnection attempts fail | None |

### Usage Example

```javascript
// Connect to server
const socket = io('https://your-domain.com', {
  path: '/socket.io',
  reconnection: true
});

// Listen for connection events
socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
```

## System Events

These events handle system-level functionality like user data management and server statistics.

### Client → Server Events

| Event Name | Description | Required Parameters | Optional Parameters |
|------------|-------------|---------------------|---------------------|
| `system:setData` | Update user data | `username`: String | `following`: String[], `profile`: Object |
| `system:clients` | Request list of connected clients | None | None |
| `client-ping` | Client ping to keep connection alive | None | None |

### Server → Client Events

| Event Name | Description | Parameters |
|------------|-------------|------------|
| `system:dataSet` | Response when user data updated | `success`: Boolean, `updatedFields`: String[], `error?`: String |
| `system:welcome` | Sent on successful connection | `message`: String, `timestamp`: Date |
| `system:stats` | Server statistics update | `activeConnections`: Number, `totalConnections`: Number, `timestamp`: Date |
| `system:clients` | List of connected clients | `clients`: Array of client objects, `count`: Number, `timestamp`: Date |
| `client-pong` | Server response to client ping | `timestamp`: String |
| `system:certificateRefresh` | Notification when server certificates updated | `message`: String, `timestamp`: Date |

### Example: Updating User Data

```javascript
// Client sends user data
socket.emit('system:setData', {
  username: 'john_doe',
  following: ['jane_doe', 'bob_smith'],
  profile: {
    displayName: 'John Doe',
    avatar: 'avatar-url.jpg'
  }
});

// Client listens for confirmation
socket.on('system:dataSet', (response) => {
  if (response.success) {
    console.log('Updated fields:', response.updatedFields);
  } else {
    console.error('Error updating data:', response.error);
  }
});
```

## General Messages

These events handle broadcast messages sent to all connected clients.

### Client → Server Events

| Event Name | Description | Required Parameters | Optional Parameters |
|------------|-------------|---------------------|---------------------|
| `system:general` | Send a broadcast message | `type`: String | Additional message data as needed |

### Server → Client Events

| Event Name | Description | Parameters |
|------------|-------------|------------|
| `system:general` | Broadcast message received | `sender`: Object (id, username, profile), `type`: String, `timestamp`: Date, `broadcast`: Boolean, + original message data |
| `system:generalSent` | Confirmation that broadcast was sent | `success`: Boolean, `originalMessage`: Object, `timestamp`: Date |

### Example: Sending a Broadcast Message

```javascript
// Client sends a broadcast message
socket.emit('system:general', {
  type: 'announcement',
  message: 'Hello everyone!',
  importance: 'high'
});

// Client listens for confirmation
socket.on('system:generalSent', (data) => {
  if (data.success) {
    console.log('Broadcast sent at', data.timestamp);
  }
});

// All clients (including sender) receive the broadcast
socket.on('system:general', (data) => {
  console.log(`${data.sender.username} sent: ${data.message}`);
});
```

## Direct Messages

These events handle private messages between specific users.

### Client → Server Events

| Event Name | Description | Required Parameters | Optional Parameters |
|------------|-------------|---------------------|---------------------|
| `system:direct` | Send a direct message | `target`: String (recipient username), `type`: String | Additional message data as needed |

### Server → Client Events

| Event Name | Description | Parameters |
|------------|-------------|------------|
| `system:direct` | Direct message received | `sender`: Object (id, username, profile), `type`: String, `timestamp`: Date, + original message data |
| `system:directSent` | Confirmation that message was sent | `success`: Boolean, `target`: String, `reason?`: String, `timestamp`: Date |

### Example: Sending a Direct Message

```javascript
// Client sends a direct message
socket.emit('system:direct', {
  target: 'jane_doe',
  type: 'chatMessage',
  message: 'Hello Jane!'
});

// Client listens for confirmation
socket.on('system:directSent', (data) => {
  if (data.success) {
    console.log(`Message delivered to ${data.target}`);
  } else {
    console.error(`Message failed: ${data.reason}`);
  }
});

// Recipient receives the message
socket.on('system:direct', (data) => {
  console.log(`${data.sender.username} says: ${data.message}`);
});
```

## Typing Indicators

These events handle real-time typing status between users.

### Client → Server Events

| Event Name | Description | Required Parameters |
|------------|-------------|---------------------|
| `system:typingStart` | Indicate user started typing | `target`: String (recipient username) |
| `system:typingStop` | Indicate user stopped typing | `target`: String (recipient username) |

### Server → Client Events

| Event Name | Description | Parameters |
|------------|-------------|------------|
| `system:typingUpdate` | Update on typing status | `sender`: Object (id, username, profile), `isTyping`: Boolean, `timestamp`: Date |

### Example: Implementing Typing Indicators

```javascript
// When user starts typing
messageInput.addEventListener('keydown', function() {
  if (!isCurrentlyTyping) {
    socket.emit('system:typingStart', { target: recipientUsername });
    isCurrentlyTyping = true;
  }
  
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    socket.emit('system:typingStop', { target: recipientUsername });
    isCurrentlyTyping = false;
  }, 1000); // Stop indicator after 1 second of inactivity
});

// Listen for typing indicators from others
socket.on('system:typingUpdate', (data) => {
  if (data.isTyping) {
    typingIndicator.textContent = `${data.sender.username} is typing...`;
  } else {
    typingIndicator.textContent = '';
  }
});
```

## Notifications

These events handle user notifications.

### Client → Server Events

| Event Name | Description | Required Parameters | Optional Parameters |
|------------|-------------|---------------------|---------------------|
| `system:notification` | Send notification | `type`: String, `content`: Object | `targets`: String[] |

### Server → Client Events

| Event Name | Description | Parameters |
|------------|-------------|------------|
| `system:notification` | Notification received | `sender`: Object (id, username, profile), `type`: String, `content`: Object, `timestamp`: Date |
| `system:notificationSent` | Confirmation notification was sent | `success`: Boolean, `recipientCount`: Number, `timestamp`: Date |

### Example: Sending a Notification

```javascript
// Client sends a notification
socket.emit('system:notification', {
  type: 'friendRequest',
  content: { 
    message: 'I would like to add you as a friend' 
  },
  targets: ['jane_doe'] // Optional: specific recipients; omit to send to all followers
});

// Client listens for confirmation
socket.on('system:notificationSent', (data) => {
  console.log(`Notification sent to ${data.recipientCount} recipients`);
});

// Recipients receive the notification
socket.on('system:notification', (data) => {
  console.log(`${data.sender.username} sent a ${data.type} notification`);
});
```

## Heartbeat System

The server uses a heartbeat mechanism to detect disconnections. Clients must acknowledge heartbeats to remain connected.

### Server → Client Events

| Event Name | Description | Parameters |
|------------|-------------|------------|
| `system:heartbeat` | Heartbeat check from server | `id`: String (unique heartbeat ID) |
| `system:heartbeat-warning` | Warning about connection issues | `message`: String, `missedHeartbeats`: Number |

### Client → Server Events  

| Event Name | Description | Required Parameters | Optional Parameters |
|------------|-------------|---------------------|---------------------|
| `system:heartbeat-ack` | Acknowledge heartbeat | `id`: String (heartbeat ID) | `timestamp`: Date |

### Example: Implementing Heartbeat Response

```javascript
// Respond to heartbeats automatically
socket.on('system:heartbeat', (data) => {
  socket.emit('system:heartbeat-ack', { 
    id: data.id,
    timestamp: new Date()
  });
});

// Handle warnings about connection issues
socket.on('system:heartbeat-warning', (data) => {
  console.warn(`Connection warning: ${data.message}`);
  // Consider reconnecting or alerting user
});
```

## Error Handling

The server emits error events when issues occur with client requests.

### Server → Client Events

| Event Name | Description | Parameters |
|------------|-------------|------------|
| `system:error` | Error information | `code`: String (error code), `message`: String (error description) |

### Common Error Codes

| Error Code | Description |
|------------|-------------|
| `INVALID_FORMAT` | Invalid data format in request |
| `NO_USERNAME` | Action requires setting username first |
| `TARGET_NOT_FOUND` | Target user not found |
| `RATE_LIMIT` | Too many requests |
| `FORBIDDEN` | Action not allowed |

### Example: Handling Errors

```javascript
// Listen for error events
socket.on('system:error', (error) => {
  console.error(`Error ${error.code}: ${error.message}`);
  
  // Handle specific error types
  switch (error.code) {
    case 'NO_USERNAME':
      // Prompt user to set username
      break;
    case 'RATE_LIMIT':
      // Show "too many requests" message
      break;
    default:
      // General error handling
  }
});
```

## Complete Event Reference

This table provides a quick reference for all events:

| Event | Direction | Description |
|-------|-----------|-------------|
| `connect` | Server → Client | Connection established |
| `disconnect` | Server → Client | Connection closed |
| `system:error` | Server → Client | Error occurred |
| `system:welcome` | Server → Client | Welcome message on connection |
| `system:stats` | Server → Client | Server statistics update |
| `system:clients` | Bidirectional | Request/response for connected clients |
| `system:setData` | Client → Server | Update user data |
| `system:dataSet` | Server → Client | User data updated confirmation |
| `system:general` | Bidirectional | Broadcast message |
| `system:generalSent` | Server → Client | Broadcast confirmation |
| `system:direct` | Bidirectional | Direct message |
| `system:directSent` | Server → Client | Direct message confirmation |
| `system:notification` | Bidirectional | User notification |
| `system:notificationSent` | Server → Client | Notification confirmation |
| `system:typingStart` | Client → Server | User started typing |
| `system:typingStop` | Client → Server | User stopped typing |
| `system:typingUpdate` | Server → Client | Typing status update |
| `system:heartbeat` | Server → Client | Heartbeat check |
| `system:heartbeat-ack` | Client → Server | Heartbeat acknowledgment |
| `system:heartbeat-warning` | Server → Client | Connection warning |
| `client-ping` | Client → Server | Client-initiated ping |
| `client-pong` | Server → Client | Server response to ping |
| `system:certificateRefresh` | Server → Client | SSL certificate update notification |
| `system:followed` | Server → Client | Someone started following user |

## Socket.IO Client References

For more details on the Socket.IO client:

- [Socket.IO Client API Documentation](https://socket.io/docs/v4/client-api/)
- [Socket.IO Client Installation](https://socket.io/docs/v4/client-installation/)

## Message Structure Flexibility

One of the key features of the WebSocket Server is its flexibility in message structures:

### Dynamic Message Content

- **General Messages**: Only `type` field is required. All other fields are completely flexible and will be forwarded to all clients.
  
- **Direct Messages**: `target` and `type` fields are required. All other fields are flexible and will be forwarded to the recipient.
  
- **Notifications**: `type` and `content` fields are required, but the structure of the content object is completely flexible.
  
- **System Events**: Different system events have specific required fields as documented above.

### Server-Added Fields

When receiving messages, the server automatically adds the following fields:

- `sender`: Object containing sender information (`id`, `username`, and `profile` if available)
- `timestamp`: ISO date string of when the message was processed

### Handling Custom Data

Clients should be designed to:

1. Include only required fields for each event type
2. Be flexible when receiving messages, as they may contain fields not explicitly documented
3. Gracefully handle missing optional fields in received messages

This flexible design allows for extending functionality without requiring server updates and enables custom application-specific features while maintaining compatibility.

# Client Data Structure

This document outlines the client data structure used in the WS-Hub WebSocket server.

## Overview

Client data is stored in the `metadata` object within each client's record. The metadata can include various information about the client, their preferences, and relationships with other users.

## Standard Metadata Fields

While you can store any arbitrary data in the metadata object, the following fields are recognized and used by the system:

| Field | Type | Description |
|-------|------|-------------|
| `username` | string | The display name for the client |
| `following` | string[] | Array of usernames the client is following |
| `profile` | object | Generic object with profile information |
| `lastUpdated` | Date | Timestamp when the metadata was last updated |
| `status` | string | Client's status (online, away, busy, etc.) |
| `settings` | object | User preferences and settings |

## Example Client Data

```javascript
// Example client metadata
{
  "username": "StellarTrader42",
  "following": ["CosmicCollector", "NebulaNomad", "AstroHunter"],
  "profile": {
    "displayName": "Alex",
    "avatar": "https://example.com/avatar.png",
    "bio": "Enthusiast"
  },
  "status": "online",
  "settings": {
    "notifications": true,
    "theme": "dark"
  },
  "lastUpdated": "2023-11-15T14:22:33.456Z"
}
```

## Setting Client Data

Clients can update their data using the `system:setData` event:

```javascript
// Client-side code
socket.emit('system:setData', {
  username: 'StellarTrader42',
  following: ['CosmicCollector', 'NebulaNomad', 'AstroHunter'],
  profile: {
    displayName: 'Alex',
    bio: 'Hello world'
  }
});
```

The server will merge the provided data with any existing metadata rather than replacing it completely. This allows for partial updates.

## Retrieving Client Data

The server will include relevant client data when responding to various events:

- `system:clients` - Returns a list of connected clients with their public metadata
- `direct` - Messages include sender metadata
- `general` - Broadcast messages include sender metadata

## Restrictions

- Metadata is not persistent across connections - clients need to set their data after each connection
- Size limitations may apply to prevent abuse (maximum metadata size: 10KB)
- Some fields may be sanitized or validated before storing

## Notifications

The server includes a notification system that allows clients to send notifications to their followers. When a client sends a notification, all users who follow them will receive it.

### Sending Notifications

To send a notification to all of your followers:

```javascript
// Client-side code
socket.emit('system:notification', {
  type: 'post',  // Type of notification
  content: {
    // Content depends on the notification type
    postId: '12345',
    title: 'Check out my new article',
    summary: 'Learn about the economy'
  }
});
```

### Receiving Notifications

To receive notifications, listen for the `notification` event:

```javascript
// Client-side code
socket.on('system:notification', (notification) => {
  console.log(`New notification from ${notification.sender.username}`);
  console.log(`Type: ${notification.type}`);
  console.log(`Content:`, notification.content);
  
  // Handle the notification based on its type
  switch(notification.type) {
    case 'post':
      showPostNotification(notification);
      break;
    case 'follow':
      showFollowNotification(notification);
      break;
    // Handle other notification types
  }
});
```

### Standard Notification Types

The following notification types are supported by default:

| Type | Description | Content Structure |
|------|-------------|-------------------|
| `post` | New post published | `{ postId, title, summary }` |
| `comment` | Comment on a post | `{ postId, commentId, text }` |
| `like` | Like on content | `{ targetId, targetType }` |
| `follow` | New follower | `{}` |
| `announcement` | System announcement | `{ title, message }` |
| `alert` | System alert | `{ level, message }` |
| `custom` | Custom notification | Any structure |

### Example Notification Object

```json
{
  "type": "post",
  "content": {
    "postId": "12345",
    "title": "New market data available",
    "summary": "Check out the latest prices for artifacts"
  },
  "sender": {
    "id": "socket123",
    "username": "StellarTrader42",
    "profile": {
      "displayName": "Alex",
      "avatar": "https://example.com/avatar.png"
    }
  },
  "timestamp": "2023-11-15T14:22:33.456Z"
}
```

## Client Heartbeats

The server implements a heartbeat system to ensure clients are still connected and responsive. This helps detect and clean up "ghost" connections that might have lost connectivity without proper disconnection events.

### How it Works

1. The server periodically sends `system:heartbeat` events to each connected client
2. Clients must respond with a `system:heartbeat-ack` event within a specified timeout
3. If a client fails to respond to multiple consecutive heartbeats, it's disconnected

### Client Implementation

To properly handle server heartbeats, clients should implement:

```javascript
// Client-side heartbeat handling
socket.on('system:heartbeat', (data) => {
  // Immediately respond with acknowledgment
  socket.emit('system:heartbeat-ack', { 
    id: data.id,
    timestamp: new Date()
  });
});

// Handle disconnection warnings
socket.on('system:heartbeat-warning', (data) => {
  console.warn(`Connection warning: ${data.message}`);
  // Optionally try to reconnect or alert user
});
```

### Configuration

The heartbeat system uses these default settings:

- **Interval**: 30 seconds between heartbeats
- **Timeout**: 5 seconds to respond to each heartbeat
- **Max Failures**: 5 consecutive failed heartbeats before disconnection

### Debugging Heartbeat Issues

If clients are being unexpectedly disconnected due to heartbeat failures:

1. Check for network connectivity issues
2. Ensure the client is correctly handling and responding to `system:heartbeat` events
3. Consider increasing the timeout or max failures in environments with poor connectivity

## Typing Indicators

Typing indicators allow users to see when someone is actively typing a message to them.

### Sending Typing Indicators

To indicate that a user has started typing:

```javascript
// Client-side code
socket.emit('system:typingStart', {
  target: 'username'  // Username of the person receiving the message
});
```

To indicate that a user has stopped typing:

```javascript
// Client-side code
socket.emit('system:typingStop', {
  target: 'username'  // Username of the person receiving the message
});
```

### Receiving Typing Indicators

The server will emit a `system:typingUpdate` event to the target user:

```javascript
// Client-side code
socket.on('system:typingUpdate', (data) => {
  // data structure:
  // {
  //   sender: {
  //     id: 'socket-id',
  //     username: 'sender-username',
  //     profile: { ... } // Sender profile data if available
  //   },
  //   isTyping: true/false, // Whether user is typing or stopped
  //   timestamp: Date // When the typing status changed
  // }
  
  if (data.isTyping) {
    console.log(`${data.sender.username} is typing...`);
    // Show typing indicator in UI
  } else {
    console.log(`${data.sender.username} stopped typing`);
    // Hide typing indicator in UI
  }
});
```

### Error Handling

If the typing event format is invalid, the server will respond with an error:

```javascript
socket.on('system:error', (error) => {
  // Possible errors:
  // - INVALID_FORMAT: Invalid typing event format
  // - NO_USERNAME: You must set a username before sending typing indicators
});
```

### Automatic Timeouts

The server automatically handles timeouts for typing indicators:

1. When a client sends `typing:start`, the recipient sees they are typing
2. If no `typing:stop` is received within 5 seconds, the server automatically sends a stop typing event
3. This prevents "stuck" typing indicators if a user closes their browser while typing

### Example Implementation

A common implementation pattern is:

1. Listen for keypress events in your message input field
2. Send `system:typingStart` when the user starts typing
3. Use a timer to detect when typing has paused
4. Send `system:typingStop` when typing pauses or the message is sent

```javascript
let typingTimer;
const doneTypingInterval = 1000; // 1 second pause means typing is done

// On key up, start the countdown to "stopped typing"
messageInput.addEventListener('keyup', function() {
  // Clear timer
  clearTimeout(typingTimer);
  
  if (this.value.length > 0) {
    // Emit typing:start if not already typing
    if (!isCurrentlyTyping) {
      socket.emit('system:typingStart', { target: recipientUsername });
      isCurrentlyTyping = true;
    }
    
    // Set timer to detect when typing stops
    typingTimer = setTimeout(() => {
      socket.emit('system:typingStop', { target: recipientUsername });
      isCurrentlyTyping = false;
    }, doneTypingInterval);
  } else {
    // If the text field is empty
    socket.emit('system:typingStop', { target: recipientUsername });
    isCurrentlyTyping = false;
  }
});

// On keydown, clear the timeout
messageInput.addEventListener('keydown', function() {
  clearTimeout(typingTimer);
});
```

This approach creates a smooth typing indicator that shows when the user is actively typing and hides shortly after they pause or stop typing.

# Socket Event Data Structures

This document provides detailed information about the data structures expected and returned by each socket event in the WS-Hub WebSocket Server.

## Table of Contents

- [System Events](#system-events)
- [Authentication & User Data](#authentication--user-data)
- [General Messages](#general-messages)
- [Direct Messages](#direct-messages)
- [Typing Indicators](#typing-indicators)
- [Notifications](#notifications)
- [Heartbeat System](#heartbeat-system)

## System Events

### Connection Events

#### `connect`

**Direction:** Server → Client  
**Data:** None  
**Description:** Emitted when connection is successfully established  

#### `disconnect`

**Direction:** Server → Client  
**Data:**
```javascript
{
  reason: "transport close" // Reason for disconnection
}
```
**Description:** Emitted when client disconnects from server

### System Status

#### `system:stats`

**Direction:** Server → Client  
**Data:**
```javascript
{
  activeConnections: 42, // Number of currently connected clients
  totalConnections: 123, // Total connections since server start
  timestamp: "2023-06-15T12:34:56.789Z" // When stats were generated
}
```
**Description:** Server statistics update

#### `system:certificateRefresh`

**Direction:** Server → Client  
**Data:**
```javascript
{
  message: "Server SSL certificates have been updated. You may need to reconnect.",
  timestamp: "2023-06-15T12:34:56.789Z"
}
```
**Description:** Notification when server SSL certificates are updated

### Client Listing

#### `system:clients` (request)

**Direction:** Client → Server  
**Data:** None  
**Description:** Request a list of all connected clients

#### `system:clients` (response)

**Direction:** Server → Client  
**Data:**
```javascript
{
  clients: [
    {
      id: "socket-id-123",
      username: "john_doe",
      connectTime: "2023-06-15T12:30:00.000Z",
      following: ["jane_doe", "bob_smith"],
      profile: {
        displayName: "John Doe",
        avatar: "avatar-url.jpg"
        // Other profile fields as defined by client
      }
    },
    // Additional clients...
  ],
  count: 42, // Total number of clients
  timestamp: "2023-06-15T12:34:56.789Z"
}
```
**Description:** Response with list of connected clients

### Keep-Alive Ping

#### `client-ping`

**Direction:** Client → Server  
**Data:** None or `{}` (empty object)  
**Description:** Client-initiated ping to keep connection alive

#### `client-pong`

**Direction:** Server → Client  
**Data:**
```javascript
{
  timestamp: "2023-06-15T12:34:56.789Z"
}
```
**Description:** Server response to client ping

## Authentication & User Data

### User Data Management

#### `system:setData`

**Direction:** Client → Server  
**Data:**
```javascript
{
  username: "john_doe", // Required: Client's username
  following: ["jane_doe", "bob_smith"], // Optional: Array of usernames client is following
  profile: { // Optional: Client profile information
    displayName: "John Doe",
    avatar: "avatar-url.jpg",
    // Additional custom profile fields
  }
}
```
**Description:** Update client's user data

#### `system:dataSet`

**Direction:** Server → Client  
**Data (success):**
```javascript
{
  success: true,
  updatedFields: ["username", "following", "profile"],
  timestamp: "2023-06-15T12:34:56.789Z"
}
```

**Data (failure):**
```javascript
{
  success: false,
  error: "Username already taken",
  timestamp: "2023-06-15T12:34:56.789Z"
}
```
**Description:** Response after client attempts to update user data

#### `system:followed`

**Direction:** Server → Client  
**Data:**
```javascript
{
  username: "bob_smith", // Username of the user who started following
  timestamp: "2023-06-15T12:34:56.789Z"
}
```
**Description:** Notification that another user started following the client

## General Messages

### Broadcasting

#### `system:general` (send)

**Direction:** Client → Server  
**Data:**
```javascript
{
  type: "announcement", // Required: Message type
  // Additional custom fields depending on message type:
  message: "Hello everyone!",
  importance: "high",
  // Any other custom data
}
```
**Description:** Send a message to all connected clients

#### `system:general` (receive)

**Direction:** Server → Client  
**Data:**
```javascript
{
  sender: {
    id: "socket-id-123",
    username: "john_doe",
    profile: {
      displayName: "John Doe",
      avatar: "avatar-url.jpg"
      // Other profile fields
    }
  },
  type: "announcement", // Original message type
  message: "Hello everyone!", // Original message content
  importance: "high", // Original custom fields
  timestamp: "2023-06-15T12:34:56.789Z",
  broadcast: true // Flag indicating this is a broadcast message
}
```
**Description:** Broadcast message received from another client

#### `system:generalSent`

**Direction:** Server → Client  
**Data:**
```javascript
{
  success: true,
  originalMessage: {
    type: "announcement",
    message: "Hello everyone!",
    importance: "high"
    // Original message data
  },
  timestamp: "2023-06-15T12:34:56.789Z"
}
```
**Description:** Confirmation that broadcast was sent successfully

## Direct Messages

### Private Messaging

#### `system:direct` (send)

**Direction:** Client → Server  
**Data:**
```javascript
{
  target: "jane_doe", // Required: Username of message recipient
  type: "chatMessage", // Required: Message type
  // Additional custom fields depending on message type:
  message: "Hello Jane!",
  // Any other custom data
}
```
**Description:** Send a direct message to a specific user

#### `system:direct` (receive)

**Direction:** Server → Client  
**Data:**
```javascript
{
  sender: {
    id: "socket-id-123",
    username: "john_doe",
    profile: {
      displayName: "John Doe",
      avatar: "avatar-url.jpg"
      // Other profile fields
    }
  },
  type: "chatMessage", // Original message type
  message: "Hello Jane!", // Original message content
  timestamp: "2023-06-15T12:34:56.789Z"
  // Additional fields from original message
}
```
**Description:** Direct message received from another user

#### `system:directSent`

**Direction:** Server → Client  
**Data (success):**
```javascript
{
  success: true,
  target: "jane_doe", // Username message was sent to
  timestamp: "2023-06-15T12:34:56.789Z"
}
```

**Data (failure):**
```javascript
{
  success: false,
  target: "jane_doe", // Username message was supposed to be sent to
  reason: "User not found", // Reason for failure
  timestamp: "2023-06-15T12:34:56.789Z"
}
```
**Description:** Confirmation whether direct message was sent successfully

## Typing Indicators

### Typing Status

#### `system:typingStart`

**Direction:** Client → Server  
**Data:**
```javascript
{
  target: "jane_doe" // Required: Username of the person receiving the typing indicator
}
```
**Description:** Indicate that user has started typing a message to the target

#### `system:typingStop`

**Direction:** Client → Server  
**Data:**
```javascript
{
  target: "jane_doe" // Required: Username of the person receiving the typing indicator
}
```
**Description:** Indicate that user has stopped typing a message to the target

#### `system:typingUpdate`

**Direction:** Server → Client  
**Data:**
```javascript
{
  sender: {
    id: "socket-id-123",
    username: "john_doe",
    profile: {
      displayName: "John Doe",
      avatar: "avatar-url.jpg"
      // Other profile fields
    }
  },
  isTyping: true, // true if typing started, false if typing stopped
  timestamp: "2023-06-15T12:34:56.789Z"
}
```
**Description:** Update on another user's typing status

## Notifications

### User Notifications

#### `system:notification` (send)

**Direction:** Client → Server  
**Data:**
```javascript
{
  type: "friendRequest", // Required: Notification type
  content: { // Required: Notification content
    message: "I would like to add you as a friend",
    // Any other custom data relevant to the notification
  },
  targets: ["jane_doe", "bob_smith"] // Optional: Specific usernames to send notification to
  // If targets is omitted, sends to all followers
}
```
**Description:** Send a notification to specific users or all followers

#### `system:notification` (receive)

**Direction:** Server → Client  
**Data:**
```javascript
{
  sender: {
    id: "socket-id-123",
    username: "john_doe",
    profile: {
      displayName: "John Doe",
      avatar: "avatar-url.jpg"
      // Other profile fields
    }
  },
  type: "friendRequest", // Original notification type
  content: { // Original notification content
    message: "I would like to add you as a friend",
    // Other custom fields
  },
  timestamp: "2023-06-15T12:34:56.789Z"
}
```
**Description:** Notification received from another user

#### `system:notificationSent`

**Direction:** Server → Client  
**Data:**
```javascript
{
  success: true,
  recipientCount: 2, // Number of users notification was sent to
  timestamp: "2023-06-15T12:34:56.789Z"
}
```
**Description:** Confirmation that notification was sent successfully

## Heartbeat System

### Connection Monitoring

#### `system:heartbeat`

**Direction:** Server → Client  
**Data:**
```javascript
{
  id: "heartbeat-uuid-123" // Unique ID for this heartbeat
}
```
**Description:** Server heartbeat check to verify client connection

#### `system:heartbeat-ack`

**Direction:** Client → Server  
**Data:**
```javascript
{
  id: "heartbeat-uuid-123", // ID from the heartbeat being acknowledged
  timestamp: "2023-06-15T12:34:56.789Z" // Optional: Client timestamp
}
```
**Description:** Client acknowledgment of heartbeat

#### `system:heartbeat-warning`

**Direction:** Server → Client  
**Data:**
```javascript
{
  message: "Connection unstable - missed 2 heartbeats",
  missedHeartbeats: 2,
  timestamp: "2023-06-15T12:34:56.789Z"
}
```
**Description:** Warning about potential connection issues

## Error Handling

### Error Responses

#### `system:error`

**Direction:** Server → Client  
**Data:**
```javascript
{
  code: "ERROR_CODE",
  message: "Detailed error message"
}
```
**Description:** Error information for client request issues

**Common Error Codes:**

| Code | Description | Possible Cause |
|------|-------------|----------------|
| `INVALID_FORMAT` | Invalid data format | Missing required fields, wrong data types |
| `NO_USERNAME` | Username not set | Trying to perform action that requires username |
| `TARGET_NOT_FOUND` | Target user not found | Messaging or typing to non-existent user |
| `RATE_LIMIT` | Too many requests | Sending messages too quickly |
| `FORBIDDEN` | Action not allowed | Insufficient permissions |
| `DUPLICATE_USERNAME` | Username already in use | Trying to set username already taken |
| `PAYLOAD_TOO_LARGE` | Message too large | Exceeding size limits |

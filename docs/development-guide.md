# WS-Hub Development Guide

This guide explains how to integrate WS-Hub into your website and extend its functionality.

## Table of Contents

- [Integration Guide](#integration-guide)
- [Adding Custom Events](#adding-custom-events)
- [Architecture Overview](#architecture-overview)
- [Development Workflow](#development-workflow)
- [Best Practices](#best-practices)

## Integration Guide

### Basic Website Integration

1. Include Socket.IO client in your HTML:
```html
<script src="https://cdn.socket.io/4.6.0/socket.io.min.js"></script>
```

2. Initialize the connection:
```javascript
const socket = io('https://your-server.com', {
    path: '/socket.io',
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});

// Handle connection events
socket.on('connect', () => {
    console.log('Connected to WS-Hub');
});

socket.on('disconnect', () => {
    console.log('Disconnected from WS-Hub');
});

// Handle errors
socket.on('system:error', (error) => {
    console.error(`Error: ${error.code} - ${error.message}`);
});
```

3. Set up user data after connection:
```javascript
socket.emit('system:setData', {
    username: 'user123',
    profile: {
        displayName: 'User 123',
        avatar: 'avatar-url.jpg'
    }
});
```

### Framework Integration Examples

#### React Integration
```typescript
import { io, Socket } from 'socket.io-client';
import { useState, useEffect } from 'react';

const useSocket = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const newSocket = io('https://your-server.com');
        
        newSocket.on('connect', () => setConnected(true));
        newSocket.on('disconnect', () => setConnected(false));
        
        setSocket(newSocket);
        
        return () => {
            newSocket.close();
        };
    }, []);

    return { socket, connected };
};
```

#### Vue.js Integration
```typescript
import { io } from 'socket.io-client';

export default {
    data() {
        return {
            socket: null,
            connected: false
        };
    },
    created() {
        this.socket = io('https://your-server.com');
        this.socket.on('connect', () => this.connected = true);
        this.socket.on('disconnect', () => this.connected = false);
    },
    beforeDestroy() {
        if (this.socket) {
            this.socket.close();
        }
    }
};
```

## Adding Custom Events

### Creating New Event Handlers

1. Create a new TypeScript file in `src/socket/events/`:

```typescript
// src/socket/events/custom.ts
import { Socket } from 'socket.io';
import { clientManager } from '../handlers';

// Define your event data type
interface CustomEventData {
    action: string;
    data: any;
}

export function handleCustomEvents(socket: Socket): void {
    // Listen for your custom event
    socket.on('custom:action', (data: CustomEventData) => {
        // Validate the data
        if (!isValidCustomEvent(data)) {
            socket.emit('system:error', {
                code: 'INVALID_FORMAT',
                message: 'Invalid custom event format'
            });
            return;
        }

        // Get sender information
        const senderInfo = clientManager.getClient(socket.id);
        const username = senderInfo?.metadata?.username;

        if (!username) {
            socket.emit('system:error', {
                code: 'NO_USERNAME',
                message: 'Username required for this action'
            });
            return;
        }

        // Process the event
        processCustomEvent(socket, data, username);
    });
}

function isValidCustomEvent(data: any): data is CustomEventData {
    return data 
        && typeof data.action === 'string'
        && data.data !== undefined;
}

function processCustomEvent(socket: Socket, data: CustomEventData, username: string): void {
    // Add your custom event logic here
    const response = {
        sender: {
            username,
            id: socket.id
        },
        action: data.action,
        result: 'processed',
        timestamp: new Date()
    };

    // Emit response back to sender
    socket.emit('custom:actionComplete', response);
}
```

2. Register your event handler in `src/socket/handlers.ts`:

```typescript
import { handleCustomEvents } from './events/custom';

function setupEventHandlers(socket: Socket): void {
    // ...existing handlers...
    handleCustomEvents(socket);
}
```

### Event Handling Best Practices

1. **Type Safety**
```typescript
// Define types for your event data
interface MyEventData {
    type: string;
    payload: {
        field1: string;
        field2: number;
    };
}

// Use type guard for validation
function isValidMyEvent(data: any): data is MyEventData {
    return data
        && typeof data.type === 'string'
        && typeof data.payload?.field1 === 'string'
        && typeof data.payload?.field2 === 'number';
}
```

2. **Error Handling**
```typescript
try {
    // Process event
    const result = await processEvent(data);
    socket.emit('custom:success', result);
} catch (error) {
    socket.emit('system:error', {
        code: 'PROCESSING_ERROR',
        message: error.message
    });
}
```

## Architecture Overview

### Directory Structure
```
src/
├── socket/
│   ├── events/          # Event handlers
│   │   ├── general.ts   # Broadcast messages
│   │   ├── direct.ts    # Direct messages
│   │   ├── system.ts    # System events
│   │   └── custom.ts    # Your custom events
│   ├── handlers.ts      # Main event setup
│   └── client-manager.ts # Client state management
├── utils/              # Utility functions
├── config/            # Configuration
└── server.ts         # Main server entry
```

### Adding New Features

1. **Plan Your Feature**
   - Define the event names (use namespaces like 'custom:')
   - Design the data structures
   - Plan error scenarios

2. **Implementation Steps**
   - Create event handler file
   - Define TypeScript interfaces
   - Implement validation
   - Add error handling
   - Register with main handler
   - Update documentation

## Development Workflow

1. Start development server:
```bash
npm run dev
```

2. Test your changes using the example client:
```bash
npm run example
```

3. Build for production:
```bash
npm run build
```

## Best Practices

1. **Event Naming**
   - Use namespaces: `category:action`
   - Be descriptive: `game:movePlayer` vs `move`
   - Use consistent conventions

2. **Data Validation**
   - Always validate incoming data
   - Use TypeScript interfaces
   - Implement type guards

3. **Error Handling**
   - Use standard error codes
   - Provide helpful error messages
   - Log errors appropriately

4. **Testing**
   - Write unit tests for validators
   - Test error conditions
   - Use the example client for integration testing

5. **Documentation**
   - Document new events in API docs
   - Include example usage
   - Document error scenarios

## Example: Complete Feature Addition

Here's an example of adding a complete feature (e.g., a game room system):

```typescript
// src/socket/events/game-rooms.ts
import { Socket } from 'socket.io';
import { clientManager } from '../handlers';

interface GameRoom {
    id: string;
    players: string[];
    state: 'waiting' | 'playing' | 'finished';
}

interface JoinRoomData {
    roomId: string;
}

export function handleGameRoomEvents(socket: Socket): void {
    const rooms = new Map<string, GameRoom>();

    socket.on('game:createRoom', () => {
        const senderInfo = clientManager.getClient(socket.id);
        if (!senderInfo?.metadata?.username) {
            socket.emit('system:error', {
                code: 'NO_USERNAME',
                message: 'Must set username before creating room'
            });
            return;
        }

        const roomId = generateRoomId();
        rooms.set(roomId, {
            id: roomId,
            players: [senderInfo.metadata.username],
            state: 'waiting'
        });

        socket.emit('game:roomCreated', { roomId });
    });

    socket.on('game:joinRoom', (data: JoinRoomData) => {
        // Add join room logic
    });
}

function generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}
```

This guide should help you get started with both integrating and extending WS-Hub. Check the example client and API documentation for more detailed examples and reference.

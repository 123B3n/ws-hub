import { Socket } from 'socket.io';
import { clientManager } from '../handlers';

/**
 * Handle general broadcast events
 * These are messages that should be sent to all connected clients
 */
export function handleGeneralEvents(socket: Socket): void {
  // Listen for general broadcast messages
  socket.on('system:general', (data) => {
    console.log(`Received general broadcast from ${socket.id}:`, data);
    
    // Validate the message format
    if (!isValidGeneralMessage(data)) {
      console.warn(`Invalid general message format from ${socket.id}`);
      socket.emit('system:error', { 
        code: 'INVALID_FORMAT', 
        message: 'Invalid message format' 
      });
      return;
    }
    
    // Get the sender's information from client manager
    const senderInfo = clientManager.getClient(socket.id);
    const username = senderInfo?.metadata?.username;
    
    if (!username) {
      socket.emit('system:error', { 
        code: 'NO_USERNAME', 
        message: 'You must set a username with system:setData before sending general messages' 
      });
      return;
    }
    
    // Add server metadata to the message with enhanced sender information
    const enhancedData = {
      ...data,
      sender: {
        id: socket.id,
        username: username,
        profile: senderInfo?.metadata?.profile || {}
      },
      timestamp: new Date(),
      broadcast: true
    };

    // Broadcast to all clients (including sender for consistency)
    socket.broadcast.emit('system:general', enhancedData);
    
    // Also send acknowledgment to the sender
    socket.emit('system:generalSent', { 
      success: true, 
      originalMessage: data,
      timestamp: new Date()
    });
    
    // Log the broadcast
    console.log(`General broadcast from ${username} (${socket.id}): Type=${data.type}`);
  });
}

/**
 * Validates the format of a general message
 */
function isValidGeneralMessage(data: any): boolean {
  // Basic validation - require at least a type field
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  if (!data.type || typeof data.type !== 'string') {
    return false;
  }
  
  return true;
}

/**
 * Typing Indicator Event Handlers
 * 
 * This module manages real-time typing status indicators between users.
 * When a user types a message to another user, the recipient can see that
 * the sender is currently typing, enhancing the interactive experience.
 * 
 * Features:
 * - Start typing indicator when user begins typing
 * - Stop typing indicator when user stops typing
 * - Automatic timeout to prevent "stuck" typing indicators
 * - Enhanced sender information in typing indicator events
 */
import { Socket } from 'socket.io';
import { clientManager } from '../handlers';
import { getConfiguration } from '../../utils/config';

/**
 * Set up typing indicator event handlers for a socket
 * 
 * @param socket The client socket to set up handlers for
 */
export function handleTypingEvents(socket: Socket): void {
  const config = getConfiguration();
  
  // Store timeout handlers by recipient ID to manage typing indicator timeouts
  // This prevents memory leaks by tracking all active timeouts
  const typingTimeouts = new Map<string, NodeJS.Timeout>();
  
  // Handle when a user starts typing
  socket.on('system:typingStart', (data) => {
    // Validate message format before processing
    if (!isValidTypingEvent(data)) {
      socket.emit('system:error', {
        code: 'INVALID_FORMAT',
        message: 'Invalid typing event format'
      });
      return;
    }
    
    const { target } = data;
    
    // Get sender information from client manager
    const senderInfo = clientManager.getClient(socket.id);
    const senderUsername = senderInfo?.metadata?.username;
    
    // Check if sender has a username - required for typing indicators
    if (!senderUsername) {
      socket.emit('system:error', {
        code: 'NO_USERNAME',
        message: 'You must set a username before sending typing indicators'
      });
      return;
    }
    
    // Find target client by username
    const targetClient = clientManager.getClientByUsername(target);
    
    if (!targetClient) {
      // User isn't online, so no need to send typing notifications
      return;
    }
    
    // Clear existing timeout if there is one to prevent duplicate indicators
    if (typingTimeouts.has(target)) {
      clearTimeout(typingTimeouts.get(target)!);
    }
    
    // Enhanced data with sender info for recipient's context
    const typingData = {
      sender: {
        id: socket.id,
        username: senderUsername,
        profile: senderInfo?.metadata?.profile || {}
      },
      isTyping: true,
      timestamp: new Date()
    };
    
    // Send typing indicator to target
    targetClient.socket.emit('system:typingUpdate', typingData);
    
    // Set a timeout to automatically clear typing indicator after a delay
    // This prevents "stuck" typing indicators if a user closes their browser
    const timeout = setTimeout(() => {
      sendTypingStopToUser(socket, targetClient, senderUsername, senderInfo);
      typingTimeouts.delete(target);
    }, config.customSettings.typingTimeout || 5000); // Default 5 seconds timeout
    
    // Store timeout reference for cleanup
    typingTimeouts.set(target, timeout);
    
    if (config.logging.logClientEvents) {
      console.log(`${senderUsername} is typing to ${target}`);
    }
  });
  
  // Handle when a user explicitly stops typing
  socket.on('system:typingStop', (data) => {
    if (!isValidTypingEvent(data)) {
      socket.emit('system:error', {
        code: 'INVALID_FORMAT',
        message: 'Invalid typing event format'
      });
      return;
    }
    
    const { target } = data;
    
    // Get sender information
    const senderInfo = clientManager.getClient(socket.id);
    const senderUsername = senderInfo?.metadata?.username;
    
    // Check if sender has a username
    if (!senderUsername) {
      socket.emit('system:error', {
        code: 'NO_USERNAME',
        message: 'You must set a username before sending typing indicators'
      });
      return;
    }
    
    // Find target client by username
    const targetClient = clientManager.getClientByUsername(target);
    
    if (!targetClient) {
      // User isn't online, so no need to send typing notifications
      return;
    }
    
    // Clear existing timeout if there is one
    if (typingTimeouts.has(target)) {
      clearTimeout(typingTimeouts.get(target)!);
      typingTimeouts.delete(target);
    }
    
    // Send stop typing indicator to target
    sendTypingStopToUser(socket, targetClient, senderUsername, senderInfo);
    
    if (config.logging.logClientEvents) {
      console.log(`${senderUsername} stopped typing to ${target}`);
    }
  });
  
  // Clean up timeouts when user disconnects to prevent memory leaks
  socket.on('disconnect', () => {
    for (const timeout of typingTimeouts.values()) {
      clearTimeout(timeout);
    }
    typingTimeouts.clear();
  });
}

/**
 * Helper function to send typing stopped indicator to a user
 * 
 * @param senderSocket The sending socket
 * @param targetClient The client to send the indicator to
 * @param senderUsername Username of the sender
 * @param senderInfo Additional sender information
 */
function sendTypingStopToUser(
  senderSocket: Socket, 
  targetClient: any, 
  senderUsername: string,
  senderInfo: any
): void {
  const typingData = {
    sender: {
      id: senderSocket.id,
      username: senderUsername,
      profile: senderInfo?.metadata?.profile || {}
    },
    isTyping: false,
    timestamp: new Date()
  };
  
  targetClient.socket.emit('system:typingUpdate', typingData);
}

/**
 * Validates the format of a typing event
 * 
 * @param data Typing event data to validate
 * @returns True if the event has valid format
 */
function isValidTypingEvent(data: any): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  if (!data.target || typeof data.target !== 'string') {
    return false;
  }
  
  return true;
}

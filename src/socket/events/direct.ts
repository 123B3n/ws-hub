/**
 * Direct Message Event Handlers
 *
 * This module handles the direct messaging functionality between users.
 * Direct messages are private communications sent to specific users.
 *
 * Features:
 * - Sending direct messages to specific users by username
 * - Message validation to ensure proper format
 * - Error handling for various failure cases
 * - Enhanced messages with sender metadata
 * - Acknowledgment system to confirm message delivery
 */
import { Socket } from 'socket.io';
import { clientManager } from '../handlers';

/**
 * Set up direct message event handlers for a socket
 *
 * @param socket The client socket to set up handlers for
 */
export function handleDirectEvents (socket: Socket): void {
  // Handle direct messages to specific clients
  socket.on('system:direct', (data) => {
    console.log(`Received direct message from ${socket.id}:`, data);

    // Validate message format before processing
    if (!isValidDirectMessage(data)) {
      console.warn(`Invalid direct message format from ${socket.id}`);
      socket.emit('system:error', {
        code: 'INVALID_FORMAT',
        message: 'Invalid direct message format'
      });
      return;
    }

    const { target, ...messageContent } = data;

    // Get sender information from client manager
    const senderInfo = clientManager.getClient(socket.id);
    const senderUsername = senderInfo?.metadata?.username;

    // Check if sender has a username - required for direct messages
    if (!senderUsername) {
      socket.emit('system:error', {
        code: 'NO_USERNAME',
        message: 'You must set a username before sending direct messages'
      });
      return;
    }

    // Find target client by username instead of socket ID
    // This allows addressing users by username rather than transient socket IDs
    const targetClient = clientManager.getClientByUsername(target);

    // Handle case where target user is not found
    if (!targetClient) {
      socket.emit('system:directSent', {
        success: false,
        target,
        reason: `User "${target}" is not online or does not exist`,
        timestamp: new Date()
      });
      console.log(`Failed to send direct message from ${senderUsername} to ${target} - user not found`);
      return;
    }

    // Enhanced data with sender info for recipient's context
    const enhancedData = {
      ...messageContent,
      sender: {
        id: socket.id,
        username: senderUsername,
        profile: senderInfo?.metadata?.profile || {}
      },
      timestamp: new Date()
    };

    // Send message to target client
    targetClient.socket.emit('system:direct', enhancedData);

    // Send acknowledgment to sender for confirmation
    socket.emit('system:directSent', {
      success: true,
      target,
      timestamp: new Date()
    });
    console.log(`Direct message sent from ${senderUsername} to ${target}`);
  });
}

/**
 * Validates the format of a direct message
 *
 * @param data Message data to validate
 * @returns True if the message has valid format
 */
function isValidDirectMessage (data: any): boolean {
  // Require target and type fields at minimum
  if (!data || typeof data !== 'object') {
    return false;
  }

  if (!data.target || typeof data.target !== 'string') {
    return false;
  }

  if (!data.type || typeof data.type !== 'string') {
    return false;
  }

  return true;
}

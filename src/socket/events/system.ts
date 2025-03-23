import { Socket } from 'socket.io';
import { clientManager } from '../handlers';
import { getConfiguration } from '../../utils/config';

/**
 * Handle system events
 */
export function handleSystemEvents(socket: Socket): void {
  const config = getConfiguration();
  
  // Client ping/pong for keeping connections alive (especially for Cloudflare)
  socket.on('client-ping', () => {
    socket.emit('client-pong', { timestamp: new Date().toISOString() });
  });
  
  // Handle heartbeat responses from clients
  socket.on('system:heartbeat-ack', (data) => {
    if (!data || !data.id) {
      console.warn(`Invalid heartbeat-ack from client ${socket.id}`);
      return;
    }
    
    // Record the successful heartbeat
    clientManager.recordHeartbeat(socket.id);
    
    // Only log in verbose mode to avoid cluttering logs
    if (config.logging.logClientEvents) {
      console.log(`Heartbeat acknowledged from client ${socket.id} (ID: ${data.id})`);
    }
  });
  
  // Allow clients to request a list of connected clients
  socket.on('system:clients', () => {
    // Send back only non-sensitive data
    const clients = clientManager.getAllClients().map(client => ({
      id: client.id,
      username: client.metadata?.username || 'Anonymous',
      connectTime: client.connectTime,
      // Include additional safe metadata for display
      following: client.metadata?.following || [],
      profile: client.metadata?.profile || {}
    }));
    
    socket.emit('system:clients', {
      clients,
      count: clients.length,
      timestamp: new Date()
    });
  });
  
  // Allow clients to update their metadata (username, following list, etc.)
  socket.on('system:setData', (data) => {
    if (!data || typeof data !== 'object') {
      socket.emit('system:error', { 
        code: 'INVALID_FORMAT', 
        message: 'Invalid data format - expected an object' 
      });
      return;
    }
    
    // Apply size limits from config
    const dataSize = JSON.stringify(data).length;
    if (dataSize > config.security.maxMessageSize) {
      socket.emit('system:error', {
        code: 'PAYLOAD_TOO_LARGE',
        message: `Data size (${dataSize} bytes) exceeds maximum allowed size (${config.security.maxMessageSize} bytes)`
      });
      return;
    }
    
    // Get existing metadata or initialize empty object
    const client = clientManager.getClient(socket.id);
    const currentMetadata = client?.metadata || {};
    
    // Merge new data with existing metadata
    const updatedMetadata = {
      ...currentMetadata,
      ...data,
      lastUpdated: new Date()
    };
    
    // Update client data with new metadata
    clientManager.updateClient(socket.id, { metadata: updatedMetadata });
    
    // Log the update with sample of data (for debugging)
    const dataKeys = Object.keys(data);
    
    if (config.logging.logClientEvents || data.username) {
      console.log(`Client ${socket.id} updated metadata: ${dataKeys.join(', ')}`);
      
      // If username was updated, always log it
      if (data.username) {
        console.log(`Client ${socket.id} set username to '${data.username}'`);
      }
    }
    
    // Confirm to the client
    socket.emit('system:dataSet', { 
      success: true,
      updatedFields: dataKeys,
      timestamp: new Date()
    });
    
    // If following list was updated, we might want to notify relevant clients
    if (data.following && Array.isArray(data.following)) {
      handleFollowingUpdate(socket, data.following, currentMetadata.following || []);
    }
  });

  // Handle notification events to be sent to followers
  socket.on('system:notification', (data) => {
    if (!isValidNotification(data)) {
      socket.emit('system:error', { 
        code: 'INVALID_FORMAT', 
        message: 'Invalid notification format' 
      });
      return;
    }

    // Apply size limits from config
    const contentSize = JSON.stringify(data.content).length;
    if (contentSize > config.notifications.maxContentSize) {
      socket.emit('system:error', {
        code: 'CONTENT_TOO_LARGE',
        message: `Notification content size (${contentSize} bytes) exceeds maximum allowed size (${config.notifications.maxContentSize} bytes)`
      });
      return;
    }

    // Get the sender's username from their metadata
    const senderInfo = clientManager.getClient(socket.id);
    const username = senderInfo?.metadata?.username;
    
    if (!username) {
      socket.emit('system:error', { 
        code: 'NO_USERNAME', 
        message: 'You must set a username with system:setData before sending notifications' 
      });
      return;
    }

    // Create notification object
    const notification = {
      ...data,
      sender: {
        id: socket.id,
        username: username,
        profile: senderInfo?.metadata?.profile || {}
      },
      timestamp: new Date()
    };

    // Use the follower broadcast function from client manager
    const sentCount = clientManager.broadcastToFollowers(username, 'system:notification', notification);

    // Send acknowledgment to sender
    socket.emit('system:notificationSent', {
      success: true,
      recipientCount: sentCount,
      timestamp: new Date()
    });

    console.log(`Sent notification from ${username} (${socket.id}) to ${sentCount} followers`);
  });
  
  // Add configuration endpoint
  socket.on('system:getConfig', () => {
    // Send only safe configuration options to the client
    const clientConfig = {
      notifications: {
        maxContentSize: config.notifications.maxContentSize
      },
      heartbeat: {
        interval: config.heartbeat.interval,
        timeout: config.heartbeat.timeout
      },
      security: {
        maxMessageSize: config.security.maxMessageSize
      },
      appInfo: config.customSettings || {}
    };
    
    socket.emit('system:config', clientConfig);
  });
}

/**
 * Handle updates to a client's following list
 */
function handleFollowingUpdate(
  socket: Socket, 
  newFollowing: string[], 
  oldFollowing: string[]
): void {
  // Find new users being followed (added)
  const newlyFollowed = newFollowing.filter(user => !oldFollowing.includes(user));
  
  // Find users no longer followed (removed)
  const unfollowed = oldFollowing.filter(user => !newFollowing.includes(user));
  
  // Notify user about the follow/unfollow events
  if (newlyFollowed.length > 0) {
    // Optionally notify the clients who were followed
    newlyFollowed.forEach(username => {
      const targetClient = clientManager.getClientByUsername(username);
      if (targetClient) {
        targetClient.socket.emit('system:followed', {
          by: socket.id,
          username: clientManager.getClient(socket.id)?.metadata?.username || 'Anonymous',
          timestamp: new Date()
        });
      }
    });
  }
  
  // Similarly for unfollows
  if (unfollowed.length > 0) {
    // Implementation similar to above if needed
  }
}

/**
 * Validate incoming notification data
 */
function isValidNotification(data: any): boolean {
  // Minimum validation - notification needs to have a type and content
  if (!data || typeof data !== 'object') {
    return false;
  }

  if (!data.type || typeof data.type !== 'string') {
    return false;
  }

  if (!data.content) {
    return false;
  }

  return true;
}

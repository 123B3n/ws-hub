/**
 * Socket.IO Event Handlers Module
 * 
 * This module handles Socket.IO connections and sets up the event handlers
 * for all WebSocket events. It serves as the central hub for coordinating
 * all communication between clients and the server.
 * 
 * The module:
 * - Creates and exports a singleton ClientManager instance
 * - Sets up event handlers for new socket connections
 * - Tracks connection statistics
 * - Routes events to appropriate domain-specific handlers
 */
import { Server, Socket } from 'socket.io';
import { ClientManager } from './client-manager';
import { handleGeneralEvents } from './events/general';
import { handleDirectEvents } from './events/direct';
import { handleSystemEvents } from './events/system';
import { handleTypingEvents } from './events/typing';

// Create a single instance of the client manager to be used across the application
// This singleton pattern ensures all parts of the application work with the same client state
export const clientManager = new ClientManager();

// Clean up resources when the application exits
process.on('exit', () => {
  clientManager.dispose();
});

/**
 * Sets up all socket event handlers for the Socket.IO server
 * This is the main entry point for WebSocket event handling
 * 
 * @param io The Socket.IO server instance
 */
export function setupSocketEventHandlers(io: Server): void {
  console.log('Setting up Socket.IO event handlers');

  // Track server statistics for monitoring and diagnostics
  let totalConnections = 0;  // Total connections since server start
  let activeConnections = 0; // Current active connections

  // Handle new client connections
  io.on('connection', (socket: Socket) => {
    // Increment statistics
    totalConnections++;
    activeConnections++;

    // Log connection details with client information
    const clientInfo = extractClientInfo(socket);
    console.log(`Client connected: ${socket.id}`, clientInfo);
    
    // Register client with the client manager
    clientManager.addClient(socket);

    // Set up all event handlers for this client
    setupEventHandlers(socket);

    // Handle disconnection to clean up resources
    socket.on('disconnect', (reason) => {
      activeConnections--;
      console.log(`Client disconnected: ${socket.id} (Reason: ${reason})`);
      
      // Remove client from manager to prevent memory leaks
      clientManager.removeClient(socket.id);
      
      // Emit server stats to all remaining clients
      io.emit('system:stats', { 
        activeConnections, 
        totalConnections, 
        timestamp: new Date() 
      });
    });

    // Emit server stats when a new client connects
    // This allows clients to show online user counts
    io.emit('system:stats', { 
      activeConnections, 
      totalConnections, 
      timestamp: new Date() 
    });
  });
}

/**
 * Sets up event handlers for a specific socket connection
 * This organizes the event handling into domains (general, direct, system, etc.)
 * 
 * @param socket The client's socket connection
 */
function setupEventHandlers(socket: Socket): void {
  // Handle general broadcast events (messages sent to all clients)
  handleGeneralEvents(socket);
  
  // Handle direct message events (messages sent to specific clients)
  handleDirectEvents(socket);
  
  // Handle system events (authentication, user data, etc.)
  handleSystemEvents(socket);
  
  // Handle typing indicator events (showing when users are typing)
  handleTypingEvents(socket);
  
  // Ensure we record heartbeat responses properly
  // This is critical for keeping track of client connectivity
  socket.on('system:heartbeat-ack', (data) => {
    clientManager.recordHeartbeat(socket.id);
  });
}

/**
 * Extracts useful client information from socket handshake data
 * This helps with debugging and client identification
 * 
 * @param socket The client socket to extract information from
 * @returns An object containing client information
 */
function extractClientInfo(socket: Socket): object {
  const info: Record<string, any> = {
    transport: socket.conn.transport.name, // websocket or polling
    address: socket.handshake.address,     // IP address (may be proxied)
  };

  // Extract Cloudflare headers if present
  // This helps identify the real client IP when behind Cloudflare
  const { headers } = socket.handshake;
  if (headers['cf-connecting-ip']) {
    info.cloudflare = {
      ip: headers['cf-connecting-ip'],       // Real client IP
      country: headers['cf-ipcountry'] || 'unknown',  // Client country code
      ray: headers['cf-ray'] || 'unknown'    // Cloudflare Ray ID for tracing
    };
  }

  return info;
}

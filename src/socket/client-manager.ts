/**
 * Client Manager Module
 *
 * This module provides centralized management for all connected WebSocket clients.
 * It handles:
 * - Tracking connected clients and their metadata
 * - Managing client heartbeats to detect disconnections
 * - Finding clients by different criteria (ID, username, etc.)
 * - Broadcasting messages to specific groups of clients
 * - Sending direct messages between clients
 *
 * The ClientManager is designed as a service class that maintains the state of
 * all active connections and provides high-level operations for interacting with clients.
 */
import { Socket } from 'socket.io';
import { getConfiguration } from '../utils/config';

/**
 * Client data stored by the ClientManager
 */
export interface ClientData {
  id: string; // Socket ID (unique per connection)
  socket: Socket; // Socket.IO socket reference
  connectTime: Date; // When the client connected
  metadata?: Record<string, any>; // User-defined data (username, etc.)
  // Heartbeat tracking properties
  lastHeartbeat?: Date; // When we last received a heartbeat
  heartbeatMissed: number; // Count of missed heartbeats
  heartbeatPending: boolean; // Whether we're waiting for heartbeat response
}

/**
 * ClientManager handles tracking and managing all connected clients
 */
export class ClientManager {
  // Store clients in a Map for O(1) lookups by ID
  private clients: Map<string, ClientData>;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private config = getConfiguration();

  /**
   * Initialize a new ClientManager
   */
  constructor () {
    this.clients = new Map();

    // Only start heartbeat if enabled in config
    if (this.config.heartbeat.enabled) {
      this.startHeartbeatMonitor();
    }
  }

  /**
   * Start the heartbeat monitoring system
   * This sends periodic pings to all clients to ensure they're still connected
   */
  private startHeartbeatMonitor (): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    const interval = this.config.heartbeat.interval;
    const timeout = this.config.heartbeat.timeout;

    console.log(`Starting client heartbeat monitor: interval=${interval}ms, timeout=${timeout}ms`);

    // Set up recurring check of all clients
    this.heartbeatInterval = setInterval(() => this.checkAllClientHeartbeats(), interval);
  }

  /**
   * Check heartbeat for all connected clients
   * This is called periodically by the heartbeat interval
   */
  private checkAllClientHeartbeats (): void {
    const now = new Date();
    const clients = Array.from(this.clients.values());

    console.log(`Checking heartbeats for ${clients.length} clients at ${now.toISOString()}`);

    clients.forEach(client => {
      // Skip clients with pending heartbeats
      if (client.heartbeatPending) {
        client.heartbeatMissed++;
        console.log(`Client ${client.id} has a pending heartbeat (missed: ${client.heartbeatMissed})`);

        // Check if we need to disconnect this client due to too many missed heartbeats
        if (client.heartbeatMissed >= this.config.heartbeat.maxMissed) {
          console.log(`Client ${client.id} missed ${client.heartbeatMissed} heartbeats, disconnecting...`);
          this.disconnectClient(client.id, 'heartbeat-timeout');
          return;
        }
      }

      // Send heartbeat
      this.sendHeartbeat(client);
    });
  }

  /**
   * Send heartbeat to a specific client
   *
   * @param client The client to send heartbeat to
   */
  private sendHeartbeat (client: ClientData): void {
    client.heartbeatPending = true;
    const heartbeatId = Date.now().toString();

    if (this.config.logging.logClientEvents) {
      console.log(`Sending heartbeat to client ${client.id} (ID: ${heartbeatId})`);
    }

    // Send the heartbeat event with unique ID for tracking
    client.socket.emit('system:heartbeat', { id: heartbeatId, timestamp: new Date() });

    // Set timeout for this specific heartbeat
    setTimeout(() => {
      // If the heartbeat is still pending after timeout
      if (client.heartbeatPending) {
        client.heartbeatMissed++;

        if (this.config.logging.logClientEvents) {
          console.log(`Heartbeat timeout for client ${client.id} (missed: ${client.heartbeatMissed})`);
        }

        // Check if we need to disconnect
        if (client.heartbeatMissed >= this.config.heartbeat.maxMissed) {
          console.log(`Client ${client.id} missed ${client.heartbeatMissed} heartbeats, disconnecting...`);
          this.disconnectClient(client.id, 'heartbeat-timeout');
        }
      }
    }, this.config.heartbeat.timeout);
  }

  /**
   * Disconnect a client due to failed heartbeat
   *
   * @param socketId ID of the client to disconnect
   * @param reason Reason for disconnection
   */
  private disconnectClient (socketId: string, reason: string): void {
    const client = this.clients.get(socketId);
    if (!client) return;

    try {
      // Disconnect the socket - this will trigger the disconnect event handler
      client.socket.disconnect(true);
    } catch (error) {
      console.error(`Error disconnecting client ${socketId}:`, error);
    }

    // Remove from client list
    this.removeClient(socketId);
  }

  /**
   * Record a heartbeat received from a client
   * Called when we receive a heartbeat acknowledgment
   *
   * @param socketId ID of the client that sent the heartbeat
   * @returns True if client exists and heartbeat was recorded
   */
  public recordHeartbeat (socketId: string): boolean {
    const client = this.clients.get(socketId);
    if (!client) return false;

    client.lastHeartbeat = new Date();
    client.heartbeatPending = false;

    // Reset missed heartbeat counter if it was elevated but not too high
    if (client.heartbeatMissed > 0 && client.heartbeatMissed < this.config.heartbeat.maxMissed) {
      console.log(`Client ${socketId} recovered after ${client.heartbeatMissed} missed heartbeats`);
      client.heartbeatMissed = 0;
    }

    return true;
  }

  /**
   * Clean up resources when the manager is no longer needed
   */
  public dispose (): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Adds a client to the manager
   *
   * @param socket The client's socket
   * @param metadata Optional additional metadata about the client
   */
  public addClient (socket: Socket, metadata?: Record<string, any>): void {
    this.clients.set(socket.id, {
      id: socket.id,
      socket,
      connectTime: new Date(),
      metadata,
      // Initialize heartbeat tracking
      lastHeartbeat: new Date(),
      heartbeatMissed: 0,
      heartbeatPending: false
    });
  }

  /**
   * Updates client data with additional information
   *
   * @param socketId ID of the client to update
   * @param data New data to merge with existing client data
   * @returns True if client was found and updated
   */
  public updateClient (socketId: string, data: Partial<ClientData>): boolean {
    const client = this.clients.get(socketId);
    if (!client) return false;

    // Merge new data with existing client data
    this.clients.set(socketId, { ...client, ...data });
    return true;
  }

  /**
   * Removes a client from the manager
   *
   * @param socketId ID of the client to remove
   * @returns True if client was found and removed
   */
  public removeClient (socketId: string): boolean {
    return this.clients.delete(socketId);
  }

  /**
   * Gets a client by socket ID
   *
   * @param socketId ID of the client to retrieve
   * @returns The client data or undefined if not found
   */
  public getClient (socketId: string): ClientData | undefined {
    return this.clients.get(socketId);
  }

  /**
   * Gets a client by username
   * This requires a linear search through all clients
   *
   * @param username Username to search for
   * @returns The first client matching the username or undefined
   */
  public getClientByUsername (username: string): ClientData | undefined {
    for (const client of this.clients.values()) {
      if (client.metadata?.username === username) {
        return client;
      }
    }
    return undefined;
  }

  /**
   * Gets all connected clients
   *
   * @returns Array of all client data
   */
  public getAllClients (): ClientData[] {
    return Array.from(this.clients.values());
  }

  /**
   * Gets the total number of connected clients
   *
   * @returns Number of connected clients
   */
  public getClientCount (): number {
    return this.clients.size;
  }

  /**
   * Broadcast a message to all clients except the sender
   *
   * @param event Event name to emit
   * @param data Data to send with the event
   * @param exceptSocketId Socket ID to exclude from broadcast (typically the sender)
   */
  public broadcastToAll (event: string, data: any, exceptSocketId?: string): void {
    this.clients.forEach((client) => {
      if (exceptSocketId && client.id === exceptSocketId) {
        return;
      }
      client.socket.emit(event, data);
    });
  }

  /**
   * Send a direct message to a specific client by socket ID
   *
   * @param socketId Socket ID of recipient
   * @param event Event name to emit
   * @param data Data to send with the event
   * @returns True if client was found and message sent
   */
  public sendToClient (socketId: string, event: string, data: any): boolean {
    const client = this.clients.get(socketId);
    if (!client) return false;

    client.socket.emit(event, data);
    return true;
  }

  /**
   * Find clients based on metadata criteria
   *
   * @param criteria Function that returns true for matching clients
   * @returns Array of clients that match the criteria
   */
  public findClients (criteria: (client: ClientData) => boolean): ClientData[] {
    return Array.from(this.clients.values()).filter(criteria);
  }

  /**
   * Find all clients that follow a specific username
   *
   * @param username The username to check for in clients' following lists
   * @returns Array of clients that follow the given username
   */
  public findFollowers (username: string): ClientData[] {
    return this.findClients(client => {
      // Check if the client has a following list that includes the username
      const following = client.metadata?.following;
      return Array.isArray(following) && following.includes(username);
    });
  }

  /**
   * Check if a client follows another client by username
   *
   * @param followerSocketId Socket ID of the potential follower
   * @param targetUsername Username being followed
   * @returns True if follower is following target
   */
  public isFollowing (followerSocketId: string, targetUsername: string): boolean {
    const client = this.getClient(followerSocketId);
    if (!client || !client.metadata?.following) return false;

    return Array.isArray(client.metadata.following) &&
           client.metadata.following.includes(targetUsername);
  }

  /**
   * Broadcast a message to all followers of a username
   *
   * @param username Username whose followers should receive the message
   * @param event Socket event name
   * @param data Data to send
   * @returns Number of clients that received the message
   */
  public broadcastToFollowers (username: string, event: string, data: any): number {
    const followers = this.findFollowers(username);
    const config = this.config.notifications;

    // Apply limit if there are too many followers
    let targetFollowers = followers;
    if (followers.length > config.maxFollowerNotifications) {
      console.warn(`Too many followers (${followers.length}) for ${username}, limiting to ${config.maxFollowerNotifications}`);
      targetFollowers = followers.slice(0, config.maxFollowerNotifications);
    }

    // Send to each follower, with optional throttling
    if (config.throttleMs > 0 && targetFollowers.length > 10) {
      // With throttling for large lists to prevent flooding
      console.log(`Throttled notification sending to ${targetFollowers.length} followers (${config.throttleMs}ms)`);

      let index = 0;
      const sendInterval = setInterval(() => {
        if (index < targetFollowers.length) {
          targetFollowers[index].socket.emit(event, data);
          index++;
        } else {
          clearInterval(sendInterval);
        }
      }, config.throttleMs);
    } else {
      // Without throttling for small follower counts
      targetFollowers.forEach(follower => {
        follower.socket.emit(event, data);
      });
    }

    return targetFollowers.length;
  }
}

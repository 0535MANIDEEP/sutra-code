import { WEBSOCKET_CONFIG } from '../constants';
import { authService } from './authService';
import { WebSocketMessage, ChatMessage } from '../types';

type WebSocketEventHandler = (data: any) => void;

class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();
  private isConnecting = false;
  private shouldReconnect = true;

  private constructor() {
    // Auto-connect when user is authenticated
    this.checkAuthAndConnect();
    
    // Listen for auth changes
    window.addEventListener('authRequired', () => {
      this.disconnect();
    });
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Check authentication and connect if user is authenticated
   */
  private checkAuthAndConnect(): void {
    const user = authService.getCurrentUser();
    if (user && authService.isAuthenticated()) {
      this.connect();
    }
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    const user = authService.getCurrentUser();
    if (!user?.accessToken) {
      console.warn('Cannot connect to WebSocket: User not authenticated');
      return;
    }

    // Check if we're in demo mode (no WebSocket URL configured or demo mode enabled)
    const isDemoMode = !WEBSOCKET_CONFIG.URL || 
                      WEBSOCKET_CONFIG.URL.includes('ws.sutra-code.edu.in') ||
                      process.env.REACT_APP_DEMO_MODE === 'true';

    if (isDemoMode) {
      console.log('WebSocket running in demo mode - simulating connection');
      this.simulateDemoConnection();
      return;
    }

    this.isConnecting = true;
    this.shouldReconnect = true;

    try {
      // Construct WebSocket URL with auth token
      const wsUrl = `${WEBSOCKET_CONFIG.URL}?token=${encodeURIComponent(user.accessToken)}`;
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.emit('connected', { timestamp: Date.now() });
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.isConnecting = false;
        this.stopHeartbeat();
        this.emit('disconnected', { code: event.code, reason: event.reason });
        
        if (this.shouldReconnect && this.reconnectAttempts < WEBSOCKET_CONFIG.MAX_RECONNECT_ATTEMPTS) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.emit('error', { error });
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.isConnecting = false;
      this.emit('error', { error });
    }
  }

  /**
   * Simulate demo WebSocket connection
   */
  private simulateDemoConnection(): void {
    this.isConnecting = true;
    
    // Simulate connection delay
    setTimeout(() => {
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      
      // Create a mock WebSocket-like object
      this.ws = {
        readyState: WebSocket.OPEN,
        send: (data: string) => {
          console.log('Demo WebSocket send:', data);
          // In demo mode, we can simulate responses here if needed
        },
        close: () => {
          console.log('Demo WebSocket closed');
        }
      } as any;

      console.log('Demo WebSocket connected successfully');
      this.emit('connected', { timestamp: Date.now(), demo: true });
      
      // Start demo heartbeat
      this.startDemoHeartbeat();
    }, 1000);
  }

  /**
   * Start demo heartbeat to maintain "connected" status
   */
  private startDemoHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      // Keep the demo connection alive
      if (this.ws?.readyState === WebSocket.OPEN) {
        console.log('Demo heartbeat - connection alive');
      }
    }, WEBSOCKET_CONFIG.HEARTBEAT_INTERVAL);
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.shouldReconnect = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.emit('disconnected', { reason: 'Client disconnect' });
  }

  /**
   * Send message through WebSocket
   */
  send(type: 'message' | 'typing' | 'session_update' | 'error' | 'chat_message' | 'join_session' | 'leave_session' | 'ping' | 'pong', data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type,
        data,
        timestamp: Date.now(),
      };
      
      if (typeof this.ws.send === 'function') {
        this.ws.send(JSON.stringify(message));
      } else {
        // Demo mode - just log the message
        console.log('Demo WebSocket send:', { type, data });
        
        // Simulate some responses in demo mode
        if (type === 'chat_message') {
          // Simulate a response from the Socratic AI mentor
          setTimeout(() => {
            this.simulateSocraticResponse(data);
          }, 2000);
        }
      }
    } else {
      console.warn('WebSocket not connected. Message not sent:', { type, data });
      // Optionally queue messages for when connection is restored
    }
  }

  /**
   * Simulate Socratic AI response in demo mode
   */
  private simulateSocraticResponse(originalMessage: any): void {
    const demoResponses = [
      {
        id: `demo-${Date.now()}`,
        type: 'mentor',
        content: "That's an interesting question! Let me guide you to discover the answer. Think about how a cricket captain organizes the batting order - what factors do they consider?",
        timestamp: Date.now(),
        culturalAnalogy: "Just like a cricket captain arranges players based on their strengths and the match situation, sorting algorithms arrange data elements in a specific order based on certain criteria.",
        sessionId: originalMessage.sessionId || 'demo-session'
      },
      {
        id: `demo-${Date.now()}`,
        type: 'mentor', 
        content: "Excellent! Now, when you're at a mandi looking for the best price for vegetables, do you check every vendor randomly? What strategy would save you time?",
        timestamp: Date.now(),
        culturalAnalogy: "Searching algorithms work like finding the best price in a mandi - you need a systematic approach rather than checking randomly.",
        sessionId: originalMessage.sessionId || 'demo-session'
      },
      {
        id: `demo-${Date.now()}`,
        type: 'mentor',
        content: "Think about how your grandmother teaches you to make biryani - she breaks it down into steps, and each step might have its own sub-steps. How does this relate to your programming question?",
        timestamp: Date.now(),
        culturalAnalogy: "Recursion is like traditional cooking recipes passed down through generations - each recipe can call upon simpler recipes to complete the dish.",
        sessionId: originalMessage.sessionId || 'demo-session'
      }
    ];

    const randomResponse = demoResponses[Math.floor(Math.random() * demoResponses.length)];
    this.emit('message', randomResponse);
  }

  /**
   * Send chat message
   */
  sendChatMessage(message: ChatMessage): void {
    this.send('chat_message', message);
  }

  /**
   * Send typing indicator
   */
  sendTypingIndicator(sessionId: string, isTyping: boolean): void {
    this.send('typing', { sessionId, isTyping });
  }

  /**
   * Join chat session
   */
  joinSession(sessionId: string): void {
    this.send('join_session', { sessionId });
  }

  /**
   * Leave chat session
   */
  leaveSession(sessionId: string): void {
    this.send('leave_session', { sessionId });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'message':
        this.emit('message', message.data);
        break;
      case 'typing':
        this.emit('typing', message.data);
        break;
      case 'session_update':
        this.emit('sessionUpdate', message.data);
        break;
      case 'error':
        this.emit('error', message.data);
        break;
      case 'pong':
        // Heartbeat response - connection is alive
        break;
      default:
        console.warn('Unknown WebSocket message type:', message.type);
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(
      WEBSOCKET_CONFIG.RECONNECT_INTERVAL * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send('ping', { timestamp: Date.now() });
      }
    }, WEBSOCKET_CONFIG.HEARTBEAT_INTERVAL);
  }

  /**
   * Stop heartbeat timer
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Add event listener
   */
  on(event: string, handler: WebSocketEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Remove event listener
   */
  off(event: string, handler: WebSocketEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Error in WebSocket event handler:', error);
        }
      });
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): 'connected' | 'connecting' | 'disconnected' {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return 'connected';
    } else if (this.isConnecting) {
      return 'connecting';
    } else {
      return 'disconnected';
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Export singleton instance
export const websocketService = WebSocketService.getInstance();
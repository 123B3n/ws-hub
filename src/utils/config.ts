import fs from 'fs';
import path from 'path';

interface ServerConfig {
  httpPort: number;
  httpsPort: number;
  host: string;
  environment: string;
}

interface HeartbeatConfig {
  enabled: boolean;
  interval: number;  // milliseconds between heartbeats
  timeout: number;   // milliseconds to wait for response
  maxMissed: number; // max number of missed heartbeats before disconnect
}

interface SecurityConfig {
  corsOrigins: string[];
  disableCors: boolean;  // New option to completely disable CORS
  maxMessageSize: number; // bytes
  rateLimit: {
    enabled: boolean;
    maxRequestsPerMinute: number;
  };
}

interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  logToFile: boolean;
  logDir: string;
  logClientEvents: boolean;
}

interface NotificationConfig {
  maxFollowerNotifications: number; // maximum number of notifications to send at once
  throttleMs: number;               // throttle notifications if sent too quickly
  maxContentSize: number;           // maximum size of notification content
}

export interface Config {
  server: ServerConfig;
  heartbeat: HeartbeatConfig;
  security: SecurityConfig;
  logging: LoggingConfig;
  notifications: NotificationConfig;
  customSettings: Record<string, any>; // For additional application-specific settings
}

const defaultConfig: Config = {
  server: {
    // Using non-standard ports to avoid conflict with IIS
    httpPort: 8080,
    httpsPort: 8443,
    host: '0.0.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  heartbeat: {
    enabled: true,
    interval: 30000,  // 30 seconds
    timeout: 5000,    // 5 seconds
    maxMissed: 5      // 5 missed heartbeats = disconnect
  },
  security: {
    corsOrigins: ["*"],
    disableCors: false,  // Default to CORS enabled
    maxMessageSize: 100 * 1024, // 100KB
    rateLimit: {
      enabled: true,
      maxRequestsPerMinute: 300
    }
  },
  logging: {
    level: 'info',
    logToFile: true,
    logDir: 'logs',
    logClientEvents: false
  },
  notifications: {
    maxFollowerNotifications: 10000, // Don't overload with huge follower lists
    throttleMs: 0,                  // No throttling by default
    maxContentSize: 10 * 1024       // 10KB
  },
  customSettings: {
    appName: "WebSocket Server",
    appVersion: "1.0.0",
    adminContact: "admin@example.com",
    typingTimeout: 5000 // 5 second timeout for typing indicators
  }
};

/**
 * Detects the running environment
 * @returns The detected environment (development, production, or iis)
 */
export function detectEnvironment(): string {
  if (process.env.IISNODE_VERSION) {
    return 'iis';
  }
  return process.env.NODE_ENV || 'development';
}

/**
 * Reads the configuration from config.json file or returns default values
 * @param forceReload Whether to force reload the config from disk
 * @returns The merged configuration with defaults
 */
export function getConfiguration(forceReload = false): Config {
  // Use static variable for caching config
  const environment = detectEnvironment();
  
  if (!forceReload && _cachedConfig) {
    return _cachedConfig;
  }
  
  console.log(`Loading configuration for environment: ${environment}`);
  
  try {
    // First check for environment-specific config file
    const envConfigPath = path.join(__dirname, `../../config.${environment}.json`);
    const defaultConfigPath = path.join(__dirname, '../../config.json');
    
    let configPath = defaultConfigPath;
    if (fs.existsSync(envConfigPath)) {
      configPath = envConfigPath;
      console.log(`Using environment-specific config: ${envConfigPath}`);
    } else {
      console.log(`Using default config: ${defaultConfigPath}`);
    }
    
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      const userConfig = JSON.parse(configData);
      
      // Deep merge configuration with defaults
      const mergedConfig = deepMerge(defaultConfig, userConfig);
      
      // Always set environment correctly
      mergedConfig.server.environment = environment;
      
      console.log('Configuration loaded successfully');
      _cachedConfig = mergedConfig;
      return mergedConfig;
    }
  } catch (error) {
    console.warn('Error reading configuration file:', error);
    console.warn('Using default configuration');
  }
  
  // Return default config with current environment set
  const defaultWithEnv = {
    ...defaultConfig,
    server: {
      ...defaultConfig.server,
      environment
    }
  };
  
  _cachedConfig = defaultWithEnv;
  return defaultWithEnv;
}

// Cache the loaded config
let _cachedConfig: Config | null = null;

/**
 * Saves the current configuration to the config.json file
 * @param config The configuration to save
 * @param environment Optional environment to save to (saves to config.{environment}.json)
 * @returns True if saved successfully, false otherwise
 */
export function saveConfiguration(config: Config, environment?: string): boolean {
  try {
    let configPath: string;
    
    if (environment) {
      configPath = path.join(__dirname, `../../config.${environment}.json`);
    } else {
      configPath = path.join(__dirname, '../../config.json');
    }
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log(`Configuration saved to: ${configPath}`);
    
    // Update cached config
    _cachedConfig = config;
    
    return true;
  } catch (error) {
    console.error('Error saving configuration:', error);
    return false;
  }
}

/**
 * Forces a reload of the configuration from disk
 * @returns The freshly loaded configuration
 */
export function reloadConfiguration(): Config {
  return getConfiguration(true);
}

/**
 * Deep merge two objects
 * @param target The target object to merge into
 * @param source The source object to merge from
 * @returns The merged object
 */
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  if (!source) return target;
  
  const output = {...target};
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key as keyof typeof source])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key as keyof typeof source] });
        } else {
          (output as any)[key] = deepMerge(
            (target as any)[key],
            (source as any)[key]
          );
        }
      } else {
        Object.assign(output, { [key]: source[key as keyof typeof source] });
      }
    });
  }
  
  return output;
}

function isObject(item: any): boolean {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

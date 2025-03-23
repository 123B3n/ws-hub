/**
 * Connectivity checker for WebSocket Server
 * This script checks if the ports required for the WebSocket server are open
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// Read configuration from config.json
function getConfig() {
  try {
    const configPath = path.join(__dirname, 'config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Error reading config:', error);
    return { server: { httpPort: 8080, httpsPort: 8443 } };
  }
}

const config = getConfig();
const { httpPort, httpsPort } = config.server;

console.log('WebSocket Server Connectivity Check');
console.log('=============================================');

// Get local IP addresses
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  
  Object.keys(interfaces).forEach(interfaceName => {
    interfaces[interfaceName].forEach(interfaceInfo => {
      // Skip internal and non-IPv4 addresses
      if (interfaceInfo.family === 'IPv4' && !interfaceInfo.internal) {
        addresses.push(interfaceInfo.address);
      }
    });
  });
  
  return addresses;
}

// Check if a port is in use
function checkPortInUse(port) {
  try {
    const server = http.createServer();
    
    return new Promise((resolve) => {
      server.once('error', err => {
        if (err.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          resolve(false);
        }
      });
      
      server.once('listening', () => {
        server.close();
        resolve(false);
      });
      
      server.listen(port);
    });
  } catch (error) {
    console.error(`Error checking port ${port}:`, error);
    return false;
  }
}

// Check if firewall is blocking ports
async function checkFirewall() {
  console.log('\nChecking firewall status...');
  
  const platform = os.platform();
  if (platform === 'win32') {
    try {
      // Check Windows Firewall status
      const firewallOutput = execSync('netsh advfirewall show allprofiles').toString();
      console.log('Windows Firewall Status:');
      
      // Extract status for each profile
      const profiles = ['Domain Profile', 'Private Profile', 'Public Profile'];
      profiles.forEach(profile => {
        const profileSection = firewallOutput.split(profile)[1]?.split('\r\n\r\n')[0];
        if (profileSection) {
          const stateMatch = profileSection.match(/State\s+(ON|OFF)/i);
          if (stateMatch) {
            console.log(`  ${profile}: ${stateMatch[1]}`);
          }
        }
      });
      
      // Check specific ports
      console.log('\nChecking port rules...');
      const portsToCheck = [httpPort, httpsPort];
      
      for (const port of portsToCheck) {
        try {
          const portRuleOutput = execSync(`netsh advfirewall firewall show rule name=all | findstr /C:"${port}"`).toString();
          if (portRuleOutput) {
            console.log(`Port ${port} has firewall rules:`);
            console.log(portRuleOutput.trim());
          } else {
            console.log(`No specific rules found for port ${port}`);
          }
        } catch (error) {
          // No rules found is expected
          console.log(`No specific rules found for port ${port}`);
        }
      }
    } catch (error) {
      console.error('Error checking Windows firewall:', error.message);
    }
  } else if (platform === 'linux') {
    try {
      // Check if ufw is installed and active
      try {
        const ufwStatus = execSync('ufw status').toString();
        console.log('UFW Firewall Status:');
        console.log(ufwStatus);
      } catch (error) {
        // ufw may not be installed
      }
      
      // Check if iptables has rules
      try {
        const iptablesRules = execSync('iptables -L -n').toString();
        console.log('\nIPTables Rules:');
        
        // Look for rules affecting our ports
        const portsToCheck = [httpPort, httpsPort];
        portsToCheck.forEach(port => {
          if (iptablesRules.includes(`:${port}`)) {
            console.log(`Rules found affecting port ${port}`);
          } else {
            console.log(`No specific rules found for port ${port}`);
          }
        });
      } catch (error) {
        console.log('Could not check iptables rules (might need sudo)');
      }
    } catch (error) {
      console.error('Error checking Linux firewall:', error.message);
    }
  } else {
    console.log(`Firewall checking not implemented for platform: ${platform}`);
  }
}

// Main function to run tests
async function runChecks() {
  console.log(`Checking ports ${httpPort} and ${httpsPort}...`);
  
  // Check if ports are already in use locally
  const httpPortInUse = await checkPortInUse(httpPort);
  const httpsPortInUse = await checkPortInUse(httpsPort);
  
  console.log(`HTTP Port ${httpPort}: ${httpPortInUse ? 'In use' : 'Available'}`);
  console.log(`HTTPS Port ${httpsPort}: ${httpsPortInUse ? 'In use' : 'Available'}`);
  
  // Get local IP addresses
  const localIps = getLocalIpAddresses();
  console.log('\nLocal IP Addresses:');
  localIps.forEach(ip => console.log(`  - ${ip}`));
  
  // Check firewall
  await checkFirewall();
  
  console.log('\nAdditional Troubleshooting Tips:');
  console.log('1. Ensure ports are open in any cloud provider firewall/security group');
  console.log('2. If using Cloudflare, ensure WebSockets are enabled in Network settings');
  console.log('3. Verify your domain is pointing to the correct IP address');
  console.log('4. Check for any active VPN that might interfere with connections');
}

// Run all checks
runChecks().catch(console.error);

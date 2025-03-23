/**
 * Environment setup script to initialize the project
 * Run this before first use with: node env-setup.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Directories to create
const dirs = ['certs', 'logs', 'iisnode'];

console.log('Setting up WebSocket Server environment...');

// Create necessary directories
dirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Create default config if it doesn't exist
const configPath = path.join(__dirname, 'config.json');
if (!fs.existsSync(configPath)) {
  console.log('Creating default config.json');
  const defaultConfig = {
    server: {
      httpPort: 8080,
      httpsPort: 8443,
      host: 'localhost'
    }
  };
  fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
}

// Check Node.js version
console.log('Checking Node.js version...');
const nodeVersion = process.version;
console.log(`Node.js version: ${nodeVersion}`);
const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
if (majorVersion < 14) {
  console.warn('WARNING: This application requires Node.js 14 or higher.');
}

// Install dependencies if node_modules doesn't exist
if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
  console.log('Installing dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('Dependencies installed successfully.');
  } catch (error) {
    console.error('Error installing dependencies:', error.message);
  }
}

console.log('\nEnvironment setup complete!');
console.log('\nYou can now:');
console.log('1. For development: npm run dev');
console.log('2. For production: npm run build && npm start');
console.log('3. For IIS deployment: npm run prepare:iis');

import { rl } from './utils/readline';
import { startSocketServer } from './server';
import { generateSSLCertificate } from './utils/ssl';
import { checkCertificateExpiry } from './utils/cert-checker';
import { getConfiguration, saveConfiguration } from './utils/config';

function displayMenu (): void {
  console.clear();
  console.log('==============================');
  console.log('  WebSocket Server Manager');
  console.log('==============================');
  console.log('1. Start Socket.IO Server');
  console.log('2. Generate SSL Certificate');
  console.log('3. Check Certificate Status');
  console.log('4. Configure Server Ports');
  console.log('5. Exit');
  console.log('==============================');

  rl.question('Select an option (1-5): ', (answer) => {
    switch (answer.trim()) {
    case '1':
      console.log('\nStarting Socket.IO server...');
      startSocketServer();
      break;
    case '2':
      generateSSLCertificate()
        .then(() => {
          console.log('\nSSL certificate generation complete.');
          promptToContinue();
        })
        .catch(error => {
          console.error('\nError generating SSL certificate:', error);
          promptToContinue();
        });
      break;
    case '3':
      checkCertificateExpiry()
        .then(() => {
          console.log('\nCertificate status check complete.');
          promptToContinue();
        })
        .catch(error => {
          console.error('\nError checking certificate status:', error);
          promptToContinue();
        });
      break;
    case '4':
      configureServerPorts()
        .then(() => {
          promptToContinue();
        })
        .catch(error => {
          console.error('\nError configuring server ports:', error);
          promptToContinue();
        });
      break;
    case '5':
      console.log('\nExiting application...');
      rl.close();
      process.exit(0);
      break;
    default:
      console.log('\nInvalid option. Please try again.');
      promptToContinue();
    }
  });
}

function promptToContinue (): void {
  rl.question('\nPress Enter to return to the main menu...', () => {
    displayMenu();
  });
}

async function configureServerPorts (): Promise<void> {
  const config = getConfiguration();

  console.log('\nCurrent Port Configuration:');
  console.log(`HTTP Port: ${config.server.httpPort}`);
  console.log(`HTTPS Port: ${config.server.httpsPort}`);

  const newHttpPort = await promptForPort('Enter new HTTP port (8080-65535)', config.server.httpPort);
  const newHttpsPort = await promptForPort('Enter new HTTPS port (8080-65535)', config.server.httpsPort);

  config.server.httpPort = newHttpPort;
  config.server.httpsPort = newHttpsPort;

  saveConfiguration(config);
  console.log('\nPort configuration updated successfully.');
}

function promptForPort (message: string, defaultPort: number): Promise<number> {
  return new Promise((resolve) => {
    rl.question(`${message} [${defaultPort}]: `, (input) => {
      if (!input.trim()) {
        resolve(defaultPort);
        return;
      }

      const port = parseInt(input.trim(), 10);
      if (isNaN(port) || port < 1024 || port > 65535) {
        console.log('Invalid port number. Using default port.');
        resolve(defaultPort);
      } else {
        resolve(port);
      }
    });
  });
}

// Handle application exit
process.on('SIGINT', () => {
  console.log('\nApplication terminated by user.');
  rl.close();
  process.exit(0);
});

// Start the application
displayMenu();

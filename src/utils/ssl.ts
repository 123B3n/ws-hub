import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { rl } from './readline';

// Store information about installed certificates for renewal management
interface CertificateInfo {
  domain: string;
  renewalDate: Date;
  installed: Date;
}

const CERT_INFO_FILE = path.join(__dirname, '../../certs/cert-info.json');

export async function generateSSLCertificate (): Promise<void> {
  console.log('\nLet\'s Encrypt Certificate Generator');
  console.log('===================================');

  try {
    // Create directory for certificates if it doesn't exist
    const certDir = path.join(__dirname, '../../certs');
    await fs.mkdir(certDir, { recursive: true });

    // Check if certbot is installed
    const isCertbotInstalled = await checkCertbotInstalled();

    if (!isCertbotInstalled) {
      console.log('\nCertbot is not installed. Installing Certbot...');
      await installCertbot();
    }

    return new Promise((resolve, reject) => {
      promptForDomain(async (domain) => {
        promptForEmail(async (email) => {
          // Check if a certificate for this domain already exists
          const existingCertInfo = await getCertificateInfo();
          if (existingCertInfo && existingCertInfo.domain !== domain) {
            // Ask to remove previous domain's renewal configuration
            await promptForRenewalCleanup(existingCertInfo.domain);
          }

          console.log(`\nRequesting Let's Encrypt certificate for: ${domain}`);
          console.log('This may take a moment...');

          try {
            await requestLetsEncryptCertificate(domain, email, certDir);

            // Setup auto-renewal
            await setupAutoRenewal(domain, certDir);

            // Save certificate info for future reference
            await saveCertificateInfo({
              domain,
              renewalDate: new Date(Date.now() + (90 * 24 * 60 * 60 * 1000)), // 90 days from now
              installed: new Date()
            });

            console.log('\nLet\'s Encrypt certificate obtained successfully!');
            console.log('Certificate will auto-renew approximately 30 days before expiration.');
            resolve();
          } catch (error) {
            console.error('\nError obtaining Let\'s Encrypt certificate:', error);
            reject(error);
          }
        });
      });
    });
  } catch (error) {
    console.error('Error in certificate generation process:', error);
    throw error;
  }
}

// Function to prompt user about cleaning up previous domain's renewal configuration
async function promptForRenewalCleanup (oldDomain: string): Promise<void> {
  return new Promise((resolve) => {
    rl.question(`\nA certificate was previously generated for ${oldDomain}. Do you want to remove its auto-renewal configuration? (yes/no): `, async (answer) => {
      if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        try {
          console.log(`Removing renewal configuration for ${oldDomain}...`);
          await removeRenewalConfiguration(oldDomain);
          console.log('Previous renewal configuration removed.');
        } catch (error) {
          console.error('Error removing renewal configuration:', error);
          console.log('Continuing with new certificate generation...');
        }
      } else {
        console.log('Keeping previous renewal configuration.');
      }
      resolve();
    });
  });
}

// Get saved certificate information
async function getCertificateInfo (): Promise<CertificateInfo | null> {
  try {
    const data = await fs.readFile(CERT_INFO_FILE, 'utf8');
    return JSON.parse(data) as CertificateInfo;
  } catch (error) {
    // File doesn't exist or is invalid
    return null;
  }
}

// Save certificate information for renewal tracking
async function saveCertificateInfo (info: CertificateInfo): Promise<void> {
  await fs.writeFile(CERT_INFO_FILE, JSON.stringify(info, null, 2), 'utf8');
}

// Remove renewal configuration for a domain
async function removeRenewalConfiguration (domain: string): Promise<void> {
  const platform = os.platform();
  const isWindows = platform === 'win32';

  return new Promise((resolve, reject) => {
    // Command to delete the renewal configuration
    const command = isWindows
      ? `certbot delete --cert-name ${domain} --non-interactive`
      : `sudo certbot delete --cert-name ${domain} --non-interactive`;

    console.log(`Executing command: ${command}`);
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Error removing renewal configuration:', stderr || error);
        reject(error);
        return;
      }
      console.log(stdout);
      resolve();
    });
  });
}

// Setup automatic renewal
async function setupAutoRenewal (domain: string, certDir: string): Promise<void> {
  const platform = os.platform();
  const isWindows = platform === 'win32';

  // Log message about automatic renewal
  console.log('\nSetting up automatic certificate renewal...');

  if (isWindows) {
    await setupWindowsAutoRenewal(domain, certDir);
  } else {
    await setupLinuxAutoRenewal(domain, certDir);
  }
}

// Setup auto-renewal on Windows
async function setupWindowsAutoRenewal (domain: string, certDir: string): Promise<void> {
  try {
    // Create a batch script to run post-renewal to copy certificates to our app
    const hookDir = path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'certbot', 'renewal-hooks', 'post');
    const scriptPath = path.join(hookDir, `copy-${domain.replace(/\./g, '-')}-certs.bat`);

    // Get the absolute path to the application directory
    const appDir = path.resolve(path.join(__dirname, '../..'));

    // Windows uses %VARIABLE% syntax in batch files
    const scriptContent = `@echo off
echo Copying renewed certificates for ${domain} to application directory
copy "%PROGRAMDATA%\\certbot\\live\\${domain}\\privkey.pem" "${path.join(certDir, 'key.pem')}"
copy "%PROGRAMDATA%\\certbot\\live\\${domain}\\fullchain.pem" "${path.join(certDir, 'cert.pem')}"
echo Certificate copy complete

echo Certificate update complete - automatic hot reload will occur through file system watcher
`;

    // Ensure hook directory exists
    await fs.mkdir(hookDir, { recursive: true });

    // Write the script file
    await fs.writeFile(scriptPath, scriptContent, 'utf8');
    console.log(`Created post-renewal hook script at ${scriptPath}`);

    // Check if the Windows Task Scheduler already has a Certbot renewal task
    console.log('Checking for existing Certbot renewal task in Windows Task Scheduler...');
    const checkTask = new Promise<boolean>((resolve) => {
      exec('schtasks /query /tn "Certbot Renewal"', (error) => {
        resolve(!error); // Task exists if there's no error
      });
    });

    if (!await checkTask) {
      console.log('Creating Certbot renewal task in Windows Task Scheduler...');
      // Create a scheduled task to run certbot renew daily
      const taskCommand = 'schtasks /create /tn "Certbot Renewal" /tr "certbot renew" /sc daily /st 00:00 /ru SYSTEM';

      await new Promise<void>((resolve, reject) => {
        exec(taskCommand, (error, stdout, stderr) => {
          if (error) {
            console.error('Error creating scheduled task:', stderr || error);
            console.log('You may need to manually set up certificate renewal by running:');
            console.log('certbot renew --dry-run');
            resolve(); // Continue despite error
          } else {
            console.log('Scheduled task created successfully for automatic renewal');
            resolve();
          }
        });
      });
    } else {
      console.log('Certbot renewal task already exists in Windows Task Scheduler');
    }
  } catch (error) {
    console.error('Error setting up auto renewal on Windows:', error);
    console.log('You may need to manually set up certificate renewal');
  }
}

// Setup auto-renewal on Linux
async function setupLinuxAutoRenewal (domain: string, certDir: string): Promise<void> {
  try {
    // Create a shell script to run post-renewal to copy certificates to our app
    const hookDir = '/etc/letsencrypt/renewal-hooks/post';
    const scriptName = `copy-${domain.replace(/\./g, '-')}-certs.sh`;
    const scriptPath = path.join(hookDir, scriptName);

    const scriptContent = `#!/bin/bash
echo "Copying renewed certificates for ${domain} to application directory"
sudo cp /etc/letsencrypt/live/${domain}/privkey.pem ${path.join(certDir, 'key.pem')}
sudo cp /etc/letsencrypt/live/${domain}/fullchain.pem ${path.join(certDir, 'cert.pem')}
sudo chmod 644 ${path.join(certDir, '*.pem')}
echo "Certificate copy complete"

echo "Certificate update complete - automatic hot reload will occur through file system watcher"
`;

    // Write the script to a temp file first since we need sudo to write to the hooks directory
    const tempScriptPath = path.join('/tmp', scriptName);
    await fs.writeFile(tempScriptPath, scriptContent, 'utf8');

    // Copy the script to the hooks directory and make it executable
    console.log('Installing post-renewal hook script...');
    await new Promise<void>((resolve, reject) => {
      exec(`sudo mkdir -p ${hookDir} && sudo cp ${tempScriptPath} ${scriptPath} && sudo chmod +x ${scriptPath}`, (error, stdout, stderr) => {
        if (error) {
          console.error('Error installing post-renewal script:', stderr || error);
          reject(error);
        } else {
          console.log(`Created post-renewal hook script at ${scriptPath}`);
          resolve();
        }
      });
    });

    // Check if crontab already has the certbot renewal entry
    console.log('Checking for existing certbot renewal cron job...');
    const hasCronEntry = await new Promise<boolean>((resolve) => {
      exec('sudo crontab -l | grep -q "certbot renew"', (error) => {
        resolve(!error); // Entry exists if there's no error
      });
    });

    if (!hasCronEntry) {
      console.log('Setting up cron job for certificate renewal...');
      // Add a cron job to run certbot renew twice daily (standard practice)
      await new Promise<void>((resolve, reject) => {
        exec('(sudo crontab -l 2>/dev/null; echo "0 0,12 * * * certbot renew --quiet") | sudo crontab -', (error, stdout, stderr) => {
          if (error) {
            console.error('Error setting up cron job:', stderr || error);
            console.log('You may need to manually set up certificate renewal by running:');
            console.log('certbot renew --dry-run');
            resolve(); // Continue despite error
          } else {
            console.log('Cron job set up successfully for automatic renewal');
            resolve();
          }
        });
      });
    } else {
      console.log('Certbot renewal cron job already exists');
    }
  } catch (error) {
    console.error('Error setting up auto renewal on Linux:', error);
    console.log('You may need to manually set up certificate renewal');
  }
}

function promptForDomain (callback: (domain: string) => void): void {
  rl.question('Enter domain name (must be publicly accessible): ', (domain) => {
    // Simple domain validation - checks for basic domain name format
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

    if (!domain || !domainRegex.test(domain)) {
      console.log('\nPlease enter a valid domain name (e.g., example.com).');
      // Re-prompt for domain
      promptForDomain(callback);
    } else {
      callback(domain);
    }
  });
}

function promptForEmail (callback: (email: string) => void): void {
  rl.question('Enter your email address (for Let\'s Encrypt notifications): ', (email) => {
    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailRegex.test(email)) {
      console.log('\nPlease enter a valid email address (e.g., user@example.com).');
      // Re-prompt for email
      promptForEmail(callback);
    } else {
      callback(email);
    }
  });
}

async function checkCertbotInstalled (): Promise<boolean> {
  return new Promise((resolve) => {
    exec('certbot --version', (error) => {
      if (error) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

async function installCertbot (): Promise<void> {
  return new Promise((resolve, reject) => {
    const platform = os.platform();
    let installCommand: string;

    if (platform === 'win32') {
      // Windows installation using Chocolatey
      console.log('Installing Certbot using Chocolatey on Windows...');
      console.log('First, checking if Chocolatey is installed...');

      exec('choco --version', (error) => {
        if (error) {
          console.log('Chocolatey not found. Please install Chocolatey first:');
          console.log('Run PowerShell as Administrator and execute:');
          console.log('Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString(\'https://chocolatey.org/install.ps1\'))');
          reject(new Error('Chocolatey not installed'));
          return;
        }

        console.log('Installing Certbot using Chocolatey...');
        exec('choco install certbot -y', (error, stdout, stderr) => {
          if (error) {
            console.error('Error installing Certbot:', stderr);
            reject(error);
            return;
          }
          console.log('Certbot installed successfully.');
          resolve();
        });
      });
    } else if (platform === 'linux') {
      // Linux installation based on distribution
      exec('cat /etc/os-release', (error, stdout) => {
        if (error) {
          reject(new Error('Could not determine Linux distribution'));
          return;
        }

        if (stdout.includes('Ubuntu') || stdout.includes('Debian')) {
          installCommand = 'sudo apt update && sudo apt install -y certbot';
        } else if (stdout.includes('CentOS') || stdout.includes('Red Hat') || stdout.includes('Fedora')) {
          installCommand = 'sudo yum install -y certbot';
        } else {
          console.log('Unsupported Linux distribution. Please install Certbot manually:');
          console.log('Visit: https://certbot.eff.org/instructions');
          reject(new Error('Unsupported Linux distribution'));
          return;
        }

        console.log(`Installing Certbot on Linux using: ${installCommand}`);
        exec(installCommand, (error, stdout, stderr) => {
          if (error) {
            console.error('Error installing Certbot:', stderr);
            reject(error);
            return;
          }
          console.log('Certbot installed successfully.');
          resolve();
        });
      });
    } else {
      reject(new Error(`Unsupported platform: ${platform}`));
    }
  });
}

async function requestLetsEncryptCertificate (domain: string, email: string, certDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const platform = os.platform();
    const isWindows = platform === 'win32';

    // We'll use the standalone plugin which temporarily starts its own web server
    const certbotCommand = `${isWindows ? '' : 'sudo '}certbot certonly --standalone --agree-tos --non-interactive --email ${email} -d ${domain}`;

    console.log(`Running command: ${certbotCommand}`);
    exec(certbotCommand, async (error, stdout, stderr) => {
      if (error) {
        console.error('Certbot error:', stderr || error);
        reject(error);
        return;
      }

      console.log(stdout);

      try {
        // Find certificates dynamically by running certbot certificates command
        const certPaths = await findCertificatePaths(domain, isWindows);

        if (!certPaths) {
          throw new Error(`Could not find certificate paths for domain: ${domain}`);
        }

        // Copy certificates to our application's cert directory
        if (isWindows) {
          await copyWindowsCerts(certPaths.privkey, certPaths.fullchain, certDir);
        } else {
          await copyLinuxCerts(certPaths.privkey, certPaths.fullchain, certDir);
        }

        console.log(`Certificates copied to application directory: ${certDir}`);
        resolve();
      } catch (copyError) {
        console.error('Error copying certificates:', copyError);
        reject(copyError);
      }
    });
  });
}

async function findCertificatePaths (domain: string, isWindows: boolean): Promise<{privkey: string, fullchain: string} | null> {
  return new Promise((resolve) => {
    const certbotCommand = `${isWindows ? '' : 'sudo '}certbot certificates`;

    console.log('Detecting certificate paths...');
    exec(certbotCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('Error getting certificate information:', stderr || error);
        resolve(null);
        return;
      }

      console.log('Parsing certificate information...');

      // Extract certificate paths from certbot's output
      const output = stdout.toString();
      console.log('Certificate info:', output);

      let privkeyPath = '';
      let fullchainPath = '';

      // Try to extract the paths from certbot output
      const lines = output.split('\n');
      let foundDomain = false;

      for (const line of lines) {
        // Look for the domain first
        if (line.includes(`Domains: ${domain}`)) {
          foundDomain = true;
          continue;
        }

        if (foundDomain) {
          if (line.includes('Certificate Path:')) {
            const certPathMatch = line.match(/Certificate Path: (.+)/);
            if (certPathMatch && certPathMatch[1]) {
              // Normally fullchain is in the same directory as cert
              const certPath = certPathMatch[1];
              const certDir = path.dirname(certPath);
              fullchainPath = path.join(certDir, 'fullchain.pem');
              privkeyPath = path.join(certDir, 'privkey.pem');
              break;
            }
          } else if (line.includes('Private Key Path:')) {
            const privKeyMatch = line.match(/Private Key Path: (.+)/);
            if (privKeyMatch && privKeyMatch[1]) {
              privkeyPath = privKeyMatch[1];
            }
          } else if (line.includes('Fullchain Path:') || line.includes('Certificate Chain Path:')) {
            const fullchainMatch = line.match(/(?:Fullchain|Certificate Chain) Path: (.+)/);
            if (fullchainMatch && fullchainMatch[1]) {
              fullchainPath = fullchainMatch[1];
            }
          } else if (line.trim() === '') {
            // Empty line means we've moved past this certificate's info
            foundDomain = false;
          }
        }
      }

      if (privkeyPath && fullchainPath) {
        console.log(`Found certificate paths for ${domain}:`);
        console.log(`Private Key: ${privkeyPath}`);
        console.log(`Full Chain: ${fullchainPath}`);
        resolve({ privkey: privkeyPath, fullchain: fullchainPath });
      } else {
        console.log(`Could not find certificate paths for ${domain} in certbot output.`);

        // Fallback to default paths
        if (isWindows) {
          const basePath = path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'certbot', 'live', domain);
          privkeyPath = path.join(basePath, 'privkey.pem');
          fullchainPath = path.join(basePath, 'fullchain.pem');
        } else {
          privkeyPath = `/etc/letsencrypt/live/${domain}/privkey.pem`;
          fullchainPath = `/etc/letsencrypt/live/${domain}/fullchain.pem`;
        }

        console.log('Using fallback paths:');
        console.log(`Private Key: ${privkeyPath}`);
        console.log(`Full Chain: ${fullchainPath}`);

        resolve({ privkey: privkeyPath, fullchain: fullchainPath });
      }
    });
  });
}

async function copyWindowsCerts (privkeyPath: string, fullchainPath: string, destination: string): Promise<void> {
  // Windows requires specific commands to copy potentially protected files
  const copyCommands = [
    `copy "${privkeyPath}" "${path.join(destination, 'key.pem')}"`,
    `copy "${fullchainPath}" "${path.join(destination, 'cert.pem')}"`
  ];

  console.log('Executing Windows copy commands:');
  for (const command of copyCommands) {
    console.log(`> ${command}`);
    await new Promise<void>((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Copy command error: ${error.message}`);
          console.error(`stderr: ${stderr}`);
          reject(error);
        } else {
          if (stdout) console.log(stdout);
          resolve();
        }
      });
    });
  }
}

async function copyLinuxCerts (privkeyPath: string, fullchainPath: string, destination: string): Promise<void> {
  // Linux requires sudo to access Let's Encrypt certificates
  const copyCommands = [
    `sudo cp "${privkeyPath}" "${path.join(destination, 'key.pem')}"`,
    `sudo cp "${fullchainPath}" "${path.join(destination, 'cert.pem')}"`,
    `sudo chmod 644 "${path.join(destination, '*.pem')}"`
  ];

  console.log('Executing Linux copy commands:');
  for (const command of copyCommands) {
    console.log(`> ${command}`);
    await new Promise<void>((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Copy command error: ${error.message}`);
          console.error(`stderr: ${stderr}`);
          reject(error);
        } else {
          if (stdout) console.log(stdout);
          resolve();
        }
      });
    });
  }
}

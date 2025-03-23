import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import os from 'os';
import { rl } from './readline';

interface CertificateInfo {
  domain: string;
  renewalDate: Date;
  installed: Date;
}

export async function checkCertificateExpiry(): Promise<void> {
  console.log('\nChecking SSL Certificate Status');
  console.log('============================');
  
  const certDir = path.join(__dirname, '../../certs');
  const infoFile = path.join(certDir, 'cert-info.json');
  const keyPath = path.join(certDir, 'key.pem');
  const certPath = path.join(certDir, 'cert.pem');
  
  try {
    // Check if certificates exist
    try {
      await Promise.all([
        fs.access(keyPath),
        fs.access(certPath)
      ]);
    } catch (error) {
      console.log('No certificates found in application directory.');
      return;
    }
    
    // Get certificate info if available
    let certInfo: CertificateInfo | null = null;
    try {
      const data = await fs.readFile(infoFile, 'utf8');
      certInfo = JSON.parse(data) as CertificateInfo;
      
      console.log(`Certificate Information:`);
      console.log(`Domain: ${certInfo.domain}`);
      console.log(`Installed: ${new Date(certInfo.installed).toLocaleString()}`);
      console.log(`Next renewal: ${new Date(certInfo.renewalDate).toLocaleString()}`);
      
      // Calculate days until renewal
      const now = new Date();
      const renewalDate = new Date(certInfo.renewalDate);
      const daysUntilRenewal = Math.floor((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilRenewal < 0) {
        console.log('\nCertificate renewal is OVERDUE!');
      } else if (daysUntilRenewal < 7) {
        console.log(`\nCertificate renewal is coming soon (${daysUntilRenewal} days).`);
      } else {
        console.log(`\nCertificate is valid. ${daysUntilRenewal} days until renewal.`);
      }
    } catch (error) {
      console.log('Certificate info file not found or invalid.');
    }
    
    // Check certificate details using OpenSSL
    console.log('\nDetailed Certificate Information:');
    await checkCertificateDetails(certPath);
    
    // Check certbot renewal status
    if (certInfo?.domain) {
      console.log('\nChecking Let\'s Encrypt renewal status...');
      await checkCertbotRenewalStatus(certInfo.domain);
    }
    
    // Offer to force renewal if needed
    if (certInfo?.domain) {
      await promptForForceRenewal(certInfo.domain, certDir);
    }
    
  } catch (error) {
    console.error('Error checking certificate status:', error);
    throw error;
  }
}

async function checkCertificateDetails(certPath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    exec(`openssl x509 -in "${certPath}" -text -noout | grep -E "Subject:|Issuer:|Not Before:|Not After:"`, (error, stdout, stderr) => {
      if (error && !stdout) {
        console.error('Error checking certificate details:', stderr || error);
        console.log('You may need to install OpenSSL to check certificate details.');
        resolve(); // Continue despite error
      } else {
        console.log(stdout);
        resolve();
      }
    });
  });
}

async function checkCertbotRenewalStatus(domain: string): Promise<void> {
  const isWindows = os.platform() === 'win32';
  
  return new Promise<void>((resolve, reject) => {
    const command = `${isWindows ? '' : 'sudo '}certbot certificates | grep -A2 "${domain}"`;
    
    exec(command, (error, stdout, stderr) => {
      if (error && !stdout) {
        console.log('Could not find Let\'s Encrypt registration for this domain.');
        console.log('The certificate may have been generated without Certbot or on another system.');
        resolve();
      } else {
        console.log('Let\'s Encrypt registration found:');
        console.log(stdout);
        resolve();
      }
    });
  });
}

async function promptForForceRenewal(domain: string, certDir: string): Promise<void> {
  return new Promise<void>((resolve) => {
    rl.question('\nDo you want to force certificate renewal now? (yes/no): ', async (answer) => {
      if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        console.log(`\nForcing renewal for ${domain}...`);
        await forceRenewal(domain, certDir);
      } else {
        console.log('No renewal requested.');
      }
      resolve();
    });
  });
}

async function forceRenewal(domain: string, certDir: string): Promise<void> {
  const isWindows = os.platform() === 'win32';
  
  return new Promise<void>((resolve, reject) => {
    const command = `${isWindows ? '' : 'sudo '}certbot renew --force-renewal --cert-name ${domain}`;
    
    console.log(`Executing command: ${command}`);
    exec(command, async (error, stdout, stderr) => {
      if (error) {
        console.error('Error forcing renewal:', stderr || error);
        resolve(); // Continue despite error
      } else {
        console.log(stdout);
        console.log('Certificate renewed successfully.');
        
        // Copy the new certificates to our application directory
        try {
          console.log('Copying renewed certificates to application directory...');
          
          const letsEncryptDir = isWindows
            ? path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'certbot', 'live', domain)
            : `/etc/letsencrypt/live/${domain}`;
          
          if (isWindows) {
            await copyWindowsCerts(
              path.join(letsEncryptDir, 'privkey.pem'),
              path.join(letsEncryptDir, 'fullchain.pem'),
              certDir
            );
          } else {
            await copyLinuxCerts(
              path.join(letsEncryptDir, 'privkey.pem'),
              path.join(letsEncryptDir, 'fullchain.pem'),
              certDir
            );
          }
          
          // Update certificate info file with new renewal date
          const infoFile = path.join(certDir, 'cert-info.json');
          try {
            const data = await fs.readFile(infoFile, 'utf8');
            const certInfo = JSON.parse(data) as CertificateInfo;
            certInfo.renewalDate = new Date(Date.now() + (90 * 24 * 60 * 60 * 1000)); // 90 days from now
            
            await fs.writeFile(infoFile, JSON.stringify(certInfo, null, 2), 'utf8');
            console.log('Certificate information updated with new renewal date.');
          } catch (error) {
            console.error('Error updating certificate info:', error);
          }
          
          console.log('Renewal and copy process completed.');
        } catch (copyError) {
          console.error('Error copying renewed certificates:', copyError);
        }
        
        resolve();
      }
    });
  });
}

async function copyWindowsCerts(privkeyPath: string, fullchainPath: string, destination: string): Promise<void> {
  const copyCommands = [
    `copy "${privkeyPath}" "${path.join(destination, 'key.pem')}"`,
    `copy "${fullchainPath}" "${path.join(destination, 'cert.pem')}"`,
  ];
  
  for (const command of copyCommands) {
    await new Promise<void>((resolve, reject) => {
      exec(command, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

async function copyLinuxCerts(privkeyPath: string, fullchainPath: string, destination: string): Promise<void> {
  const copyCommands = [
    `sudo cp "${privkeyPath}" "${path.join(destination, 'key.pem')}"`,
    `sudo cp "${fullchainPath}" "${path.join(destination, 'cert.pem')}"`,
    `sudo chmod 644 "${path.join(destination, '*.pem')}"`,
  ];
  
  for (const command of copyCommands) {
    await new Promise<void>((resolve, reject) => {
      exec(command, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

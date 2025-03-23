import { generateSSLCertificate } from './utils/ssl';
import { rl } from './utils/readline';

// Run SSL certificate generation directly
console.log('Starting Let\'s Encrypt certificate generation...');
generateSSLCertificate()
  .then(() => {
    console.log('\nSSL certificate generation process completed.');
    rl.close(); // Important: close the readline interface when done
    process.exit(0);
  })
  .catch(error => {
    console.error('\nError generating SSL certificate:', error);
    rl.close(); // Important: close the readline interface on error
    process.exit(1);
  });

import readline from 'readline';

// Create a singleton readline interface that can be shared across modules
export const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Close the readline interface when the application exits
process.on('SIGINT', () => {
  rl.close();
  process.exit(0);
});

process.on('exit', () => {
  rl.close();
});

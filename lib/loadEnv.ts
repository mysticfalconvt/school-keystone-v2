// Loads .env into process.env using Node's built-in loader (Node 20.12+),
// replacing the dotenv package. Import it for its side effect, first, in any
// entry point that reads configuration:
//
//   import './lib/loadEnv';
//
// As with dotenv, variables already set in the environment win over .env,
// and a missing .env is fine: production (Coolify) sets real environment
// variables and has no file.
try {
  process.loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

export {};

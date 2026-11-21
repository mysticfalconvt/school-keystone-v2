// Prisma 7 no longer reads the datasource URL from schema.prisma; Keystone 8
// runs `prisma db push` (keystone dev) with this file.
import './lib/loadEnv';
import { defineConfig } from 'prisma/config';
import { resolveDatabaseUrl } from './lib/databaseUrl';

export default defineConfig({
  schema: 'schema.prisma',
  datasource: {
    url: resolveDatabaseUrl(),
  },
});

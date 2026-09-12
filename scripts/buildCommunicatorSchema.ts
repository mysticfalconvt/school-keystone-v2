// Generates lib/communicator/schema.graphql from the schema Keystone generates.
//
//   npm run communicator:schema         write the contract
//   npm run communicator:schema:check   exit 1 if it is stale
//
// Run the check in CI. It fails when schema.graphql has moved and the contract
// has not been regenerated, which is how a newly added field gets noticed
// before it silently becomes visible - or invisible - to the model.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { buildApprovedSchema } from '../lib/communicator/buildApprovedSchema';

const ROOT = process.cwd();
const SOURCE = join(ROOT, 'schema.graphql');
const TARGET = join(ROOT, 'lib', 'communicator', 'schema.graphql');

const HEADER = `# GENERATED FILE - DO NOT EDIT
#
# Built from schema.graphql by scripts/buildCommunicatorSchema.ts, filtered
# through the allowlist in lib/communicator/approvedSchema.ts. This is the only
# schema the Communicator model is shown.
#
# To change what the model can see, edit approvedSchema.ts and regenerate.
`;

function main() {
  const check = process.argv.includes('--check');

  if (!existsSync(SOURCE)) {
    console.error(
      `Cannot find ${SOURCE}. Run \`npx keystone postinstall --fix\` first.`,
    );
    process.exit(1);
  }

  const generated = readFileSync(SOURCE, 'utf-8');
  const { sdl, excludedFields, staleAllowlistEntries } =
    buildApprovedSchema(generated);
  const output = `${HEADER}\n${sdl}\n`;

  if (staleAllowlistEntries.length) {
    console.error('Allowlist refers to things that no longer exist:');
    for (const e of staleAllowlistEntries) console.error(`  - ${e}`);
    console.error('Update lib/communicator/approvedSchema.ts.');
    process.exit(1);
  }

  if (check) {
    const current = existsSync(TARGET) ? readFileSync(TARGET, 'utf-8') : '';
    if (current !== output) {
      console.error(
        'The Communicator contract is out of date with schema.graphql.\n' +
          'Run: npm run communicator:schema\n' +
          'Then review the diff. A new field is excluded by default, so the ' +
          'question is whether it should be exposed at all and, if so, whether ' +
          'it needs a description explaining its semantics.',
      );
      process.exit(1);
    }
    console.log('Communicator contract is up to date.');
    console.log(`  ${excludedFields.length} field(s) excluded by the allowlist`);
    return;
  }

  writeFileSync(TARGET, output, 'utf-8');

  const beforeLines = generated.split('\n').length;
  const afterLines = output.split('\n').length;
  console.log(`Wrote ${TARGET}`);
  console.log(`  source:   ${beforeLines} lines`);
  console.log(`  contract: ${afterLines} lines`);
  console.log(`  excluded: ${excludedFields.length} field(s) on approved types`);
  for (const f of excludedFields.slice(0, 40)) console.log(`    - ${f}`);
  if (excludedFields.length > 40) {
    console.log(`    ... and ${excludedFields.length - 40} more`);
  }
}

main();

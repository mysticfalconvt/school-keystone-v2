// Tests for the Communicator's schema contract.
//
// This is the security boundary the migration took two attempts to get right:
// whatever ends up in lib/communicator/schema.graphql is the entire surface the
// model is told exists. Excluding an object type is not enough on its own,
// because Keystone's per-list input types can reach the same data through a
// filter, so most of what follows checks that the pruning closed over inputs
// and arguments as well as return types.
//
// Everything here is pure: it reads the checked-in schema.graphql and runs the
// builder. No database, no server.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';

import {
  buildSchema,
  Kind,
  parse,
  type DefinitionNode,
  type DocumentNode,
} from 'graphql';

import {
  APPROVED_ROOT_FIELDS,
  APPROVED_TYPES,
  FIELD_DESCRIPTIONS,
  USER_FIELD_DENY,
} from '../lib/communicator/approvedSchema';
import { buildApprovedSchema } from '../lib/communicator/buildApprovedSchema';

const ROOT = process.cwd();
const GENERATED_SDL = readFileSync(join(ROOT, 'schema.graphql'), 'utf-8');
const CHECKED_IN_CONTRACT = readFileSync(
  join(ROOT, 'lib', 'communicator', 'schema.graphql'),
  'utf-8',
);

const built = buildApprovedSchema(GENERATED_SDL);
const contract = parse(built.sdl);

function byName(doc: DocumentNode): Map<string, DefinitionNode> {
  const map = new Map<string, DefinitionNode>();
  for (const def of doc.definitions) {
    if ('name' in def && def.name) map.set(def.name.value, def);
  }
  return map;
}

const contractDefs = byName(contract);
const generatedDefs = byName(parse(GENERATED_SDL));

function fieldNames(typeName: string, defs = contractDefs): string[] {
  const def: any = defs.get(typeName);
  if (!def) return [];
  return (def.fields ?? []).map((f: any) => f.name.value);
}

/**
 * The lists Keystone generated inputs for, derived the same way the builder
 * derives them, so "unapproved list" here means whatever is actually in the
 * schema rather than a hand-maintained second copy of the exclusion list.
 */
function listNamesIn(defs: Map<string, DefinitionNode>): Set<string> {
  const names = new Set<string>();
  for (const name of defs.keys()) {
    if (!name.endsWith('WhereInput')) continue;
    const owner = name.slice(0, -'WhereInput'.length);
    if (defs.has(owner)) names.add(owner);
  }
  return names;
}

const INPUT_SUFFIXES = [
  'WhereInput',
  'WhereUniqueInput',
  'OrderByInput',
  'ManyRelationFilter',
  'RelateToManyForCreateInput',
  'RelateToManyForUpdateInput',
  'RelateToOneForCreateInput',
  'RelateToOneForUpdateInput',
  'CreateInput',
  'UpdateInput',
  'UpdateArgs',
];

function ownerListOf(typeName: string, listNames: Set<string>): string | null {
  for (const suffix of INPUT_SUFFIXES) {
    if (typeName.endsWith(suffix)) {
      const owner = typeName.slice(0, -suffix.length);
      if (listNames.has(owner)) return owner;
    }
  }
  return null;
}

describe('the generated contract', () => {
  test('is a schema graphql itself accepts', () => {
    // buildSchema validates that every type referenced by a kept field or
    // argument is also present. If the closure in pass 3 missed an enum, scalar
    // or input, this is where it shows up - and a contract with a dangling
    // reference would fail at the model's first query, not at build time.
    assert.doesNotThrow(() => buildSchema(built.sdl));
  });

  test('matches the checked-in lib/communicator/schema.graphql', () => {
    // The same drift the communicator:schema:check script guards, asserted here
    // so a schema change that nobody regenerated fails the suite too.
    assert.ok(
      CHECKED_IN_CONTRACT.includes(built.sdl),
      'lib/communicator/schema.graphql is stale. Run: npm run communicator:schema',
    );
  });

  test('names nothing the allowlist has outlived', () => {
    assert.deepEqual(built.staleAllowlistEntries, []);
  });

  test('exposes no mutations', () => {
    assert.ok(!contractDefs.has('Mutation'));
    // Keystone's mutation inputs are the other half of this: a CreateInput for
    // an approved list would be harmless on its own, but it signals the
    // mutation surface leaked in.
    for (const name of contractDefs.keys()) {
      assert.ok(
        !name.endsWith('CreateInput') && !name.endsWith('UpdateArgs'),
        `${name} is a mutation input and should not be in the contract`,
      );
    }
  });

  test('offers exactly the approved root fields', () => {
    assert.deepEqual(
      [...fieldNames('Query')].sort(),
      [...APPROVED_ROOT_FIELDS].sort(),
    );
  });

  test('emits no object type outside the allowlist', () => {
    const objectTypes = contract.definitions
      .filter((d) => d.kind === Kind.OBJECT_TYPE_DEFINITION)
      .map((d: any) => d.name.value);

    assert.deepEqual(
      objectTypes.filter((n) => n !== 'Query' && !APPROVED_TYPES.includes(n)),
      [],
    );
  });
});

describe('User field exclusions', () => {
  test('drops every denied field from the User type', () => {
    const present = fieldNames('User');
    const leaked = USER_FIELD_DENY.filter((f) => present.includes(f));
    assert.deepEqual(leaked, []);
  });

  test('drops every denied field from User inputs too', () => {
    // A field removed from the output type but left on UserWhereInput is still
    // a read: filtering users by canManageCommunicator tells you who has it.
    for (const suffix of ['WhereInput', 'OrderByInput', 'UpdateInput']) {
      const present = fieldNames(`User${suffix}`);
      const leaked = USER_FIELD_DENY.filter((f) => present.includes(f));
      assert.deepEqual(leaked, [], `User${suffix} still exposes ${leaked}`);
    }
  });

  test('keeps the flags questions actually turn on', () => {
    const present = fieldNames('User');
    for (const kept of [
      'isStaff',
      'isStudent',
      'isTeacher',
      'isParent',
      'isSuperAdmin',
      'isGuidance',
      'hasTA',
      'hasClasses',
    ]) {
      assert.ok(present.includes(kept), `User.${kept} should be exposed`);
    }
  });

  test('denies only field names the schema actually has', () => {
    // The two tests above iterate USER_FIELD_DENY, so a name deleted from it
    // cannot fail them, and a name that was never a real field sits there
    // looking like protection while doing nothing. This is the direction that
    // catches both: every entry must correspond to a field on the generated
    // User type.
    const generated = fieldNames('User', generatedDefs);
    const dead = USER_FIELD_DENY.filter((f) => !generated.includes(f));
    assert.deepEqual(
      dead,
      [],
      'USER_FIELD_DENY names fields that do not exist on User',
    );
  });

  test('hides every capability flag, whatever the deny list says', () => {
    // Derived from the schema rather than from the allowlist, so this keeps
    // holding when someone adds a new canSomething permission - and it is the
    // one class of field the type-level rules cannot catch, because permission
    // flags are Booleans and so survive every return-type and argument check.
    const flags = fieldNames('User', generatedDefs).filter(
      (f) => /^can[A-Z]/.test(f) || f === 'isCommunicatorEnabled',
    );
    assert.ok(flags.length > 0, 'expected the schema to have capability flags');

    for (const scope of ['User', 'UserWhereInput', 'UserOrderByInput']) {
      const present = fieldNames(scope);
      const leaked = flags.filter((f) => present.includes(f));
      assert.deepEqual(leaked, [], `${scope} exposes ${leaked}`);
    }
  });

  test('never exposes password or token material', () => {
    // The blunt version of the above, kept separate because this is the one
    // that must not regress no matter how the allowlist is refactored.
    for (const secret of [
      'password',
      'passwordResetToken',
      'magicAuthToken',
    ]) {
      assert.ok(
        !built.sdl.includes(secret),
        `${secret} appears somewhere in the contract`,
      );
    }
  });
});

describe('unapproved lists', () => {
  const generatedLists = listNamesIn(generatedDefs);
  const unapproved = [...generatedLists].filter(
    (l) => !APPROVED_TYPES.includes(l),
  );

  test('the schema really does contain lists we exclude', () => {
    // Guards the two tests below from passing vacuously if the derivation of
    // list names ever stops matching Keystone's naming.
    assert.ok(unapproved.length > 0);
    for (const expected of ['Discipline', 'Message', 'CommunicatorChat']) {
      assert.ok(
        unapproved.includes(expected),
        `${expected} should be an unapproved list`,
      );
    }
  });

  test('contributes no input type to the contract', () => {
    const contractLists = listNamesIn(contractDefs);
    const leaked: string[] = [];
    for (const name of contractDefs.keys()) {
      const owner =
        ownerListOf(name, generatedLists) ?? ownerListOf(name, contractLists);
      if (owner && !APPROVED_TYPES.includes(owner)) leaked.push(name);
    }
    assert.deepEqual(leaked, []);
  });

  test('is unreachable through any argument on an approved type', () => {
    // The relation-count fields are the trap: studentFocusStudentCount returns
    // Int, so a return-type check alone lets it through, but its where argument
    // reaches an excluded list.
    for (const typeName of APPROVED_TYPES) {
      const def: any = contractDefs.get(typeName);
      if (!def) continue;
      for (const field of def.fields ?? []) {
        for (const arg of field.arguments ?? []) {
          let t = arg.type;
          while (t.kind !== Kind.NAMED_TYPE) t = t.type;
          const owner = ownerListOf(t.name.value, generatedLists);
          assert.ok(
            !owner || APPROVED_TYPES.includes(owner),
            `${typeName}.${field.name.value} takes ${t.name.value}, which reaches ${owner}`,
          );
        }
      }
    }
  });
});

describe('field descriptions', () => {
  test('are attached to the fields that survived pruning', () => {
    for (const [typeName, fields] of Object.entries(FIELD_DESCRIPTIONS)) {
      const def: any = contractDefs.get(typeName);
      assert.ok(def, `${typeName} should be in the contract`);
      for (const [fieldName, text] of Object.entries(fields)) {
        const field = (def.fields ?? []).find(
          (f: any) => f.name.value === fieldName,
        );
        assert.ok(
          field,
          `${typeName}.${fieldName} has a description but is not in the contract`,
        );
        assert.equal(field.description?.value, text);
      }
    }
  });
});

// The tests above describe the schema as it stands today, which means they
// drift with it. These drive the algorithm directly with a hand-written source
// schema, so they pin the pruning rules themselves.
describe('the pruning rules', () => {
  const SOURCE = /* GraphQL */ `
    type Query {
      users(where: UserWhereInput): [User!]!
      disciplines(where: DisciplineWhereInput): [Discipline!]!
    }

    type User {
      id: ID!
      name: String
      password: String
      isStaff: Boolean
      taStudents: [User!]
      studentDiscipline(where: DisciplineWhereInput): [Discipline!]
      studentFocusStudentCount(where: StudentFocusWhereInput): Int
    }

    type Discipline {
      id: ID!
      note: String
    }

    type StudentFocus {
      id: ID!
      comments: String
    }

    input UserWhereInput {
      id: IDFilter
      name: StringFilter
      studentDiscipline: DisciplineManyRelationFilter
    }

    input DisciplineWhereInput {
      id: IDFilter
    }

    input StudentFocusWhereInput {
      id: IDFilter
    }

    input DisciplineManyRelationFilter {
      every: DisciplineWhereInput
    }

    input IDFilter {
      equals: ID
    }

    input StringFilter {
      equals: String
    }
  `;

  const result = buildApprovedSchema(SOURCE);
  const defs = byName(parse(result.sdl));
  const names = (typeName: string) => fieldNames(typeName, defs);

  test('keeps approved root fields and drops the rest', () => {
    assert.deepEqual(names('Query'), ['users']);
  });

  test('drops a denied field from an approved type', () => {
    assert.ok(!names('User').includes('password'));
    assert.ok(result.excludedFields.includes('User.password'));
  });

  test('keeps a field whose type is approved', () => {
    assert.ok(names('User').includes('taStudents'));
    assert.ok(names('User').includes('isStaff'));
  });

  test('drops a field returning an unapproved type', () => {
    assert.ok(!names('User').includes('studentDiscipline'));
    assert.ok(!defs.has('Discipline'));
  });

  test('drops a scalar field whose argument reaches an unapproved list', () => {
    // Returns Int, so only the argument gives it away.
    assert.ok(!names('User').includes('studentFocusStudentCount'));
    assert.ok(
      result.excludedFields.some((f) =>
        f.startsWith('User.studentFocusStudentCount (arg ->'),
      ),
      `expected an arg exclusion, got ${JSON.stringify(result.excludedFields)}`,
    );
  });

  test('strips an input field that filters through an unapproved list', () => {
    assert.deepEqual(names('UserWhereInput').sort(), ['id', 'name']);
    assert.ok(!defs.has('DisciplineManyRelationFilter'));
    assert.ok(!defs.has('DisciplineWhereInput'));
    assert.ok(!defs.has('StudentFocusWhereInput'));
  });

  test('leaves the pruned result internally consistent', () => {
    assert.doesNotThrow(() => buildSchema(result.sdl));
  });

  test('reports allowlist entries the source does not have', () => {
    // This source has no PbisCard, so the allowlist entry for it is stale - the
    // signal that tells you to update approvedSchema.ts rather than silently
    // shipping a smaller contract.
    assert.ok(result.staleAllowlistEntries.includes('type PbisCard'));
    assert.ok(result.staleAllowlistEntries.includes('Query.pbisCards'));
  });
});

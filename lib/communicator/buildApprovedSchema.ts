// Derives the Communicator's query contract from the schema Keystone generates.
//
// Everything here is subtractive: parse the real schema, keep only what the
// allowlist names, prune whatever is left dangling, then print it back out. A
// field that appears in the lists but not in the allowlist simply does not
// reach the model, and `check` reports it so somebody decides on purpose.
import {
  parse,
  print,
  Kind,
  type DocumentNode,
  type DefinitionNode,
  type TypeNode,
} from 'graphql';
import {
  APPROVED_ROOT_FIELDS,
  APPROVED_TYPES,
  USER_FIELD_DENY,
  FIELD_DESCRIPTIONS,
} from './approvedSchema';

const BUILTIN_SCALARS = new Set([
  'String',
  'Int',
  'Float',
  'Boolean',
  'ID',
]);

function namedType(type: TypeNode): string {
  let t: TypeNode = type;
  while (t.kind === Kind.NON_NULL_TYPE || t.kind === Kind.LIST_TYPE) {
    t = t.type;
  }
  return t.name.value;
}

function isFieldAllowed(typeName: string, fieldName: string): boolean {
  if (typeName === 'User') return !USER_FIELD_DENY.includes(fieldName);
  return true;
}

// Keystone derives a family of input types per list. Excluding an object type
// is not enough on its own: UserWhereInput still references
// DisciplineManyRelationFilter, so without this the model could filter users by
// discipline records, private messages or chat history it cannot read. Being
// able to filter on a field is enough to reveal who it applies to.
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

/** The list an input type belongs to, if it is one of Keystone's per-list inputs. */
function ownerListOf(typeName: string, listNames: Set<string>): string | null {
  for (const suffix of INPUT_SUFFIXES) {
    if (typeName.endsWith(suffix)) {
      const owner = typeName.slice(0, -suffix.length);
      if (listNames.has(owner)) return owner;
    }
  }
  return null;
}

function withDescription(
  typeName: string,
  field: any,
): any {
  const text = FIELD_DESCRIPTIONS[typeName]?.[field.name.value];
  if (!text) return field;
  return {
    ...field,
    description: { kind: Kind.STRING, value: text, block: true },
  };
}

export interface BuildResult {
  sdl: string;
  /** Fields present on approved types that the allowlist excludes. */
  excludedFields: string[];
  /** Allowlist entries that no longer exist in the generated schema. */
  staleAllowlistEntries: string[];
}

export function buildApprovedSchema(generatedSdl: string): BuildResult {
  const doc = parse(generatedSdl);

  const approvedTypes = new Set(APPROVED_TYPES);
  const approvedRoots = new Set(APPROVED_ROOT_FIELDS);
  const excludedFields: string[] = [];
  const staleAllowlistEntries: string[] = [];

  const definitionsByName = new Map<string, DefinitionNode>();
  for (const def of doc.definitions) {
    if ('name' in def && def.name) {
      definitionsByName.set(def.name.value, def);
    }
  }

  for (const t of APPROVED_TYPES) {
    if (!definitionsByName.has(t)) staleAllowlistEntries.push(`type ${t}`);
  }

  // Every list Keystone generated inputs for, so per-list inputs belonging to
  // unapproved lists can be refused by name.
  const listNames = new Set<string>();
  for (const name of definitionsByName.keys()) {
    if (name.endsWith('WhereInput')) {
      const owner = name.slice(0, -'WhereInput'.length);
      if (definitionsByName.has(owner)) listNames.add(owner);
    }
  }

  const isDeniedType = (name: string): boolean => {
    const def = definitionsByName.get(name);
    if (!def) return false;
    if (def.kind === Kind.OBJECT_TYPE_DEFINITION) {
      return !approvedTypes.has(name);
    }
    const owner = ownerListOf(name, listNames);
    return owner !== null && !approvedTypes.has(owner);
  };

  // Fields on an input that point at a denied type, or that name a denied User
  // field, are stripped before the input is emitted.
  const cleanInputFields = (def: any): any[] =>
    (def.fields ?? []).filter((f: any) => {
      const owner = ownerListOf(def.name.value, listNames);
      if (owner === 'User' && USER_FIELD_DENY.includes(f.name.value)) {
        excludedFields.push(`${def.name.value}.${f.name.value}`);
        return false;
      }
      const rt = namedType(f.type);
      if (BUILTIN_SCALARS.has(rt)) return true;
      if (!definitionsByName.has(rt)) return false;
      if (isDeniedType(rt)) {
        excludedFields.push(`${def.name.value}.${f.name.value} (-> ${rt})`);
        return false;
      }
      return true;
    });

  // Pass 1: the Query root, reduced to approved entry points whose return type
  // is itself approved.
  const queryDef: any = definitionsByName.get('Query');
  if (!queryDef) throw new Error('Generated schema has no Query type');

  const keptRootFields = queryDef.fields.filter((f: any) => {
    if (!approvedRoots.has(f.name.value)) return false;
    const rt = namedType(f.type);
    if (approvedTypes.has(rt) || BUILTIN_SCALARS.has(rt)) return true;
    // authenticatedItem returns a union in some setups; keep it if resolvable.
    return definitionsByName.has(rt);
  });

  for (const name of APPROVED_ROOT_FIELDS) {
    if (!queryDef.fields.some((f: any) => f.name.value === name)) {
      staleAllowlistEntries.push(`Query.${name}`);
    }
  }

  // Pass 2: approved object types, with denied fields removed and fields whose
  // type is not approved removed with them.
  const keptTypeDefs: any[] = [];
  for (const typeName of APPROVED_TYPES) {
    const def: any = definitionsByName.get(typeName);
    if (!def || def.kind !== Kind.OBJECT_TYPE_DEFINITION) continue;

    const fields = def.fields.filter((f: any) => {
      const fieldName = f.name.value;
      if (!isFieldAllowed(typeName, fieldName)) {
        excludedFields.push(`${typeName}.${fieldName}`);
        return false;
      }
      // A field's arguments matter as much as its return type. The relation
      // counts (studentFocusStudentCount and friends) return Int but take a
      // where-input for an excluded list, so filtering through them would
      // reach the very data the exclusion is for.
      for (const arg of f.arguments ?? []) {
        const at = namedType(arg.type);
        if (!BUILTIN_SCALARS.has(at) && isDeniedType(at)) {
          excludedFields.push(`${typeName}.${fieldName} (arg -> ${at})`);
          return false;
        }
      }

      const rt = namedType(f.type);
      if (BUILTIN_SCALARS.has(rt)) return true;
      const rtDef = definitionsByName.get(rt);
      if (!rtDef) return false;
      // Object types must be approved; scalars and enums ride along.
      if (rtDef.kind === Kind.OBJECT_TYPE_DEFINITION) {
        if (!approvedTypes.has(rt)) {
          excludedFields.push(`${typeName}.${fieldName} (-> ${rt})`);
          return false;
        }
      }
      return true;
    });

    keptTypeDefs.push({
      ...def,
      fields: fields.map((f: any) => withDescription(typeName, f)),
    });
  }

  // Pass 3: close over every input, enum and scalar still referenced, following
  // argument and field types until nothing new appears.
  const needed = new Set<string>();
  const queue: any[] = [
    { ...queryDef, fields: keptRootFields },
    ...keptTypeDefs,
  ];

  const want = (name: string) => {
    if (BUILTIN_SCALARS.has(name)) return;
    if (isDeniedType(name)) return; // never follow an excluded domain
    needed.add(name);
  };

  const visit = (def: any) => {
    // Inputs are traversed through their cleaned field set, so a stripped
    // field cannot drag its type back in.
    const fields =
      def.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION
        ? cleanInputFields(def)
        : (def.fields ?? []);
    for (const f of fields) {
      want(namedType(f.type));
      for (const arg of f.arguments ?? []) want(namedType(arg.type));
    }
    for (const t of def.types ?? []) want(t.name.value);
  };

  queue.forEach(visit);

  let changed = true;
  while (changed) {
    changed = false;
    for (const name of Array.from(needed)) {
      const def: any = definitionsByName.get(name);
      if (!def) continue;
      if (
        def.kind === Kind.OBJECT_TYPE_DEFINITION &&
        !approvedTypes.has(name)
      ) {
        continue;
      }
      const before = needed.size;
      visit(def);
      if (needed.size !== before) changed = true;
    }
  }

  // Pass 4: emit. Object types come from the pruned copies; inputs, enums and
  // scalars come through untouched. Mutations never enter the queue at all.
  const out: any[] = [{ ...queryDef, fields: keptRootFields }, ...keptTypeDefs];
  const emitted = new Set(['Query', ...APPROVED_TYPES]);

  for (const name of Array.from(needed).sort()) {
    if (emitted.has(name) || BUILTIN_SCALARS.has(name)) continue;
    const def: any = definitionsByName.get(name);
    if (!def) continue;
    if (def.kind === Kind.OBJECT_TYPE_DEFINITION) continue; // unapproved object
    if (
      def.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION ||
      def.kind === Kind.ENUM_TYPE_DEFINITION ||
      def.kind === Kind.SCALAR_TYPE_DEFINITION ||
      def.kind === Kind.UNION_TYPE_DEFINITION
    ) {
      out.push(def);
      emitted.add(name);
    }
  }

  // Emit inputs through the same cleaning used during traversal, so what is
  // printed matches what the closure actually followed.
  const cleaned = out.map((def: any) =>
    def.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION
      ? { ...def, fields: cleanInputFields(def) }
      : def,
  );

  const docOut: DocumentNode = {
    kind: Kind.DOCUMENT,
    definitions: cleaned as any,
  };

  return {
    sdl: print(docOut),
    excludedFields,
    staleAllowlistEntries,
  };
}

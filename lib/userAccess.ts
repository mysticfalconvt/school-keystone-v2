// Who may create, change and delete User records.
//
// - Super admins, and server-to-server calls carrying AUTH_HEADER_SECRET, may
//   do anything.
// - Staff may create and edit users, but may not grant or remove roles and
//   permissions (other than marking someone a student or parent), and may not
//   change the email of another staff member or super admin: sign-in links go
//   to that address, so changing it would hand over the account.
// - Everyone else (students, parents) may only change their own sorting-hat
//   house.
// - Only super admins may delete users.

import { permissionFields } from '../schemas/fields';

type Level = 'admin' | 'staff' | 'self' | 'none';

type AccessArgs = {
  session?: any;
  context?: any;
};

/** Role and permission flags staff may set on a user they create or edit. */
const STAFF_SETTABLE_FLAGS = new Set(['isStudent', 'isParent']);

/** Fields only a super admin may write. */
export const PRIVILEGED_FIELDS: ReadonlySet<string> = new Set(
  Object.keys(permissionFields).filter((key) => !STAFF_SETTABLE_FLAGS.has(key)),
);

/** Fields that would hand over another account if changed. */
export const CREDENTIAL_FIELDS: ReadonlySet<string> = new Set(['email']);

/** What a student or parent may change on their own record. */
export const SELF_EDITABLE_FIELDS: ReadonlySet<string> = new Set([
  'sortingHat',
]);

export function hasServiceHeader(context: any): boolean {
  const secret = process.env.AUTH_HEADER_SECRET;
  if (!secret) return false;
  return Boolean(context?.req?.rawHeaders?.includes(secret));
}

export function accessLevel({ session, context }: AccessArgs): Level {
  if (session?.data?.isSuperAdmin) return 'admin';
  if (hasServiceHeader(context)) return 'admin';
  if (session?.data?.isStaff) return 'staff';
  if (session?.itemId) return 'self';
  return 'none';
}

const touches = (inputData: Record<string, unknown>, fields: ReadonlySet<string>) =>
  Object.keys(inputData ?? {}).some((key) => fields.has(key));

const isPrivilegedAccount = (item: any) =>
  Boolean(item?.isSuperAdmin || item?.isStaff);

export function canCreateUser(args: AccessArgs) {
  const level = accessLevel(args);
  return level === 'admin' || level === 'staff';
}

export function canDeleteUser(args: AccessArgs) {
  return accessLevel(args) === 'admin';
}

/** Narrows updateUser/updateUsers to the records this session may touch. */
export function userUpdateFilter(args: AccessArgs) {
  const level = accessLevel(args);
  if (level === 'admin' || level === 'staff') return true;
  if (level === 'self') return { id: { equals: String(args.session.itemId) } };
  return false;
}

export function canCreateUserItem(
  args: AccessArgs & { inputData: Record<string, unknown> },
) {
  const level = accessLevel(args);
  if (level === 'admin') return true;
  if (level === 'staff') return !touches(args.inputData, PRIVILEGED_FIELDS);
  return false;
}

export function canUpdateUserItem(
  args: AccessArgs & { item: any; inputData: Record<string, unknown> },
) {
  const { session, item, inputData } = args;
  const level = accessLevel(args);
  const isSelf = Boolean(session?.itemId) && String(item?.id) === String(session.itemId);

  if (level === 'admin') return true;
  if (level === 'staff') {
    if (touches(inputData, PRIVILEGED_FIELDS)) return false;
    if (!isSelf && isPrivilegedAccount(item) && touches(inputData, CREDENTIAL_FIELDS)) {
      return false;
    }
    return true;
  }
  if (level === 'self') {
    return (
      isSelf &&
      Object.keys(inputData ?? {}).every((key) => SELF_EDITABLE_FIELDS.has(key))
    );
  }
  return false;
}

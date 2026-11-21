import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  accessLevel,
  canCreateUser,
  canCreateUserItem,
  canDeleteUser,
  canUpdateUserItem,
  userUpdateFilter,
} from '../lib/userAccess';

const session = (id: string, data: Record<string, unknown> = {}) => ({
  itemId: id,
  data,
});
const admin = session('admin', { isSuperAdmin: true });
const staff = session('staff', { isStaff: true });
const student = session('student', { isStudent: true });
const parent = session('parent', { isParent: true });

const studentItem = { id: 'student', isStudent: true };
const otherStudent = { id: 'other', isStudent: true };
const staffItem = { id: 'staff', isStaff: true };
const otherStaff = { id: 'teacher2', isStaff: true };
const adminItem = { id: 'admin', isSuperAdmin: true, isStaff: true };

const update = (s: any, item: any, inputData: Record<string, unknown>) =>
  canUpdateUserItem({ session: s, item, inputData });

describe('user access levels', () => {
  test('levels', () => {
    assert.equal(accessLevel({ session: admin }), 'admin');
    assert.equal(accessLevel({ session: staff }), 'staff');
    assert.equal(accessLevel({ session: student }), 'self');
    assert.equal(accessLevel({}), 'none');
  });

  test('the service header counts as admin only when it matches', () => {
    const previous = process.env.AUTH_HEADER_SECRET;
    process.env.AUTH_HEADER_SECRET = 'service-secret';
    try {
      const ctx = (value: string) => ({ req: { rawHeaders: ['authorization', value] } });
      assert.equal(accessLevel({ context: ctx('service-secret') }), 'admin');
      assert.equal(accessLevel({ context: ctx('guess') }), 'none');
      delete process.env.AUTH_HEADER_SECRET;
      assert.equal(accessLevel({ context: ctx('service-secret') }), 'none');
    } finally {
      if (previous === undefined) delete process.env.AUTH_HEADER_SECRET;
      else process.env.AUTH_HEADER_SECRET = previous;
    }
  });
});

describe('students and parents', () => {
  test('cannot grant themselves roles', () => {
    assert.equal(update(student, studentItem, { isSuperAdmin: true }), false);
    assert.equal(update(student, studentItem, { canManageUsers: true }), false);
    assert.equal(update(student, studentItem, { isStaff: true }), false);
  });

  test('may change their own password and house, and nothing else', () => {
    assert.equal(update(student, studentItem, { password: 'new-pass-123' }), true);
    assert.equal(update(student, studentItem, { sortingHat: 'gryffindor' }), true);
    assert.equal(update(student, studentItem, { name: 'Someone Else' }), false);
    assert.equal(update(student, studentItem, { email: 'x@example.test' }), false);
    assert.equal(update(student, studentItem, { taTeacher: { connect: { id: 'x' } } }), false);
  });

  test('cannot touch anyone else', () => {
    assert.equal(update(student, otherStudent, { password: 'x' }), false);
    assert.equal(update(parent, adminItem, { password: 'x' }), false);
    assert.deepEqual(userUpdateFilter({ session: student }), { id: { equals: 'student' } });
  });

  test('cannot create or delete users', () => {
    assert.equal(canCreateUser({ session: parent }), false);
    assert.equal(canDeleteUser({ session: student }), false);
  });

  test('signed-out requests get nothing', () => {
    assert.equal(userUpdateFilter({}), false);
    assert.equal(update(undefined, studentItem, { sortingHat: 'x' }), false);
  });
});

describe('staff', () => {
  test('may edit students and parents, including credentials', () => {
    assert.equal(userUpdateFilter({ session: staff }), true);
    assert.equal(update(staff, studentItem, { name: 'New Name', taTeacher: { connect: { id: 'staff' } } }), true);
    assert.equal(update(staff, studentItem, { password: 'reset-123' }), true);
    assert.equal(update(staff, otherStudent, { parent: { connect: [{ id: 'p' }] } }), true);
  });

  test('may mark users as parents or students', () => {
    assert.equal(update(staff, otherStudent, { isParent: true, children: { connect: { id: 's' } } }), true);
    assert.equal(canCreateUserItem({ session: staff, inputData: { name: 'P', isParent: true } }), true);
  });

  test('may update other staff records, e.g. PBIS levels', () => {
    assert.equal(update(staff, otherStaff, { taTeamPbisLevel: 3 }), true);
    assert.equal(update(staff, otherStaff, { specialGroupStudents: { connect: { id: 's' } } }), true);
  });

  test('may change their own credentials', () => {
    assert.equal(update(staff, staffItem, { password: 'mine-123' }), true);
  });

  test("cannot take over another staff member's or admin's account", () => {
    assert.equal(update(staff, otherStaff, { password: 'x' }), false);
    assert.equal(update(staff, adminItem, { email: 'mine@example.test' }), false);
  });

  test('cannot grant roles or permissions', () => {
    assert.equal(update(staff, staffItem, { isSuperAdmin: true }), false);
    assert.equal(update(staff, otherStudent, { canManageUsers: true }), false);
    assert.equal(update(staff, otherStudent, { isStaff: true }), false);
    assert.equal(canCreateUserItem({ session: staff, inputData: { name: 'X', isSuperAdmin: true } }), false);
  });

  test('may create but not delete users', () => {
    assert.equal(canCreateUser({ session: staff }), true);
    assert.equal(canDeleteUser({ session: staff }), false);
  });
});

describe('super admins', () => {
  test('may do anything', () => {
    assert.equal(update(admin, otherStaff, { password: 'x', isSuperAdmin: true }), true);
    assert.equal(canCreateUserItem({ session: admin, inputData: { isStaff: true, canManagePbis: true } }), true);
    assert.equal(canDeleteUser({ session: admin }), true);
  });
});

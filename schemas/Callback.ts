import { list } from '@keystone-6/core';
import {
  integer,
  relationship,
  text,
  timestamp,
} from '@keystone-6/core/fields';
import { isSignedIn } from '../access';
import { ListAccessArgs } from '../types';

// Access control for Callback items
function callbackAccess({ session, context, itemId }: ListAccessArgs) {
  // Check if user is signed in first
  if (!isSignedIn({ session, context, itemId })) {
    return false;
  }

  // If user has canSeeAllCallback permission, only allow read access
  if ((session?.data as any)?.canSeeAllCallback) {
    return true; // This will be handled by the operation-specific logic below
  }

  // If no itemId is provided, this is a list query - allow access but filter will be applied
  if (!itemId) {
    return true;
  }

  // For individual item operations, check if user is the student or teacher
  if (!session?.itemId) {
    return false;
  }

  // Get the callback item to check relationships
  if (!context) return false;

  return context
    .sudo()
    .query.Callback.findOne({
      where: { id: itemId },
      query: `
        id
        student {
          id
          taTeacher { id }
          block1Teacher { id }
          block2Teacher { id }
          block3Teacher { id }
          block4Teacher { id }
          block5Teacher { id }
          block6Teacher { id }
          block7Teacher { id }
          block8Teacher { id }
          block9Teacher { id }
          block10Teacher { id }
        }
        teacher { id }
      `,
    })
    .then((callback: any) => {
      if (!callback) return false;

      const userId = session.itemId;
      const isStudent = callback.student?.id === userId;
      const isTeacher = callback.teacher?.id === userId;
      const isTaTeacher = callback.student?.taTeacher?.id === userId;

      // Check if user is a staff member who teaches the student in any block
      const isStaffTeacher =
        session.data?.isStaff &&
        callback.student &&
        (callback.student.block1Teacher?.id === userId ||
          callback.student.block2Teacher?.id === userId ||
          callback.student.block3Teacher?.id === userId ||
          callback.student.block4Teacher?.id === userId ||
          callback.student.block5Teacher?.id === userId ||
          callback.student.block6Teacher?.id === userId ||
          callback.student.block7Teacher?.id === userId ||
          callback.student.block8Teacher?.id === userId ||
          callback.student.block9Teacher?.id === userId ||
          callback.student.block10Teacher?.id === userId);

      return isStudent || isTeacher || isTaTeacher || isStaffTeacher;
    });
}

// Filter function to restrict list queries to user's own items
function callbackFilter({ session, context }: ListAccessArgs) {
  if (!session?.itemId) {
    return false;
  }

  // If user has canSeeAllCallback permission, show all callbacks
  if ((session?.data as any)?.canSeeAllCallback) {
    return true;
  }

  const userId = session.itemId;
  const isStaff = session.data?.isStaff;

  // Base filter for student and teacher relationships
  const baseFilter = {
    OR: [
      { student: { id: { equals: userId } } },
      { teacher: { id: { equals: userId } } },
      { student: { taTeacher: { id: { equals: userId } } } },
    ],
  };

  // If user is staff, also include callbacks for students they teach
  if (isStaff) {
    return {
      OR: [
        ...baseFilter.OR,
        { student: { block1Teacher: { id: { equals: userId } } } },
        { student: { block2Teacher: { id: { equals: userId } } } },
        { student: { block3Teacher: { id: { equals: userId } } } },
        { student: { block4Teacher: { id: { equals: userId } } } },
        { student: { block5Teacher: { id: { equals: userId } } } },
        { student: { block6Teacher: { id: { equals: userId } } } },
        { student: { block7Teacher: { id: { equals: userId } } } },
        { student: { block8Teacher: { id: { equals: userId } } } },
        { student: { block9Teacher: { id: { equals: userId } } } },
        { student: { block10Teacher: { id: { equals: userId } } } },
      ],
    };
  }

  return baseFilter;
}

export const Callback = list({
  access: {
    operation: {
      query: callbackAccess,
      create: ({ session, context, itemId }: ListAccessArgs) => {
        // Users with canSeeAllCallback can only read, not create
        if ((session?.data as any)?.canSeeAllCallback) {
          return false;
        }
        return callbackAccess({ session, context, itemId });
      },
      delete: ({ session, context, itemId }: ListAccessArgs) => {
        // Users with canSeeAllCallback can only read, not delete
        if ((session?.data as any)?.canSeeAllCallback) {
          return false;
        }
        return callbackAccess({ session, context, itemId });
      },
      update: ({ session, context, itemId }: ListAccessArgs) => {
        // Users with canSeeAllCallback can only read, not update
        if ((session?.data as any)?.canSeeAllCallback) {
          return false;
        }
        return callbackAccess({ session, context, itemId });
      },
    },
    filter: {
      query: callbackFilter,
    },
  },
  ui: {
    listView: {
      initialColumns: ['dateAssigned', 'teacher', 'student', 'title'],
      initialSort: { field: 'dateAssigned', direction: 'ASC' },
      pageSize: 100,
    },
  },
  fields: {
    title: text(),
    description: text({
      ui: {
        displayMode: 'textarea',
      },
    }),
    // category: text(),
    student: relationship({
      ref: 'User.callbackItems',
    }),
    teacher: relationship({
      ref: 'User.callbackAssigned',
    }),

    dateAssigned: timestamp({
      validation: { isRequired: true },
      defaultValue: { kind: 'now' },
    }),
    dateCompleted: timestamp({
      isIndexed: true,
    }),
    link: text(),
    messageFromTeacher: text(),
    messageFromTeacherDate: text(),
    messageFromStudent: text(),
    messageFromStudentDate: text(),
    daysLate: integer(),
  },
});

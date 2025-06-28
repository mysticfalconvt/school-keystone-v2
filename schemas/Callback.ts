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

  // If no itemId is provided, this is a list query - allow access but filter will be applied
  if (!itemId) {
    return true;
  }

  // For individual item operations, check if user is the student or teacher
  if (!session?.itemId) {
    return false;
  }

  // Get the callback item to check relationships
  return context
    .sudo()
    .db.Callback.findUnique({
      where: { id: itemId },
      select: {
        student: { select: { id: true } },
        teacher: { select: { id: true } },
      },
    })
    .then((callback: any) => {
      if (!callback) return false;

      const userId = session.itemId;
      const isStudent = callback.student?.id === userId;
      const isTeacher = callback.teacher?.id === userId;

      return isStudent || isTeacher;
    });
}

// Filter function to restrict list queries to user's own items
function callbackFilter({ session, context }: ListAccessArgs) {
  if (!session?.itemId) {
    return false;
  }

  // Return a filter that only shows items where the user is the student or teacher
  return {
    OR: [
      { student: { id: { equals: session.itemId } } },
      { teacher: { id: { equals: session.itemId } } },
    ],
  };
}

export const Callback = list({
  access: {
    operation: {
      query: callbackAccess,
      create: callbackAccess,
      delete: callbackAccess,
      update: callbackAccess,
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

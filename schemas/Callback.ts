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
    .then(async (callback: any) => {
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

      // Check if user co-teaches with any of the student's block teachers OR the assigning teacher
      let isCoTeacher = false;
      if (session.data?.isStaff) {
        const sessionUser = await context.sudo().query.User.findOne({
          where: { id: userId },
          query: `coTeachesWithTeacher { id }`,
        });

        const coTeacherIds = sessionUser?.coTeachesWithTeacher?.map((teacher: any) => teacher.id) || [];

        // Check if the assigning teacher is a co-teacher
        const isCoTeacherWithAssigningTeacher = callback.teacher?.id && coTeacherIds.includes(callback.teacher.id);

        // Check if any of the student's block teachers are co-teachers
        const isCoTeacherWithBlockTeacher = callback.student && coTeacherIds.length > 0 && (
          coTeacherIds.includes(callback.student.block1Teacher?.id) ||
          coTeacherIds.includes(callback.student.block2Teacher?.id) ||
          coTeacherIds.includes(callback.student.block3Teacher?.id) ||
          coTeacherIds.includes(callback.student.block4Teacher?.id) ||
          coTeacherIds.includes(callback.student.block5Teacher?.id) ||
          coTeacherIds.includes(callback.student.block6Teacher?.id) ||
          coTeacherIds.includes(callback.student.block7Teacher?.id) ||
          coTeacherIds.includes(callback.student.block8Teacher?.id) ||
          coTeacherIds.includes(callback.student.block9Teacher?.id) ||
          coTeacherIds.includes(callback.student.block10Teacher?.id)
        );

        isCoTeacher = isCoTeacherWithAssigningTeacher || isCoTeacherWithBlockTeacher;
      }

      // Check if user is a staff member who has the student in their special group
      // OR if user is a parent of the callback student
      // We need to query the session user's specialGroupStudents/children to check
      if ((session.data?.isStaff || session.data?.isParent) && callback.student) {
        return context
          .sudo()
          .query.User.findOne({
            where: { id: userId },
            query: `specialGroupStudents { id } children { id }`,
          })
          .then((sessionUser: any) => {
            const isSpecialGroupTeacher =
              sessionUser?.specialGroupStudents &&
              sessionUser.specialGroupStudents.some(
                (student: any) => student.id === callback.student.id,
              );

            const isParent =
              sessionUser?.children &&
              sessionUser.children.some(
                (child: any) => child.id === callback.student.id,
              );

            const hasDirectRelationship =
              isStudent ||
              isTeacher ||
              isTaTeacher ||
              isStaffTeacher ||
              isSpecialGroupTeacher ||
              isCoTeacher ||
              isParent;

            // If user has direct relationship, allow access
            if (hasDirectRelationship) {
              return true;
            }

            // If no direct relationship, check if user has canSeeAllCallback (read-only access)
            if ((session?.data as any)?.canSeeAllCallback) {
              return true;
            }

            return false;
          });
      }

      const hasDirectRelationship =
        isStudent || isTeacher || isTaTeacher || isStaffTeacher || isCoTeacher;

      // If user has direct relationship, allow access
      if (hasDirectRelationship) {
        return true;
      }

      // If no direct relationship, check if user has canSeeAllCallback (read-only access)
      if ((session?.data as any)?.canSeeAllCallback) {
        return true;
      }

      return false;
    });
}

// Filter function to restrict list queries to user's own items
async function callbackFilter({ session, context }: ListAccessArgs) {
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
      { student: { parent: { some: { id: { equals: userId } } } } },
    ],
  };

  // If user is staff, also include callbacks for students they teach
  if (isStaff && context) {
    // Get the session user's special group students and co-teachers
    const sessionUser = await context.sudo().query.User.findOne({
      where: { id: userId },
      query: `specialGroupStudents { id } coTeachesWithTeacher { id }`,
    });

    const specialGroupStudentIds =
      sessionUser?.specialGroupStudents?.map((student: any) => student.id) ||
      [];

    const coTeacherIds =
      sessionUser?.coTeachesWithTeacher?.map((teacher: any) => teacher.id) ||
      [];

    const filters: any[] = [
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
      ...(specialGroupStudentIds.length > 0
        ? [{ student: { id: { in: specialGroupStudentIds } } }]
        : []),
    ];

    // Add filters for co-teaching relationships
    if (coTeacherIds.length > 0) {
      filters.push(
        // Show callbacks where student is taught by a co-teacher
        { student: { block1Teacher: { id: { in: coTeacherIds } } } },
        { student: { block2Teacher: { id: { in: coTeacherIds } } } },
        { student: { block3Teacher: { id: { in: coTeacherIds } } } },
        { student: { block4Teacher: { id: { in: coTeacherIds } } } },
        { student: { block5Teacher: { id: { in: coTeacherIds } } } },
        { student: { block6Teacher: { id: { in: coTeacherIds } } } },
        { student: { block7Teacher: { id: { in: coTeacherIds } } } },
        { student: { block8Teacher: { id: { in: coTeacherIds } } } },
        { student: { block9Teacher: { id: { in: coTeacherIds } } } },
        { student: { block10Teacher: { id: { in: coTeacherIds } } } },
        // Show callbacks where the assigning teacher is a co-teacher
        { teacher: { id: { in: coTeacherIds } } }
      );
    }

    return {
      OR: filters,
    };
  }

  return baseFilter;
}

export const Callback = list({
  access: {
    operation: {
      query: callbackAccess,
      create: ({ session, context, itemId }: ListAccessArgs) => {
        // Check if user has direct relationship (student, teacher, TA, block teacher, special group)
        return callbackAccess({ session, context, itemId });
      },
      delete: ({ session, context, itemId }: ListAccessArgs) => {
        // Check if user has direct relationship (student, teacher, TA, block teacher, special group)
        return callbackAccess({ session, context, itemId });
      },
      update: ({ session, context, itemId }: ListAccessArgs) => {
        // Check if user has direct relationship (student, teacher, TA, block teacher, special group)
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

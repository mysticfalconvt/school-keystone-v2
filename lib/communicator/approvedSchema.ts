// The contract the Communicator model is allowed to see.
//
// The model used to be shown a hand-copied snapshot of the full admin schema
// that lived in the dashboard repo. It drifted from the real lists, advertised
// fields the execution context could not read, and exposed domains nobody had
// decided to expose. This file replaces that with an allowlist applied to the
// generated schema, so the contract is derived from the real lists and anything
// new is excluded until somebody adds it here on purpose.
//
// Adding a domain should come with example questions and an authorization test.
// See COMMUNICATOR_BACKEND_MIGRATION_PLAN.md, "Schema Ownership And Reduction".

/**
 * Root Query fields the model may call. Everything else is dropped, including
 * every mutation.
 */
export const APPROVED_ROOT_FIELDS = [
  // Identity of the caller
  'authenticatedItem',
  // People, classes and TA relationships
  'user',
  'users',
  'usersCount',
  // PBIS
  'pbisCard',
  'pbisCards',
  'pbisCardsCount',
  'staffPbisCard',
  'staffPbisCards',
  'staffPbisCardsCount',
  'pbisCollectionDate',
  'pbisCollectionDates',
  'pbisCollectionDatesCount',
  'randomDrawingWin',
  'randomDrawingWins',
  'randomDrawingWinsCount',
  // Callback (late/missing work)
  'callback',
  'callbacks',
  'callbacksCount',
];

/**
 * Object types the model may select from. A type not listed here is removed
 * entirely, along with every field that returns it.
 *
 * Deliberately excluded: BugReport, Bullying, Discipline, CellPhoneViolation,
 * Message, CommunicatorChat, SortingHatQuestion, TrimesterAward, Calendar,
 * Link, Birthday, AssignmentHistory, StudentFocus, ChromebookCheck,
 * CallbackRewardRun, Video. These are either private to the people involved,
 * disciplinary records, or have no question set behind them yet.
 */
export const APPROVED_TYPES = [
  'User',
  'PbisCard',
  'StaffPbisCard',
  'PbisCollectionDate',
  'RandomDrawingWin',
  'Callback',
];

/**
 * Fields excluded from User even though the type is approved.
 *
 * Authentication state is excluded outright. Permission flags are excluded
 * because they describe who may do what, not anything a staff question is
 * about, and listing them invites the model to reason about authorization.
 * isStaff / isStudent / isTeacher / isParent / isSuperAdmin / hasTA /
 * hasClasses stay, because questions genuinely turn on them.
 */
export const USER_FIELD_DENY = [
  // Authentication and account recovery
  'password',
  'passwordResetToken',
  'passwordResetIssuedAt',
  'passwordResetRedeemedAt',
  'magicAuthToken',
  'magicAuthIssuedAt',
  'magicAuthRedeemedAt',
  // Capability flags that are not question material
  'canManageCalendar',
  'canSeeOtherUsers',
  'canManageUsers',
  'canManageRoles',
  'canManageLinks',
  'canManageDiscipline',
  'canSeeAllDiscipline',
  'canSeeAllTeacherEvents',
  'canSeeStudentEvents',
  'canSeeOwnCallback',
  'canSeeAllCallback',
  'canManagePbis',
  'canHaveSpecialGroups',
  'isCommunicatorEnabled',
  'canManageCommunicator',
  // Private or disciplinary domains, excluded with their types
  'studentDiscipline',
  'studentDisciplineCount',
  'teacherDiscipline',
  'teacherDisciplineCount',
  'studentCellPhoneViolation',
  'studentCellPhoneViolationCount',
  'teacherCellPhoneViolation',
  'teacherCellPhoneViolationCount',
  'messageSender',
  'messageSenderCount',
  'messageReceiver',
  'messageReceiverCount',
  'communicatorChats',
  'communicatorChatsCount',
  'bugReports',
  'bugReportsCount',
  'studentBullying',
  'studentBullyingCount',
  'teacherBullying',
  'teacherBullyingCount',
  'sortingHat',
];

/**
 * Human-written semantics for fields whose names do not carry them. These are
 * attached as descriptions in the generated contract, which is the only place
 * the model learns the difference between a live count and a stored one.
 */
export const FIELD_DESCRIPTIONS: Record<string, Record<string, string>> = {
  User: {
    studentPbisCardsCount:
      'Live count of PBIS cards this student has RECEIVED. Accepts the same where filter as pbisCards, so date ranges go inside it. With no argument it counts every card on record.',
    teacherPbisCardsCount:
      'Live count of PBIS cards this staff member has GIVEN to students.',
    staffPbisCardsGivenCount:
      'Live count of staff-to-staff PBIS cards this person has given.',
    staffPbisCardsReceivedCount:
      'Live count of staff-to-staff PBIS cards this person has received.',
    isTeacher:
      'True for classroom teachers specifically. Note that people here say "teacher" to mean any employee, so isStaff is usually the right filter; use isTeacher only when the question means classroom teachers as distinct from other staff.',
    isStaff: 'True for anyone who works at the school.',
    isSuperAdmin:
      'Administrator account. Admins bulk-import PBIS cards, so their card totals are not comparable to a teacher handing out cards individually. Exclude them from "who gave the most cards" style questions.',
    individualPbisLevel:
      'Stored level for the student, updated by the weekly PBIS collection. Current state, not a running total.',
    taTeamPbisLevel:
      "Stored level for this teacher's TA group, updated by the weekly PBIS collection.",
    taTeamAveragePbisCardsPerStudent:
      "Stored average cards per student for this teacher's TA group, updated by the weekly PBIS collection.",
    callbackCount:
      'Stored count of open callback assignments for a student. Prefer callbackItemsCount with an explicit filter over trusting this.',
    callbackAssigned:
      'Callback assignments this staff member has GIVEN to students, all of them, completed or not.',
    callbackAssignedCount:
      'Live count of callbacks this staff member has GIVEN. With no argument it counts every callback ever assigned, including completed ones. For OPEN or OUTSTANDING callbacks you MUST filter: callbackAssignedCount(where: { dateCompleted: null }). Asking for "open" and counting unfiltered is a common and silent error.',
    callbackItems:
      'Callback assignments this student has RECEIVED, all of them, completed or not.',
    callbackItemsCount:
      'Live count of callbacks this student has RECEIVED. With no argument it counts every callback, including completed ones. For OPEN ones filter: callbackItemsCount(where: { dateCompleted: null }).',
    averageTimeToCompleteCallback:
      'Stored average days taken to complete a callback.',
    taStudents: 'The students in this teacher\'s TA (advisory) group.',
    taTeacher: "The student's TA (advisory) teacher.",
  },
  PbisCard: {
    dateGiven: 'When the card was given. Use this for any date filtering.',
    category:
      'One of: physical, class, responsibility, callback, quick, respect, perseverance.',
    teacher: 'The staff member who gave the card.',
    student: 'The student who received the card.',
  },
  PbisCollectionDate: {
    collectionDate: 'When this weekly PBIS collection run happened.',
    collectedCards: 'Cards counted in this run. Stored as text, not a number.',
  },
  Callback: {
    dateAssigned: 'When the callback (late or missing work) was assigned.',
    dateCompleted:
      'When the student completed it. NULL means the callback is still open/outstanding - this is the only way to tell open from completed.',
    teacher: 'The staff member who assigned the callback.',
    student: 'The student who owes the work.',
    description:
      'The assignment text. Teachers often assign the same description to a whole class at once, so identical descriptions are common and expected.',
  },
};

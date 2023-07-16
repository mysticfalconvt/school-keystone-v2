import { list } from "@keystone-6/core";
import {
  text,
  password,
  relationship,
  integer,
  timestamp,
} from "@keystone-6/core/fields";
import { isAdmin, isSignedIn } from "../access";
import { permissionFields } from "./fields";

export const User = list({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      delete: isSignedIn,
      update: isSignedIn,
    },
  },
  ui: {
    // hide the backend UI from regular users
    isHidden: !isAdmin,
    hideDelete: !isAdmin,
    description: "Users of the site",
    listView: {
      initialColumns: ["name", "email", "taTeacher"],
      pageSize: 100,
    },
  },
  fields: {
    name: text({ isIndexed: true, validation: { isRequired: true } }),
    preferredName: text(),
    email: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    password: password({ validation: { isRequired: true } }),
    taStudents: relationship({ ref: "User.taTeacher", many: true }),
    taTeacher: relationship({ ref: "User.taStudents", many: false }),
    parent: relationship({ ref: "User.children", many: true }),
    children: relationship({ ref: "User.parent", many: true }),
    ...permissionFields,

    //classes
    block1Teacher: relationship({ ref: "User.block1Students", many: false }),
    block1Students: relationship({ ref: "User.block1Teacher", many: true }),
    block2Teacher: relationship({ ref: "User.block2Students", many: false }),
    block2Students: relationship({ ref: "User.block2Teacher", many: true }),
    block3Teacher: relationship({ ref: "User.block3Students", many: false }),
    block3Students: relationship({ ref: "User.block3Teacher", many: true }),
    block4Teacher: relationship({ ref: "User.block4Students", many: false }),
    block4Students: relationship({ ref: "User.block4Teacher", many: true }),
    block5Teacher: relationship({ ref: "User.block5Students", many: false }),
    block5Students: relationship({ ref: "User.block5Teacher", many: true }),
    block6Teacher: relationship({ ref: "User.block6Students", many: false }),
    block6Students: relationship({ ref: "User.block6Teacher", many: true }),
    block7Teacher: relationship({ ref: "User.block7Students", many: false }),
    block7Students: relationship({ ref: "User.block7Teacher", many: true }),
    block8Teacher: relationship({ ref: "User.block8Students", many: false }),
    block8Students: relationship({ ref: "User.block8Teacher", many: true }),

    specialGroupStudents: relationship({ ref: "User", many: true }),

    //other relationships
    taTeam: relationship({ ref: "PbisTeam.taTeacher" }),
    studentFocusTeacher: relationship({
      ref: "StudentFocus.teacher",
      many: true,
    }),
    studentFocusStudent: relationship({
      ref: "StudentFocus.student",
      many: true,
    }),
    studentCellPhoneViolation: relationship({
      ref: "CellPhoneViolation.student",
      many: true,
    }),
    teacherCellPhoneViolation: relationship({
      ref: "CellPhoneViolation.teacher",
      many: true,
    }),
    teacherPbisCards: relationship({ ref: "PbisCard.teacher", many: true }),
    studentPbisCards: relationship({
      ref: "PbisCard.student",
      many: true,
      ui: {
        displayMode: "count",
      },
    }),
    teacherDiscipline: relationship({ ref: "Discipline.teacher", many: true }),
    studentDiscipline: relationship({ ref: "Discipline.student", many: true }),
    callbackItems: relationship({ ref: "Callback.student", many: true }),
    callbackAssigned: relationship({ ref: "Callback.teacher", many: true }),
    messageSender: relationship({ ref: "Message.sender", many: true }),
    messageReceiver: relationship({ ref: "Message.receiver", many: true }),

    //PBIS Collection Winners
    currentTaWinner: relationship({
      ref: "User.studentIsCurrentWinner",
      many: false,
    }),
    previousTaWinner: relationship({
      ref: "User.studentIsPreviousWinner",
      many: false,
    }),
    studentIsCurrentWinner: relationship({
      ref: "User.currentTaWinner",
      many: false,
    }),
    studentIsPreviousWinner: relationship({
      ref: "User.previousTaWinner",
      many: false,
    }),
    randomDrawingWins: relationship({
      ref: "RandomDrawingWin.student",
      many: true,
    }),
    birthday: relationship({ ref: "Birthday.student", many: false }),
    individualPbisLevel: integer({ defaultValue: 0 }),
    taTeamPbisLevel: integer({ defaultValue: 0 }),
    taTeamAveragePbisCardsPerStudent: integer({ defaultValue: 0 }),
    chromebookCheck: relationship({
      ref: "ChromebookCheck.student",
      many: true,
    }),

    // Important Info
    callbackCount: integer({ defaultValue: 0 }),
    totalCallbackCount: integer({ defaultValue: 0 }),
    PbisCardCount: integer({ defaultValue: 0 }),
    YearPbisCount: integer({ defaultValue: 0 }),
    teacherSubject: text({ defaultValue: undefined }),
    taPbisCardCount: integer({ defaultValue: 0 }),
    averageTimeToCompleteCallback: integer(),

    // assignments
    block1Assignment: text({
      defaultValue: "Current Assignment for Block 1 goes here",
    }),
    block1ClassName: text({ defaultValue: "Class Name Goes Here" }),
    block1AssignmentLastUpdated: timestamp(),
    block2Assignment: text({
      defaultValue: "Current Assignment for Block 2 goes here",
    }),
    block2ClassName: text({ defaultValue: "Class Name Goes Here" }),
    block2AssignmentLastUpdated: timestamp(),
    block3Assignment: text({
      defaultValue: "Current Assignment for Block 3 goes here",
    }),
    block3ClassName: text({ defaultValue: "Class Name Goes Here" }),
    block3AssignmentLastUpdated: timestamp(),
    block4Assignment: text({
      defaultValue: "Current Assignment for Block 4 goes here",
    }),
    block4ClassName: text({ defaultValue: "Class Name Goes Here" }),
    block4AssignmentLastUpdated: timestamp(),
    block5Assignment: text({
      defaultValue: "Current Assignment for Block 5 goes here",
    }),
    block5ClassName: text({ defaultValue: "Class Name Goes Here" }),
    block5AssignmentLastUpdated: timestamp(),
    block6Assignment: text({
      defaultValue: "Current Assignment for Block 6 goes here",
    }),
    block6ClassName: text({ defaultValue: "Class Name Goes Here" }),
    block6AssignmentLastUpdated: timestamp(),
    block7Assignment: text({
      defaultValue: "Current Assignment for Block 7 goes here",
    }),
    block7ClassName: text({ defaultValue: "Class Name Goes Here" }),
    block7AssignmentLastUpdated: timestamp(),
    block8Assignment: text({
      defaultValue: "Current Assignment for Block 8 goes here",
    }),
    block8ClassName: text({ defaultValue: "Class Name Goes Here" }),
    block8AssignmentLastUpdated: timestamp(),

    // Sorting Hat
    sortingHat: text({ defaultValue: "" }),
  },
  hooks: {
    afterOperation: async ({ operation, item, context }) => {
      if (operation === "create" && item?.isStudent) {
        const createBirtday = await context.query.Birthday.createOne({
          data: {
            student: { connect: { id: item.id } },
          },
          // resolveFields: "id",
        });
      }
    },
  },
});

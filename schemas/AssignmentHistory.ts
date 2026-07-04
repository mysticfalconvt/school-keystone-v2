import { list } from "@keystone-6/core";
import { integer, relationship, text, timestamp } from "@keystone-6/core/fields";
import { isAdmin, isSignedIn } from "../access";

// Archive of past ("replaced") class assignments. One row is written by the
// User afterOperation hook each time a teacher's block{N}Assignment changes.
// Rows are only ever created via context.sudo() in that hook, so user-facing
// create/update/delete are locked to admins.
export const AssignmentHistory = list({
  access: {
    operation: {
      query: isSignedIn,
      create: isAdmin,
      delete: isAdmin,
      update: isAdmin,
    },
  },
  ui: {
    isHidden: !isAdmin,
    listView: {
      initialColumns: ["teacher", "block", "className", "dateRemoved"],
      initialSort: { field: "dateRemoved", direction: "DESC" },
      pageSize: 100,
    },
  },
  fields: {
    teacher: relationship({ ref: "User.assignmentHistory", many: false }),
    block: integer(),
    className: text(),
    assignment: text({ ui: { displayMode: "textarea" } }),
    // When this (now-archived) assignment had originally been set.
    dateAdded: timestamp(),
    // When it was replaced by a new assignment.
    dateRemoved: timestamp({
      defaultValue: { kind: "now" },
    }),
  },
});

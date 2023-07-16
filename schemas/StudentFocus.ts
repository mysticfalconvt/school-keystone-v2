import {
  integer,
  select,
  text,
  relationship,
  timestamp,
  checkbox,
} from "@keystone-6/core/fields";
import { list } from "@keystone-6/core";
import { isSignedIn } from "../access";

export const StudentFocus = list({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      delete: isSignedIn,
      update: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ["category", "teacher", "student"],
      pageSize: 100,
    },
  },
  fields: {
    comments: text({
      ui: {
        displayMode: "textarea",
      },
    }),
    category: text(),
    student: relationship({
      ref: "User.studentFocusStudent",
    }),
    teacher: relationship({
      ref: "User.studentFocusTeacher",
    }),

    dateCreated: timestamp({
      validation: { isRequired: true },
      defaultValue: { kind: "now" },
    }),
  },
});

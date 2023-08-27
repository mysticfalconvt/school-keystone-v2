import {
  text,
  relationship,
  timestamp,
  checkbox,
} from "@keystone-6/core/fields";
import { list } from "@keystone-6/core";
import { isSignedIn } from "../access";

export const ChromebookAssignment = list({
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
      initialColumns: ["number", "student", "checkLog"],
      pageSize: 100,
    },
  },
  fields: {
    teacher: relationship({
      ref: "User",
    }),
    student: relationship({
      ref: "User.chromebookCheck",
    }),
    number: text(),
    checkLog: relationship({
      ref: "ChromebookCheck.assignment",
      many: true,
    }),
  },
});

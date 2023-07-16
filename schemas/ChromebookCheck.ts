import {
  text,
  relationship,
  timestamp,
  checkbox,
} from "@keystone-6/core/fields";
import { list } from "@keystone-6/core";
import { isSignedIn } from "../access";

export const ChromebookCheck = list({
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
      initialColumns: ["time", "student"],
      pageSize: 100,
    },
  },
  fields: {
    time: timestamp({
      validation: { isRequired: true },
      defaultValue: { kind: "now" },
    }),
    teacher: relationship({
      ref: "User",
    }),
    student: relationship({
      ref: "User.chromebookCheck",
    }),
    message: text(),
  },
});

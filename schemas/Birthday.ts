import {
  text,
  relationship,
  timestamp,
  checkbox,
} from "@keystone-6/core/fields";
import { list } from "@keystone-6/core";
import { isSignedIn } from "../access";

export const Birthday = list({
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
      initialColumns: ["student", "cakeType"],
      initialSort: { field: "date", direction: "ASC" },
      pageSize: 100,
    },
  },
  fields: {
    cakeType: text(),
    date: timestamp({
      // validation: {isRequired: true},
      isIndexed: true,
    }),
    hasChosen: checkbox({
      defaultValue: false,
      label: "Has Chosen a Cake",
    }),
    hasDelivered: checkbox({
      defaultValue: false,
      label: "Has gotten their cake",
    }),

    student: relationship({
      ref: "User.birthday",
    }),
  },
});

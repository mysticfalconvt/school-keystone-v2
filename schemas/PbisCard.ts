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

export const PbisCard = list({
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
      pageSize: 200,
    },
  },
  fields: {
    category: text({
      isIndexed: true,
    }),
    cardMessage: text({
      ui: {
        displayMode: "textarea",
      },
      isIndexed: true,
    }),

    student: relationship({
      ref: "User.studentPbisCards",
    }),
    teacher: relationship({
      ref: "User.teacherPbisCards",
    }),
    dateGiven: timestamp({
      validation: { isRequired: true },
      defaultValue: { kind: "now" },
    }),
    counted: checkbox({ defaultValue: false, label: "Counted" }),
  },
});

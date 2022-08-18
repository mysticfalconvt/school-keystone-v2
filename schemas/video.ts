import { text, checkbox, select } from "@keystone-6/core/fields";
import { list } from "@keystone-6/core";
import { isSignedIn } from "../access";

export const Video = list({
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
      initialColumns: ["name", "type", "link"],
      pageSize: 100,
    },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    description: text({
      ui: {
        displayMode: "textarea",
      },
    }),

    onHomePage: checkbox({ defaultValue: false, label: "On Home Page" }),

    type: select({
      options: [
        { value: "google drive", label: "google drive" },
        { value: "youtube", label: "Youtube" },
      ],
      validation: { isRequired: true },
    }),

    link: text(),
  },
});

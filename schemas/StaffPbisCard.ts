import { list } from "@keystone-6/core";
import { checkbox, relationship, text, timestamp } from "@keystone-6/core/fields";
import { isAdmin, isSignedIn } from "../access";
import { ListAccessArgs } from "../types";

// A PBIS card whose RECIPIENT is a staff member. Kept in its own list (not a
// category on PbisCard) so it counts toward the school-wide total but never
// toward TA levels, student levels, or the student random drawing. Staff
// winners / staff random drawings are sourced from these cards.
const STAFF_CARD_DAILY_LIMIT_FOR_STUDENTS = 3;

function startOfTodayISO(): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

export const StaffPbisCard = list({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      delete: isAdmin,
      update: isAdmin,
    },
  },
  ui: {
    isHidden: !isAdmin,
    listView: {
      initialColumns: ["recipient", "giver", "dateGiven"],
      initialSort: { field: "dateGiven", direction: "DESC" },
      pageSize: 200,
    },
  },
  hooks: {
    validateInput: async ({
      operation,
      resolvedData,
      context,
      addValidationError,
    }) => {
      if (operation !== "create") return;

      // A comment is required on every staff card.
      const message = (resolvedData as any)?.cardMessage;
      if (!message || String(message).trim() === "") {
        addValidationError("A comment is required to give a staff PBIS card.");
      }

      // Students may give at most 3 staff cards per day. Staff are unlimited.
      const giverId = (resolvedData as any)?.giver?.connect?.id;
      if (!giverId) return;

      const giver = await context.sudo().query.User.findOne({
        where: { id: giverId },
        query: "id isStudent",
      });

      if (giver?.isStudent) {
        const todaysCount = await context.sudo().query.StaffPbisCard.count({
          where: {
            giver: { id: { equals: giverId } },
            dateGiven: { gte: startOfTodayISO() },
          },
        });
        if (todaysCount >= STAFF_CARD_DAILY_LIMIT_FOR_STUDENTS) {
          addValidationError(
            `Students can give at most ${STAFF_CARD_DAILY_LIMIT_FOR_STUDENTS} staff cards per day.`,
          );
        }
      }
    },
  },
  fields: {
    category: text({ isIndexed: true }),
    giver: relationship({ ref: "User.staffPbisCardsGiven" }),
    recipient: relationship({ ref: "User.staffPbisCardsReceived" }),
    cardMessage: text({
      ui: { displayMode: "textarea" },
      isIndexed: true,
    }),
    dateGiven: timestamp({
      validation: { isRequired: true },
      defaultValue: { kind: "now" },
    }),
    counted: checkbox({ defaultValue: false, label: "Counted" }),
  },
});

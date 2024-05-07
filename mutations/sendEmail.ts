import { sendAnEmail } from "../lib/mail";
import { graphql } from "@keystone-6/core";

// const graphql = String.raw;

export const sendEmail = (base: any) =>
  graphql.field({
    type: base.object("User"),
    args: {
      emailData: graphql.arg({ type: graphql.JSON }),
    },
    resolve: async (source, args, context) => {
      console.log("Sending an Email", args.emailData);
      const email = args.emailData as {
        toAddress: string;
        fromAddress: string;
        subject?: string;
        body: string;
      };
      if (!email) return null;
      // if not json parsable then return null
      if (typeof email !== "object") return null;

      const to = email.toAddress;
      const from = email.fromAddress;
      const subject = email.subject || "Email from NCUJHS.Tech";
      const body = email.body;
      await sendAnEmail(to, from, subject, body);

      return { id: "yes" };
    },
  });

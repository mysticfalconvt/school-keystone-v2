import { isSignedIn } from "../access";
import { sendAnEmail } from "../lib/mail";
import { graphql } from "@keystone-6/core";

// const graphql = String.raw;

export const sendEmail = (base: any) =>
  graphql.field({
    type: graphql.Boolean,

    args: {
      emailData: graphql.arg({ type: graphql.JSON }),
    },
    resolve: async (source, args, context) => {
      console.log("Sending an Email", args.emailData);
      const session = await context.session;
      const isAllowed = isSignedIn({ session, context });
      if (!isAllowed) return false;
      const email = args.emailData as {
        toAddress: string;
        fromAddress: string;
        subject?: string;
        body: string;
      };
      if (!email) return false;
      // if not json parsable then return null
      if (typeof email !== "object") return false;

      const to = email.toAddress;
      const from = email.fromAddress;
      const subject = email.subject || "Email from NCUJHS.Tech";
      const body = email.body;
      await sendAnEmail(to, from, subject, body);

      return true;
    },
  });

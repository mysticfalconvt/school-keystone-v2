import { isSignedIn } from "../access";
import { enqueueGeneralEmail } from "../lib/emailQueue";
import { graphql } from "@keystone-6/core";

// const graphql = String.raw;

export const sendEmail = (base: any) =>
  graphql.field({
    type: graphql.Boolean,

    args: {
      emailData: graphql.arg({ type: graphql.JSON }),
    },
    resolve: async (source, args, context) => {
      const session = await context.session;
      const isAllowed = isSignedIn({ session, context });
      if (!isAllowed) return false;
      // The shared mutation can address arbitrary recipients, so browser users
      // must be staff. Calls authenticated by the server-to-server header have
      // no session and retain their existing access.
      if (
        session &&
        !session.data.isStaff &&
        !session.data.isTeacher &&
        !session.data.isGuidance &&
        !session.data.isSuperAdmin
      ) {
        return false;
      }
      const email = args.emailData as {
        toAddress: string;
        fromAddress: string;
        subject?: string;
        body: string;
        lowPriority?: boolean;
        batchId?: string;
      };
      if (!email) return false;
      // if not json parsable then return null
      if (typeof email !== "object") return false;
      if (
        email.lowPriority === true &&
        !session?.data?.isSuperAdmin &&
        !session?.data?.canManagePbis
      ) {
        return false;
      }

      const to = email.toAddress;
      const from = email.fromAddress;
      const subject = email.subject || "Email from NCUJHS.Tech";
      const body = email.body;
      await enqueueGeneralEmail(context, {
        to,
        from,
        subject,
        body,
        lowPriority: email.lowPriority === true,
        batchId: email.batchId,
        requestedById: session?.itemId,
      });

      return true;
    },
  });

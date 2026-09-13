"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// keystone.ts
var keystone_exports = {};
__export(keystone_exports, {
  default: () => keystone_default
});
module.exports = __toCommonJS(keystone_exports);
var import_config3 = require("dotenv/config");

// lib/bugsink.ts
var import_config = require("dotenv/config");
var Sentry = __toESM(require("@sentry/node"));
var dsn = process.env.BUGSINK_DSN;
var bugsinkEnabled = Boolean(dsn);
if (dsn) {
  Sentry.init({
    dsn,
    release: `school-keystone-v2@${process.env.npm_package_version || "dev"}`,
    environment: process.env.NODE_ENV || "development",
    // Bugsink is an error tracker only — it does not ingest traces or profiles.
    tracesSampleRate: 0,
    // This app holds student data. Never let the SDK attach request bodies,
    // headers, cookies or IPs on its own; we attach specific fields by hand.
    sendDefaultPii: false,
    // Console arguments and HTTP request details can contain credentials or
    // student data even when sendDefaultPii is disabled.
    beforeBreadcrumb(breadcrumb) {
      return breadcrumb.category === "console" ? null : breadcrumb;
    },
    beforeSend(event) {
      delete event.request;
      return event;
    }
  });
  console.log(`[bugsink] error reporting enabled -> ${new URL(dsn).origin}`);
} else {
  console.log("[bugsink] BUGSINK_DSN not set \u2014 error reporting disabled");
}
function captureError(error, context = {}) {
  if (!bugsinkEnabled) return;
  try {
    Sentry.withScope((scope) => {
      if (context.tags) scope.setTags(context.tags);
      if (context.extra) scope.setExtras(context.extra);
      if (context.userId) scope.setUser({ id: context.userId });
      if (error instanceof Error) {
        Sentry.captureException(error);
      } else {
        Sentry.captureMessage(String(error), "error");
      }
    });
  } catch (bugsinkError) {
    console.error("[bugsink] failed to report error", bugsinkError);
  }
}
function reportUserBug(report) {
  if (!bugsinkEnabled) return;
  try {
    Sentry.withScope((scope) => {
      scope.setLevel("warning");
      scope.setTag("source", "bug-report");
      scope.setFingerprint(["bug-report", report.title]);
      if (report.description) scope.setExtra("description", report.description);
      if (report.submittedById) scope.setUser({ id: report.submittedById });
      Sentry.captureMessage(`Bug report: ${report.title}`);
    });
  } catch (bugsinkError) {
    console.error("[bugsink] failed to report user bug", bugsinkError);
  }
}
var IGNORED_ERROR_CODES = /* @__PURE__ */ new Set([
  "GRAPHQL_PARSE_FAILED",
  "GRAPHQL_VALIDATION_FAILED",
  "BAD_USER_INPUT",
  "BAD_REQUEST",
  "PERSISTED_QUERY_NOT_FOUND"
]);
var IGNORED_MESSAGE_PATTERNS = [
  /access denied/i,
  /must be logged in/i,
  /not authoriz/i,
  /permission/i
];
function isExpectedError(error) {
  const code = error.extensions?.code;
  if (typeof code === "string" && IGNORED_ERROR_CODES.has(code)) return true;
  return IGNORED_MESSAGE_PATTERNS.some((pattern) => pattern.test(error.message));
}
var bugsinkApolloPlugin = {
  async requestDidStart() {
    return {
      async didEncounterErrors({ errors, request, contextValue }) {
        if (!bugsinkEnabled) return;
        const userId = contextValue?.session?.itemId;
        for (const error of errors) {
          if (isExpectedError(error)) continue;
          captureError(error.originalError ?? error, {
            tags: {
              source: "graphql",
              ...request.operationName ? { operation: request.operationName } : {}
            },
            extra: {
              variableNames: Object.keys(request.variables ?? {}),
              path: error.path?.join(".")
            },
            userId: userId ? String(userId) : void 0
          });
        }
      }
    };
  }
};

// keystone.ts
var import_core30 = require("@keystone-6/core");

// auth.ts
var import_auth = require("@keystone-6/auth");
var import_session = require("@keystone-6/core/session");

// lib/mail.ts
var import_nodemailer = require("nodemailer");
var import_config2 = require("dotenv/config");
var mailPort = Number(process.env.MAIL_PORT || 587);
if (!process.env.MAIL_HOST || !process.env.MAIL_USER || !process.env.MAIL_PASS) {
  throw new Error("MAIL_HOST, MAIL_USER, and MAIL_PASS must be configured");
}
if (!Number.isInteger(mailPort) || mailPort <= 0) {
  throw new Error("MAIL_PORT must be a valid port number");
}
var transport = (0, import_nodemailer.createTransport)({
  pool: true,
  host: process.env.MAIL_HOST,
  port: mailPort,
  secure: mailPort === 465,
  requireTLS: mailPort !== 465,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  },
  maxConnections: 2,
  maxMessages: 50,
  rateDelta: 1e3,
  rateLimit: 5,
  tls: {
    minVersion: "TLSv1.2"
  }
});
var RETRY_DELAYS_MS = [2e3, 8e3];
async function sendMail(options) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await transport.sendMail(options);
    } catch (error) {
      const responseCode = error instanceof Error && "responseCode" in error ? Number(error.responseCode) : void 0;
      const delayMs = RETRY_DELAYS_MS[attempt];
      if (!delayMs || responseCode !== 421 && responseCode !== 454) {
        throw error;
      }
      console.warn("[mail] transient SMTP failure; retrying", {
        responseCode,
        attempt: attempt + 1,
        delayMs
      });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
function logSentMessage(info) {
  console.log("[mail] message sent", { messageId: info?.messageId });
}
function makeANiceEmail(text22) {
  return `
    <div className="email" style="
      border: 1px solid black;
      padding: 20px;
      font-family: sans-serif;
      line-height: 2;
      font-size: 20px;
    ">
      <h2>Hello There!</h2>
      <p>${text22}</p>

      <p>NCUJHS.Tech</p>
    </div>
  `;
}
async function sendPasswordResetEmail(resetToken, to) {
  const info = await sendMail({
    to,
    from: process.env.MAIL_USER,
    subject: "Your password reset token!",
    html: makeANiceEmail(`Your Password Reset Token is here!
      <a href="${process.env.FRONTEND_URL}/reset?token=${resetToken}">Click Here to reset</a>
    `)
  });
  logSentMessage(info);
  if (process.env.MAIL_USER?.includes("ethereal.email")) {
    console.log(`\u{1F48C} Message Sent!  Preview it at ${(0, import_nodemailer.getTestMessageUrl)(info)}`);
  }
}
async function sendMagicLinkEmail(token, email) {
  const info = await sendMail({
    to: email,
    from: process.env.MAIL_USER,
    subject: "Your Magic Link",
    html: makeANiceEmail(`
      <br/>
      Here is your link to login:
      <a href="${process.env.FRONTEND_URL}/loginLink?token=${token}&email=${email}">Click Here to login</a>
      <br/>
      <p>or copy this link: ${process.env.FRONTEND_URL}/loginLink?token=${token}&email=${email}</p>
    `)
  });
  logSentMessage(info);
  if (process.env.MAIL_USER?.includes("ethereal.email")) {
    console.log(`\u{1F48C} Message Sent!  Preview it at ${(0, import_nodemailer.getTestMessageUrl)(info)}`);
  }
}
async function sendAnEmail(to, from, subject, body) {
  const info = await sendMail({
    to,
    from: process.env.MAIL_USER,
    replyTo: from,
    subject,
    html: makeANiceEmail(body)
  });
  logSentMessage(info);
  if (process.env.MAIL_USER?.includes("ethereal.email")) {
    console.log(`\u{1F48C} Message Sent!  Preview it at ${(0, import_nodemailer.getTestMessageUrl)(info)}`);
  }
}

// auth.ts
var sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "The SESSION_SECRET environment variable must be set in production"
    );
  } else {
    sessionSecret = process.env.SESSION_SECRET || "keystone-session-secret value";
  }
}
var { withAuth } = (0, import_auth.createAuth)({
  listKey: "User",
  identityField: "email",
  sessionData: "name id isSuperAdmin canSeeAllCallback canManageCalendar canSeeOtherUsers canManageUsers canManageRoles canManageLinks canManageDiscipline canSeeAllDiscipline canSeeAllTeacherEvents canSeeStudentEvents canSeeOwnCallback isCommunicatorEnabled canManageCommunicator hasTA hasClasses isStudent isParent isStaff isTeacher isGuidance canManagePbis canHaveSpecialGroups",
  secretField: "password",
  initFirstItem: {
    // If there are no items in the database, keystone will ask you to create
    // a new user, filling in these fields.
    fields: ["name", "email", "password"],
    itemData: { isSuperAdmin: true },
    skipKeystoneWelcome: true
  },
  passwordResetLink: {
    async sendToken(args) {
      await sendPasswordResetEmail(args.token, args.identity);
    }
  },
  magicAuthLink: {
    sendToken: async ({ itemId, identity, token }) => {
      if (itemId && identity && token) {
        try {
          await sendMagicLinkEmail(token, identity);
        } catch (err) {
          console.error("[auth] magicAuthLink sendToken failed");
          captureError(err, {
            tags: { source: "auth", step: "magicAuthLink.sendToken" },
            extra: { itemId: String(itemId) }
          });
          throw err;
        }
      } else {
        console.warn("[auth] magicAuthLink sendToken skipped \u2014 missing field", {
          hasItemId: !!itemId,
          hasIdentity: !!identity,
          hasToken: !!token
        });
      }
    },
    tokensValidForMins: 60
  }
});
var sessionMaxAge = 60 * 60 * 24 * 30;
var session = (0, import_session.statelessSessions)({
  maxAge: sessionMaxAge,
  secret: sessionSecret,
  sameSite: "lax",
  secure: true
});

// schemas/Calendar.ts
var import_fields = require("@keystone-6/core/fields");
var import_core = require("@keystone-6/core");

// access.ts
function isSignedIn({ session: session2, context }) {
  const authHeader = process.env.AUTH_HEADER_SECRET;
  if (!authHeader) {
    console.warn(
      "AUTH_HEADER_SECRET environment variable is not set. Authentication header check will be disabled."
    );
    if (process.env.NODE_ENV === "production") {
      console.error("AUTH_HEADER_SECRET is required in production environment");
    }
  }
  const isAuth = authHeader ? context?.req?.rawHeaders?.includes(authHeader) : false;
  const hasSession = !!session2;
  const isAllowed = hasSession || isAuth;
  return !!isAllowed;
}
function isAdmin({ session: session2, context }) {
  const isSuperAdmin = session2?.data?.isSuperAdmin || false;
  return !!isSuperAdmin;
}
function canManageLinksAccess({ session: session2 }) {
  return !!(session2?.data?.isSuperAdmin || session2?.data?.canManagePbis);
}

// schemas/Calendar.ts
var Calendar = (0, import_core.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      delete: isSignedIn,
      update: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["date", "status", "name"],
      initialSort: { field: "date", direction: "ASC" },
      pageSize: 100
    }
  },
  fields: {
    name: (0, import_fields.text)({ validation: { isRequired: true } }),
    description: (0, import_fields.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    status: (0, import_fields.select)({
      options: [
        { label: "Teachers", value: "Teachers" },
        { label: "Students", value: "Students" },
        { label: "Both", value: "Both" }
      ],
      defaultValue: "Both",
      validation: { isRequired: true },
      ui: {
        displayMode: "segmented-control",
        createView: { fieldMode: "hidden" }
      },
      isIndexed: true
    }),
    date: (0, import_fields.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" },
      isIndexed: true
    }),
    author: (0, import_fields.relationship)({
      ref: "User"
    }),
    dateCreated: (0, import_fields.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    link: (0, import_fields.text)(),
    linkTitle: (0, import_fields.text)()
  }
});

// schemas/Callback.ts
var import_core2 = require("@keystone-6/core");
var import_fields2 = require("@keystone-6/core/fields");
var limitCallback = process.env.LIMIT_CALLBACK_TO_ASSIGNER === "true";
function callbackAccess({ session: session2, context, itemId }) {
  if (!isSignedIn({ session: session2, context, itemId })) {
    return false;
  }
  if (!itemId) {
    return true;
  }
  if (!session2?.itemId) {
    return false;
  }
  if (!limitCallback && session2.data?.isStaff) {
    return true;
  }
  if (!context) return false;
  return context.sudo().query.Callback.findOne({
    where: { id: itemId },
    query: `
        id
        student {
          id
          taTeacher { id }
          block1Teacher { id }
          block2Teacher { id }
          block3Teacher { id }
          block4Teacher { id }
          block5Teacher { id }
          block6Teacher { id }
          block7Teacher { id }
          block8Teacher { id }
          block9Teacher { id }
          block10Teacher { id }
        }
        teacher { id }
      `
  }).then(async (callback) => {
    if (!callback) return false;
    const userId = session2.itemId;
    const isStudent = callback.student?.id === userId;
    const isTeacher = callback.teacher?.id === userId;
    const isTaTeacher = callback.student?.taTeacher?.id === userId;
    const isStaffTeacher = session2.data?.isStaff && callback.student && (callback.student.block1Teacher?.id === userId || callback.student.block2Teacher?.id === userId || callback.student.block3Teacher?.id === userId || callback.student.block4Teacher?.id === userId || callback.student.block5Teacher?.id === userId || callback.student.block6Teacher?.id === userId || callback.student.block7Teacher?.id === userId || callback.student.block8Teacher?.id === userId || callback.student.block9Teacher?.id === userId || callback.student.block10Teacher?.id === userId);
    let isCoTeacher = false;
    if (session2.data?.isStaff) {
      const sessionUser = await context.sudo().query.User.findOne({
        where: { id: userId },
        query: `coTeachesWithTeacher { id }`
      });
      const coTeacherIds = sessionUser?.coTeachesWithTeacher?.map((teacher) => teacher.id) || [];
      const isCoTeacherWithAssigningTeacher = callback.teacher?.id && coTeacherIds.includes(callback.teacher.id);
      const isCoTeacherWithBlockTeacher = callback.student && coTeacherIds.length > 0 && (coTeacherIds.includes(callback.student.block1Teacher?.id) || coTeacherIds.includes(callback.student.block2Teacher?.id) || coTeacherIds.includes(callback.student.block3Teacher?.id) || coTeacherIds.includes(callback.student.block4Teacher?.id) || coTeacherIds.includes(callback.student.block5Teacher?.id) || coTeacherIds.includes(callback.student.block6Teacher?.id) || coTeacherIds.includes(callback.student.block7Teacher?.id) || coTeacherIds.includes(callback.student.block8Teacher?.id) || coTeacherIds.includes(callback.student.block9Teacher?.id) || coTeacherIds.includes(callback.student.block10Teacher?.id));
      isCoTeacher = isCoTeacherWithAssigningTeacher || isCoTeacherWithBlockTeacher;
    }
    if ((session2.data?.isStaff || session2.data?.isParent) && callback.student) {
      return context.sudo().query.User.findOne({
        where: { id: userId },
        query: `specialGroupStudents { id } children { id }`
      }).then((sessionUser) => {
        const isSpecialGroupTeacher = sessionUser?.specialGroupStudents && sessionUser.specialGroupStudents.some(
          (student) => student.id === callback.student.id
        );
        const isParent = sessionUser?.children && sessionUser.children.some(
          (child) => child.id === callback.student.id
        );
        const hasDirectRelationship2 = isStudent || isTeacher || isTaTeacher || isStaffTeacher || isSpecialGroupTeacher || isCoTeacher || isParent;
        if (hasDirectRelationship2) {
          return true;
        }
        if (session2?.data?.canSeeAllCallback) {
          return true;
        }
        return false;
      });
    }
    const hasDirectRelationship = isStudent || isTeacher || isTaTeacher || isStaffTeacher || isCoTeacher;
    if (hasDirectRelationship) {
      return true;
    }
    if (session2?.data?.canSeeAllCallback) {
      return true;
    }
    return false;
  });
}
async function callbackFilter({ session: session2, context }) {
  if (!session2?.itemId) {
    return false;
  }
  if (session2?.data?.canSeeAllCallback) {
    return true;
  }
  const userId = session2.itemId;
  const isStaff2 = session2.data?.isStaff;
  if (!limitCallback && isStaff2) {
    return true;
  }
  const baseFilter = {
    OR: [
      { student: { id: { equals: userId } } },
      { teacher: { id: { equals: userId } } },
      { student: { taTeacher: { id: { equals: userId } } } },
      { student: { parent: { some: { id: { equals: userId } } } } }
    ]
  };
  if (isStaff2 && context) {
    const sessionUser = await context.sudo().query.User.findOne({
      where: { id: userId },
      query: `specialGroupStudents { id } coTeachesWithTeacher { id }`
    });
    const specialGroupStudentIds = sessionUser?.specialGroupStudents?.map((student) => student.id) || [];
    const coTeacherIds = sessionUser?.coTeachesWithTeacher?.map((teacher) => teacher.id) || [];
    const filters = [
      ...baseFilter.OR,
      { student: { block1Teacher: { id: { equals: userId } } } },
      { student: { block2Teacher: { id: { equals: userId } } } },
      { student: { block3Teacher: { id: { equals: userId } } } },
      { student: { block4Teacher: { id: { equals: userId } } } },
      { student: { block5Teacher: { id: { equals: userId } } } },
      { student: { block6Teacher: { id: { equals: userId } } } },
      { student: { block7Teacher: { id: { equals: userId } } } },
      { student: { block8Teacher: { id: { equals: userId } } } },
      { student: { block9Teacher: { id: { equals: userId } } } },
      { student: { block10Teacher: { id: { equals: userId } } } },
      ...specialGroupStudentIds.length > 0 ? [{ student: { id: { in: specialGroupStudentIds } } }] : []
    ];
    if (coTeacherIds.length > 0) {
      filters.push(
        // Show callbacks where student is taught by a co-teacher
        { student: { block1Teacher: { id: { in: coTeacherIds } } } },
        { student: { block2Teacher: { id: { in: coTeacherIds } } } },
        { student: { block3Teacher: { id: { in: coTeacherIds } } } },
        { student: { block4Teacher: { id: { in: coTeacherIds } } } },
        { student: { block5Teacher: { id: { in: coTeacherIds } } } },
        { student: { block6Teacher: { id: { in: coTeacherIds } } } },
        { student: { block7Teacher: { id: { in: coTeacherIds } } } },
        { student: { block8Teacher: { id: { in: coTeacherIds } } } },
        { student: { block9Teacher: { id: { in: coTeacherIds } } } },
        { student: { block10Teacher: { id: { in: coTeacherIds } } } },
        // Show callbacks where the assigning teacher is a co-teacher
        { teacher: { id: { in: coTeacherIds } } }
      );
    }
    return {
      OR: filters
    };
  }
  return baseFilter;
}
var Callback = (0, import_core2.list)({
  access: {
    operation: {
      query: callbackAccess,
      create: ({ session: session2, context, itemId }) => {
        return callbackAccess({ session: session2, context, itemId });
      },
      delete: ({ session: session2, context, itemId }) => {
        return callbackAccess({ session: session2, context, itemId });
      },
      update: ({ session: session2, context, itemId }) => {
        return callbackAccess({ session: session2, context, itemId });
      }
    },
    filter: {
      query: callbackFilter
    }
  },
  ui: {
    listView: {
      initialColumns: ["dateAssigned", "teacher", "student", "title"],
      initialSort: { field: "dateAssigned", direction: "ASC" },
      pageSize: 100
    }
  },
  fields: {
    title: (0, import_fields2.text)(),
    description: (0, import_fields2.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    // category: text(),
    student: (0, import_fields2.relationship)({
      ref: "User.callbackItems"
    }),
    teacher: (0, import_fields2.relationship)({
      ref: "User.callbackAssigned"
    }),
    dateAssigned: (0, import_fields2.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    dateCompleted: (0, import_fields2.timestamp)({
      isIndexed: true
    }),
    link: (0, import_fields2.text)(),
    messageFromTeacher: (0, import_fields2.text)(),
    messageFromTeacherDate: (0, import_fields2.text)(),
    messageFromStudent: (0, import_fields2.text)(),
    messageFromStudentDate: (0, import_fields2.text)(),
    daysLate: (0, import_fields2.integer)()
  }
});

// schemas/CallbackRewardRun.ts
var import_core3 = require("@keystone-6/core");
var import_fields3 = require("@keystone-6/core/fields");
var CallbackRewardRun = (0, import_core3.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      delete: isSignedIn,
      update: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["runDate", "cardsAwarded"],
      initialSort: { field: "runDate", direction: "DESC" },
      pageSize: 100
    }
  },
  fields: {
    runDate: (0, import_fields3.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    // Students who received the reward this run ("yes").
    eligibleStudents: (0, import_fields3.relationship)({ ref: "User", many: true }),
    // Students skipped this run because of 3+ active callbacks ("no").
    ineligibleStudents: (0, import_fields3.relationship)({ ref: "User", many: true }),
    cardsAwarded: (0, import_fields3.integer)({ defaultValue: 0 }),
    lastModifiedBy: (0, import_fields3.relationship)({ ref: "User" })
  }
});

// schemas/CellPhoneViolation.ts
var import_fields4 = require("@keystone-6/core/fields");
var import_core4 = require("@keystone-6/core");
var CellPhoneViolation = (0, import_core4.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      delete: isSignedIn,
      update: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["dateGiven", "teacher", "student"],
      initialSort: { field: "dateGiven", direction: "ASC" },
      pageSize: 100
    }
  },
  fields: {
    description: (0, import_fields4.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    student: (0, import_fields4.relationship)({
      ref: "User.studentCellPhoneViolation"
    }),
    teacher: (0, import_fields4.relationship)({
      ref: "User.teacherCellPhoneViolation"
    }),
    dateGiven: (0, import_fields4.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" },
      isIndexed: true
    })
  }
});

// schemas/CommunicatorChat.ts
var import_core5 = require("@keystone-6/core");
var import_fields5 = require("@keystone-6/core/fields");
function canManageCommunicatorChats({ session: session2 }) {
  if (!session2) return false;
  return !!(session2.data.isSuperAdmin || session2.data.canManageCommunicator);
}
function isStaff({ session: session2 }) {
  if (!session2) return false;
  return !!session2.data.isStaff;
}
function canUpdateChat({ session: session2 }) {
  if (!session2) return false;
  return !!(session2.data.isStaff || session2.data.isSuperAdmin);
}
function updateFilter({ session: session2 }) {
  if (!session2) return false;
  if (session2.data.isSuperAdmin || session2.data.canManageCommunicator) {
    return true;
  }
  return { user: { id: { equals: session2.itemId } } };
}
var resultFieldAccess = {
  create: () => false,
  update: () => false
};
var CommunicatorChat = (0, import_core5.list)({
  access: {
    operation: {
      query: isStaff,
      // Chats are created only by the queryCommunicator mutation, which uses
      // an elevated context. Disabling the generic create keeps users from
      // fabricating history.
      create: () => false,
      delete: canManageCommunicatorChats,
      update: canUpdateChat
    },
    filter: {
      query: ({ session: session2 }) => {
        if (!session2) return false;
        if (session2.data.isSuperAdmin || session2.data.canManageCommunicator) {
          return true;
        }
        return {
          user: { id: { equals: session2.itemId } }
        };
      },
      update: updateFilter,
      delete: updateFilter
    }
  },
  ui: {
    listView: {
      initialColumns: ["user", "question", "status", "createdAt"],
      pageSize: 50
    }
  },
  fields: {
    user: (0, import_fields5.relationship)({
      ref: "User.communicatorChats"
    }),
    question: (0, import_fields5.text)({
      validation: { isRequired: true },
      ui: {
        displayMode: "textarea"
      },
      access: resultFieldAccess
    }),
    explanation: (0, import_fields5.text)({
      ui: {
        displayMode: "textarea"
      },
      access: resultFieldAccess
    }),
    graphqlQuery: (0, import_fields5.text)({
      ui: {
        displayMode: "textarea"
      },
      access: resultFieldAccess
    }),
    errorMessage: (0, import_fields5.text)({
      ui: {
        displayMode: "textarea"
      },
      access: resultFieldAccess
    }),
    // Replaced hasError, which was text holding the strings 'true'/'false'.
    // The backfill in sql/2026-09-12-communicator-chat-backfill.sql has run and
    // been verified, so this is now the only record of the outcome.
    status: (0, import_fields5.select)({
      type: "string",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Succeeded", value: "succeeded" },
        { label: "Failed", value: "failed" }
      ],
      defaultValue: "pending",
      validation: { isRequired: true },
      isIndexed: true,
      access: resultFieldAccess
    }),
    model: (0, import_fields5.text)({
      validation: { isRequired: true },
      access: resultFieldAccess
    }),
    iterations: (0, import_fields5.integer)({ access: resultFieldAccess }),
    evaluationScore: (0, import_fields5.integer)({ access: resultFieldAccess }),
    // The two fields an owner is allowed to write, via the generic update.
    userRating: (0, import_fields5.integer)({
      defaultValue: 0,
      validation: {
        min: 0,
        max: 10
      }
    }),
    userComment: (0, import_fields5.text)({
      defaultValue: "",
      ui: {
        displayMode: "textarea"
      }
    }),
    // Raw model/query payloads can contain broad student and staff records.
    // Readable only by chat managers, and never writable through the API.
    rawData: (0, import_fields5.json)({
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      },
      access: {
        read: canManageCommunicatorChats,
        create: () => false,
        update: () => false
      }
    }),
    createdAt: (0, import_fields5.timestamp)({
      defaultValue: { kind: "now" },
      isIndexed: true,
      access: resultFieldAccess
    })
  }
});

// schemas/ChromebookCheck.ts
var import_fields6 = require("@keystone-6/core/fields");
var import_core6 = require("@keystone-6/core");
var ChromebookCheck = (0, import_core6.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      delete: isSignedIn,
      update: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["time", "student", "classroom"],
      pageSize: 100
    }
  },
  fields: {
    time: (0, import_fields6.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    student: (0, import_fields6.relationship)({
      ref: "User.chromebookCheck"
    }),
    // The teacher whose classroom the chromebook lives in. Checks are done by
    // the classroom teacher, not by the student's TA.
    classroom: (0, import_fields6.relationship)({
      ref: "User.classroomChromebookChecks"
    }),
    message: (0, import_fields6.text)()
  }
});

// schemas/Discipline.ts
var import_fields7 = require("@keystone-6/core/fields");
var import_core7 = require("@keystone-6/core");
var Discipline = (0, import_core7.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      delete: isSignedIn,
      update: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["date", "teacher", "student"],
      initialSort: { field: "date", direction: "ASC" },
      pageSize: 100
    }
  },
  fields: {
    teacherComments: (0, import_fields7.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    adminComments: (0, import_fields7.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    classType: (0, import_fields7.select)({
      options: [
        { label: "Math", value: "Math" },
        { label: "Language Arts", value: "Language Arts" },
        { label: "Science", value: "Science" },
        { label: "Social Studies", value: "Social Studies" },
        { label: "Trimester", value: "Trimester" },
        { label: "TA", value: "TA" },
        { label: "Lunch", value: "Lunch" },
        { label: "Break", value: "Break" },
        { label: "Other", value: "Other" }
      ],
      ui: {
        displayMode: "segmented-control"
        // createView: { fieldMode: 'hidden' },
      }
    }),
    location: (0, import_fields7.select)({
      options: [
        { label: "Classroom", value: "Classroom" },
        { label: "Gym", value: "Gym" },
        { label: "Library", value: "Library" },
        { label: "Cafeteria", value: "Cafeteria" },
        { label: "Hallway", value: "Hallway" },
        { label: "Bus", value: "Bus" },
        { label: "Outdoor Classroom", value: "Outdoor Classroom" },
        { label: "Other Location", value: "Other Location" },
        { label: "Break", value: "Break" }
      ],
      ui: {
        displayMode: "segmented-control"
        // createView: { fieldMode: 'hidden' },
      }
    }),
    timeOfDay: (0, import_fields7.select)({
      options: [
        { label: "Morning TA", value: "Morning TA" },
        { label: "Block 1", value: "Block 1" },
        { label: "Block 2", value: "Block 2" },
        { label: "Block 3", value: "Block 3" },
        { label: "Block 4", value: "Block 4" },
        { label: "Block 5", value: "Block 5" },
        { label: "block 6", value: "Block 6" },
        { label: "block 7", value: "Block 7" },
        { label: "block 8", value: "Block 8" },
        { label: "block 9", value: "Block 9" },
        { label: "block 10", value: "Block 10" },
        { label: "Lunch", value: "Lunch" },
        { label: "Guided Study", value: "Guided Study" },
        { label: "Afternoon TA", value: "Afternoon TA" }
      ],
      ui: {
        displayMode: "select"
        // createView: { fieldMode: 'hidden' },
      },
      isIndexed: true
    }),
    student: (0, import_fields7.relationship)({
      ref: "User.studentDiscipline"
    }),
    teacher: (0, import_fields7.relationship)({
      ref: "User.teacherDiscipline"
    }),
    date: (0, import_fields7.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    addressed: (0, import_fields7.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    inappropriateLanguage: (0, import_fields7.checkbox)(),
    physicalConduct: (0, import_fields7.checkbox)(),
    nonCompliance: (0, import_fields7.checkbox)(),
    disruption: (0, import_fields7.checkbox)(),
    propertyMisuse: (0, import_fields7.checkbox)(),
    otherConduct: (0, import_fields7.checkbox)(),
    // Teacher Actions
    VerbalWarning: (0, import_fields7.checkbox)(),
    buddyRoom: (0, import_fields7.checkbox)(),
    conferenceWithStudent: (0, import_fields7.checkbox)(),
    ParentContact: (0, import_fields7.checkbox)(),
    PlanningRoomReferral: (0, import_fields7.checkbox)(),
    FollowupPlan: (0, import_fields7.checkbox)(),
    LossOfPrivilege: (0, import_fields7.checkbox)(),
    DetentionWithTeacher: (0, import_fields7.checkbox)(),
    IndividualizedInstruction: (0, import_fields7.checkbox)(),
    GuidanceReferral: (0, import_fields7.checkbox)(),
    ReferToAdministrator: (0, import_fields7.checkbox)(),
    OtherAction: (0, import_fields7.checkbox)(),
    // Others Involved
    none: (0, import_fields7.checkbox)(),
    peers: (0, import_fields7.checkbox)(),
    teacherInvolved: (0, import_fields7.checkbox)(),
    substitute: (0, import_fields7.checkbox)(),
    unknown: (0, import_fields7.checkbox)(),
    othersInvolved: (0, import_fields7.checkbox)()
  }
});

// schemas/Link.ts
var import_fields8 = require("@keystone-6/core/fields");
var import_core8 = require("@keystone-6/core");
var Link = (0, import_core8.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: canManageLinksAccess,
      delete: canManageLinksAccess,
      update: canManageLinksAccess
    }
  },
  ui: {
    listView: {
      initialColumns: [
        "name",
        "link",
        "forTeachers",
        "forStudents",
        "forParents"
      ],
      pageSize: 100
    }
  },
  fields: {
    name: (0, import_fields8.text)({ validation: { isRequired: true } }),
    description: (0, import_fields8.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    forTeachers: (0, import_fields8.checkbox)({
      defaultValue: false,
      label: "Teachers can view"
    }),
    forStudents: (0, import_fields8.checkbox)({
      defaultValue: false,
      label: "Students can view"
    }),
    forParents: (0, import_fields8.checkbox)({
      defaultValue: false,
      label: "Parents can view"
    }),
    onHomePage: (0, import_fields8.checkbox)({
      defaultValue: false,
      label: "Display on the home page"
    }),
    forPbis: (0, import_fields8.checkbox)({
      defaultValue: false,
      label: "Display on the PBIS page"
    }),
    forEPortfolio: (0, import_fields8.checkbox)({
      defaultValue: false,
      label: "Display on the ePortfolio page"
    }),
    modifiedBy: (0, import_fields8.relationship)({
      ref: "User"
    }),
    modified: (0, import_fields8.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    link: (0, import_fields8.text)()
  }
});

// schemas/Message.ts
var import_fields9 = require("@keystone-6/core/fields");
var import_core9 = require("@keystone-6/core");
var Message = (0, import_core9.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      delete: isSignedIn,
      update: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["subject", "receiver", "sent"],
      pageSize: 100
    }
  },
  fields: {
    subject: (0, import_fields9.text)(),
    message: (0, import_fields9.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    sender: (0, import_fields9.relationship)({
      ref: "User.messageSender"
    }),
    receiver: (0, import_fields9.relationship)({
      ref: "User.messageReceiver"
    }),
    sent: (0, import_fields9.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    read: (0, import_fields9.checkbox)({ defaultValue: false, label: "Read" }),
    link: (0, import_fields9.text)()
  }
});

// schemas/PbisCard.ts
var import_fields10 = require("@keystone-6/core/fields");
var import_core10 = require("@keystone-6/core");
var PbisCard = (0, import_core10.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      delete: isSignedIn,
      update: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["category", "teacher", "student"],
      pageSize: 200
    }
  },
  fields: {
    category: (0, import_fields10.text)({
      isIndexed: true
    }),
    cardMessage: (0, import_fields10.text)({
      ui: {
        displayMode: "textarea"
      },
      isIndexed: true
    }),
    student: (0, import_fields10.relationship)({
      ref: "User.studentPbisCards"
    }),
    teacher: (0, import_fields10.relationship)({
      ref: "User.teacherPbisCards"
    }),
    dateGiven: (0, import_fields10.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    counted: (0, import_fields10.checkbox)({ defaultValue: false, label: "Counted" })
  }
});

// schemas/StaffPbisCard.ts
var import_core11 = require("@keystone-6/core");
var import_fields11 = require("@keystone-6/core/fields");
var STAFF_CARD_DAILY_LIMIT_FOR_STUDENTS = 3;
function startOfTodayISO() {
  const now = /* @__PURE__ */ new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}
var StaffPbisCard = (0, import_core11.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      delete: isAdmin,
      update: isAdmin
    }
  },
  ui: {
    isHidden: !isAdmin,
    listView: {
      initialColumns: ["recipient", "giver", "dateGiven"],
      initialSort: { field: "dateGiven", direction: "DESC" },
      pageSize: 200
    }
  },
  hooks: {
    validateInput: async ({
      operation,
      resolvedData,
      context,
      addValidationError
    }) => {
      if (operation !== "create") return;
      const message = resolvedData?.cardMessage;
      if (!message || String(message).trim() === "") {
        addValidationError("A comment is required to give a staff PBIS card.");
      }
      const giverId = resolvedData?.giver?.connect?.id;
      if (!giverId) return;
      const giver = await context.sudo().query.User.findOne({
        where: { id: giverId },
        query: "id isStudent"
      });
      if (giver?.isStudent) {
        const todaysCount = await context.sudo().query.StaffPbisCard.count({
          where: {
            giver: { id: { equals: giverId } },
            dateGiven: { gte: startOfTodayISO() }
          }
        });
        if (todaysCount >= STAFF_CARD_DAILY_LIMIT_FOR_STUDENTS) {
          addValidationError(
            `Students can give at most ${STAFF_CARD_DAILY_LIMIT_FOR_STUDENTS} staff cards per day.`
          );
        }
      }
    }
  },
  fields: {
    category: (0, import_fields11.text)({ isIndexed: true }),
    giver: (0, import_fields11.relationship)({ ref: "User.staffPbisCardsGiven" }),
    recipient: (0, import_fields11.relationship)({ ref: "User.staffPbisCardsReceived" }),
    cardMessage: (0, import_fields11.text)({
      ui: { displayMode: "textarea" },
      isIndexed: true
    }),
    dateGiven: (0, import_fields11.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    counted: (0, import_fields11.checkbox)({ defaultValue: false, label: "Counted" })
  }
});

// schemas/PbisCollectionDate.ts
var import_fields12 = require("@keystone-6/core/fields");
var import_core12 = require("@keystone-6/core");
var PbisCollectionDate = (0, import_core12.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      delete: isSignedIn,
      update: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["collectionDate", "collectedCards"],
      pageSize: 100
    }
  },
  fields: {
    collectionDate: (0, import_fields12.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    randomDrawingWinners: (0, import_fields12.relationship)({
      ref: "RandomDrawingWin.collectionDate",
      many: true
    }),
    personalLevelWinners: (0, import_fields12.relationship)({
      ref: "User",
      many: true
    }),
    taNewLevelWinners: (0, import_fields12.relationship)({
      ref: "User",
      many: true
    }),
    staffRandomWinners: (0, import_fields12.relationship)({
      ref: "User",
      many: true
    }),
    collectedCards: (0, import_fields12.text)(),
    lastModifiedBy: (0, import_fields12.relationship)({ ref: "User" })
  }
});

// schemas/RandomDrawingWin.ts
var import_fields13 = require("@keystone-6/core/fields");
var import_core13 = require("@keystone-6/core");
var RandomDrawingWin = (0, import_core13.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      delete: isSignedIn,
      update: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["student", "collectionDate"],
      pageSize: 100
    }
  },
  fields: {
    student: (0, import_fields13.relationship)({
      ref: "User.randomDrawingWins"
    }),
    collectionDate: (0, import_fields13.relationship)({
      ref: "PbisCollectionDate.randomDrawingWinners",
      many: false
    }),
    lastModifiedBy: (0, import_fields13.relationship)({ ref: "User" })
  }
});

// schemas/StudentFocus.ts
var import_fields14 = require("@keystone-6/core/fields");
var import_core14 = require("@keystone-6/core");
var StudentFocus = (0, import_core14.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      delete: isSignedIn,
      update: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["category", "teacher", "student"],
      pageSize: 100
    }
  },
  fields: {
    comments: (0, import_fields14.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    category: (0, import_fields14.text)(),
    student: (0, import_fields14.relationship)({
      ref: "User.studentFocusStudent"
    }),
    teacher: (0, import_fields14.relationship)({
      ref: "User.studentFocusTeacher"
    }),
    dateCreated: (0, import_fields14.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    })
  }
});

// schemas/User.ts
var import_core15 = require("@keystone-6/core");
var import_fields16 = require("@keystone-6/core/fields");

// schemas/fields.ts
var import_fields15 = require("@keystone-6/core/fields");
var permissionFields = {
  canManageCalendar: (0, import_fields15.checkbox)({
    defaultValue: false,
    label: "User can Update and delete any  Calendar Event"
  }),
  canSeeOtherUsers: (0, import_fields15.checkbox)({
    defaultValue: false,
    label: "User can query other users"
  }),
  canManageUsers: (0, import_fields15.checkbox)({
    defaultValue: false,
    label: "User can Edit other users"
  }),
  canManageRoles: (0, import_fields15.checkbox)({
    defaultValue: false,
    label: "User can CRUD roles"
  }),
  canManageLinks: (0, import_fields15.checkbox)({
    defaultValue: false,
    label: "User can see and manage Links"
  }),
  canManageDiscipline: (0, import_fields15.checkbox)({
    defaultValue: false,
    label: "User can see and manage Discipline Referrals"
  }),
  canSeeAllDiscipline: (0, import_fields15.checkbox)({
    defaultValue: false,
    label: "User can see Referrals"
  }),
  canSeeAllTeacherEvents: (0, import_fields15.checkbox)({
    defaultValue: false,
    label: "User can see TeacherEvents"
  }),
  canSeeStudentEvents: (0, import_fields15.checkbox)({
    defaultValue: false,
    label: "User can see Student Events"
  }),
  canSeeOwnCallback: (0, import_fields15.checkbox)({
    defaultValue: false,
    label: "User can see own callback"
  }),
  canSeeAllCallback: (0, import_fields15.checkbox)({
    defaultValue: false,
    label: "User can see all callback"
  }),
  hasTA: (0, import_fields15.checkbox)({
    defaultValue: false,
    label: "User has a TA"
  }),
  hasClasses: (0, import_fields15.checkbox)({
    defaultValue: false,
    label: "User teaches classes"
  }),
  isStudent: (0, import_fields15.checkbox)({
    defaultValue: false,
    label: "User is a student"
  }),
  isParent: (0, import_fields15.checkbox)({
    defaultValue: false,
    label: "User is a parent"
  }),
  isStaff: (0, import_fields15.checkbox)({
    defaultValue: false,
    label: "User is a staff member"
  }),
  isTeacher: (0, import_fields15.checkbox)({
    defaultValue: false,
    label: "User is a teacher"
  }),
  isGuidance: (0, import_fields15.checkbox)({
    defaultValue: false,
    label: "User is Guidance"
  }),
  isSuperAdmin: (0, import_fields15.checkbox)({
    defaultValue: false,
    label: "User is a super admin"
  }),
  canManagePbis: (0, import_fields15.checkbox)({
    defaultValue: false,
    label: "User can manage PBIS"
  }),
  canHaveSpecialGroups: (0, import_fields15.checkbox)({
    defaultValue: false,
    label: "User can have special groups"
  }),
  isCommunicatorEnabled: (0, import_fields15.checkbox)({
    defaultValue: false,
    label: "User can access Communicator AI chat"
  }),
  canManageCommunicator: (0, import_fields15.checkbox)({
    defaultValue: false,
    label: "User can see and moderate all Communicator chats"
  })
};
var permissionsList = Object.keys(
  permissionFields
);

// schemas/blocks.ts
var NUMBER_OF_BLOCKS = 12;

// schemas/User.ts
var User = (0, import_core15.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      delete: isSignedIn,
      update: isSignedIn
    }
  },
  ui: {
    // hide the backend UI from regular users
    isHidden: !isAdmin,
    hideDelete: !isAdmin,
    description: "Users of the site",
    listView: {
      initialColumns: ["name", "email", "taTeacher"],
      pageSize: 100
    }
  },
  fields: {
    name: (0, import_fields16.text)({ isIndexed: true, validation: { isRequired: true } }),
    preferredName: (0, import_fields16.text)(),
    email: (0, import_fields16.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    password: (0, import_fields16.password)({ validation: { isRequired: true } }),
    taStudents: (0, import_fields16.relationship)({ ref: "User.taTeacher", many: true }),
    taTeacher: (0, import_fields16.relationship)({ ref: "User.taStudents", many: false }),
    parent: (0, import_fields16.relationship)({ ref: "User.children", many: true }),
    children: (0, import_fields16.relationship)({ ref: "User.parent", many: true }),
    ...permissionFields,
    //classes
    block1Teacher: (0, import_fields16.relationship)({ ref: "User.block1Students", many: false }),
    block1Students: (0, import_fields16.relationship)({ ref: "User.block1Teacher", many: true }),
    block2Teacher: (0, import_fields16.relationship)({ ref: "User.block2Students", many: false }),
    block2Students: (0, import_fields16.relationship)({ ref: "User.block2Teacher", many: true }),
    block3Teacher: (0, import_fields16.relationship)({ ref: "User.block3Students", many: false }),
    block3Students: (0, import_fields16.relationship)({ ref: "User.block3Teacher", many: true }),
    block4Teacher: (0, import_fields16.relationship)({ ref: "User.block4Students", many: false }),
    block4Students: (0, import_fields16.relationship)({ ref: "User.block4Teacher", many: true }),
    block5Teacher: (0, import_fields16.relationship)({ ref: "User.block5Students", many: false }),
    block5Students: (0, import_fields16.relationship)({ ref: "User.block5Teacher", many: true }),
    block6Teacher: (0, import_fields16.relationship)({ ref: "User.block6Students", many: false }),
    block6Students: (0, import_fields16.relationship)({ ref: "User.block6Teacher", many: true }),
    block7Teacher: (0, import_fields16.relationship)({ ref: "User.block7Students", many: false }),
    block7Students: (0, import_fields16.relationship)({ ref: "User.block7Teacher", many: true }),
    block8Teacher: (0, import_fields16.relationship)({ ref: "User.block8Students", many: false }),
    block8Students: (0, import_fields16.relationship)({ ref: "User.block8Teacher", many: true }),
    block9Teacher: (0, import_fields16.relationship)({ ref: "User.block9Students", many: false }),
    block9Students: (0, import_fields16.relationship)({ ref: "User.block9Teacher", many: true }),
    block10Teacher: (0, import_fields16.relationship)({
      ref: "User.block10Students",
      many: false
    }),
    block10Students: (0, import_fields16.relationship)({
      ref: "User.block10Teacher",
      many: true
    }),
    block11Teacher: (0, import_fields16.relationship)({
      ref: "User.block11Students",
      many: false
    }),
    block11Students: (0, import_fields16.relationship)({
      ref: "User.block11Teacher",
      many: true
    }),
    block12Teacher: (0, import_fields16.relationship)({
      ref: "User.block12Students",
      many: false
    }),
    block12Students: (0, import_fields16.relationship)({
      ref: "User.block12Teacher",
      many: true
    }),
    specialGroupStudents: (0, import_fields16.relationship)({ ref: "User", many: true }),
    coTeachesWithTeacher: (0, import_fields16.relationship)({ ref: "User", many: true }),
    //other relationships
    studentFocusTeacher: (0, import_fields16.relationship)({
      ref: "StudentFocus.teacher",
      many: true
    }),
    studentFocusStudent: (0, import_fields16.relationship)({
      ref: "StudentFocus.student",
      many: true
    }),
    studentCellPhoneViolation: (0, import_fields16.relationship)({
      ref: "CellPhoneViolation.student",
      many: true
    }),
    teacherCellPhoneViolation: (0, import_fields16.relationship)({
      ref: "CellPhoneViolation.teacher",
      many: true
    }),
    teacherPbisCards: (0, import_fields16.relationship)({ ref: "PbisCard.teacher", many: true }),
    studentPbisCards: (0, import_fields16.relationship)({
      ref: "PbisCard.student",
      many: true,
      ui: {
        displayMode: "count"
      }
    }),
    staffPbisCardsGiven: (0, import_fields16.relationship)({
      ref: "StaffPbisCard.giver",
      many: true
    }),
    staffPbisCardsReceived: (0, import_fields16.relationship)({
      ref: "StaffPbisCard.recipient",
      many: true,
      ui: {
        displayMode: "count"
      }
    }),
    teacherDiscipline: (0, import_fields16.relationship)({ ref: "Discipline.teacher", many: true }),
    studentDiscipline: (0, import_fields16.relationship)({ ref: "Discipline.student", many: true }),
    callbackItems: (0, import_fields16.relationship)({ ref: "Callback.student", many: true }),
    callbackAssigned: (0, import_fields16.relationship)({ ref: "Callback.teacher", many: true }),
    messageSender: (0, import_fields16.relationship)({ ref: "Message.sender", many: true }),
    messageReceiver: (0, import_fields16.relationship)({ ref: "Message.receiver", many: true }),
    communicatorChats: (0, import_fields16.relationship)({
      ref: "CommunicatorChat.user",
      many: true
    }),
    randomDrawingWins: (0, import_fields16.relationship)({
      ref: "RandomDrawingWin.student",
      many: true
    }),
    birthday: (0, import_fields16.relationship)({ ref: "Birthday.student", many: false }),
    individualPbisLevel: (0, import_fields16.integer)({ defaultValue: 0 }),
    taTeamPbisLevel: (0, import_fields16.integer)({ defaultValue: 0 }),
    taTeamAveragePbisCardsPerStudent: (0, import_fields16.integer)({ defaultValue: 0 }),
    chromebookCheck: (0, import_fields16.relationship)({
      ref: "ChromebookCheck.student",
      many: true
    }),
    // Checks performed on chromebooks kept in this teacher's classroom
    classroomChromebookChecks: (0, import_fields16.relationship)({
      ref: "ChromebookCheck.classroom",
      many: true
    }),
    // Important Info
    callbackCount: (0, import_fields16.integer)({ defaultValue: 0 }),
    totalCallbackCount: (0, import_fields16.integer)({ defaultValue: 0 }),
    teacherSubject: (0, import_fields16.text)({ defaultValue: void 0 }),
    averageTimeToCompleteCallback: (0, import_fields16.integer)(),
    // assignments
    block1Assignment: (0, import_fields16.text)({
      defaultValue: "Current Assignment for Block 1 goes here"
    }),
    block1ClassName: (0, import_fields16.text)({ defaultValue: "Class Name Goes Here" }),
    block1AssignmentLastUpdated: (0, import_fields16.timestamp)(),
    block2Assignment: (0, import_fields16.text)({
      defaultValue: "Current Assignment for Block 2 goes here"
    }),
    block2ClassName: (0, import_fields16.text)({ defaultValue: "Class Name Goes Here" }),
    block2AssignmentLastUpdated: (0, import_fields16.timestamp)(),
    block3Assignment: (0, import_fields16.text)({
      defaultValue: "Current Assignment for Block 3 goes here"
    }),
    block3ClassName: (0, import_fields16.text)({ defaultValue: "Class Name Goes Here" }),
    block3AssignmentLastUpdated: (0, import_fields16.timestamp)(),
    block4Assignment: (0, import_fields16.text)({
      defaultValue: "Current Assignment for Block 4 goes here"
    }),
    block4ClassName: (0, import_fields16.text)({ defaultValue: "Class Name Goes Here" }),
    block4AssignmentLastUpdated: (0, import_fields16.timestamp)(),
    block5Assignment: (0, import_fields16.text)({
      defaultValue: "Current Assignment for Block 5 goes here"
    }),
    block5ClassName: (0, import_fields16.text)({ defaultValue: "Class Name Goes Here" }),
    block5AssignmentLastUpdated: (0, import_fields16.timestamp)(),
    block6Assignment: (0, import_fields16.text)({
      defaultValue: "Current Assignment for Block 6 goes here"
    }),
    block6ClassName: (0, import_fields16.text)({ defaultValue: "Class Name Goes Here" }),
    block6AssignmentLastUpdated: (0, import_fields16.timestamp)(),
    block7Assignment: (0, import_fields16.text)({
      defaultValue: "Current Assignment for Block 7 goes here"
    }),
    block7ClassName: (0, import_fields16.text)({ defaultValue: "Class Name Goes Here" }),
    block7AssignmentLastUpdated: (0, import_fields16.timestamp)(),
    block8Assignment: (0, import_fields16.text)({
      defaultValue: "Current Assignment for Block 8 goes here"
    }),
    block8ClassName: (0, import_fields16.text)({ defaultValue: "Class Name Goes Here" }),
    block8AssignmentLastUpdated: (0, import_fields16.timestamp)(),
    block9Assignment: (0, import_fields16.text)({
      defaultValue: "Current Assignment for Block 9 goes here"
    }),
    block9ClassName: (0, import_fields16.text)({ defaultValue: "Class Name Goes Here" }),
    block9AssignmentLastUpdated: (0, import_fields16.timestamp)(),
    block10Assignment: (0, import_fields16.text)({
      defaultValue: "Current Assignment for Block 10 goes here"
    }),
    block10ClassName: (0, import_fields16.text)({ defaultValue: "Class Name Goes Here" }),
    block10AssignmentLastUpdated: (0, import_fields16.timestamp)(),
    block11Assignment: (0, import_fields16.text)({
      defaultValue: "Current Assignment for Block 11 goes here"
    }),
    block11ClassName: (0, import_fields16.text)({ defaultValue: "Class Name Goes Here" }),
    block11AssignmentLastUpdated: (0, import_fields16.timestamp)(),
    block12Assignment: (0, import_fields16.text)({
      defaultValue: "Current Assignment for Block 12 goes here"
    }),
    block12ClassName: (0, import_fields16.text)({ defaultValue: "Class Name Goes Here" }),
    block12AssignmentLastUpdated: (0, import_fields16.timestamp)(),
    // Archive of this teacher's replaced class assignments
    assignmentHistory: (0, import_fields16.relationship)({
      ref: "AssignmentHistory.teacher",
      many: true
    }),
    // Sorting Hat
    sortingHat: (0, import_fields16.text)({ defaultValue: "" })
  },
  hooks: {
    afterOperation: async ({ operation, item, originalItem, context }) => {
      if (operation === "create" && item?.isStudent) {
        const createBirtday = await context.query.Birthday.createOne({
          data: {
            student: { connect: { id: item.id } }
          }
          // resolveFields: "id",
        });
      }
      if (operation === "update" && item && originalItem) {
        for (let n = 1; n <= NUMBER_OF_BLOCKS; n++) {
          const oldVal = originalItem[`block${n}Assignment`];
          const newVal = item[`block${n}Assignment`];
          if (oldVal != null && oldVal !== newVal) {
            await context.sudo().query.AssignmentHistory.createOne({
              data: {
                teacher: { connect: { id: item.id } },
                block: n,
                className: originalItem[`block${n}ClassName`] ?? "",
                assignment: oldVal,
                dateAdded: originalItem[`block${n}AssignmentLastUpdated`] ?? null
                // dateRemoved defaults to now
              }
            });
          }
        }
      }
    }
  }
});

// schemas/AssignmentHistory.ts
var import_core16 = require("@keystone-6/core");
var import_fields18 = require("@keystone-6/core/fields");
var AssignmentHistory = (0, import_core16.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isAdmin,
      delete: isAdmin,
      update: isAdmin
    }
  },
  ui: {
    isHidden: !isAdmin,
    listView: {
      initialColumns: ["teacher", "block", "className", "dateRemoved"],
      initialSort: { field: "dateRemoved", direction: "DESC" },
      pageSize: 100
    }
  },
  fields: {
    teacher: (0, import_fields18.relationship)({ ref: "User.assignmentHistory", many: false }),
    block: (0, import_fields18.integer)(),
    className: (0, import_fields18.text)(),
    assignment: (0, import_fields18.text)({ ui: { displayMode: "textarea" } }),
    // When this (now-archived) assignment had originally been set.
    dateAdded: (0, import_fields18.timestamp)(),
    // When it was replaced by a new assignment.
    dateRemoved: (0, import_fields18.timestamp)({
      defaultValue: { kind: "now" }
    })
  }
});

// schemas/Birthday.ts
var import_fields19 = require("@keystone-6/core/fields");
var import_core17 = require("@keystone-6/core");
var Birthday = (0, import_core17.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      delete: isSignedIn,
      update: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["student", "cakeType"],
      initialSort: { field: "date", direction: "ASC" },
      pageSize: 100
    }
  },
  fields: {
    cakeType: (0, import_fields19.text)(),
    date: (0, import_fields19.timestamp)({
      // validation: {isRequired: true},
      isIndexed: true
    }),
    hasChosen: (0, import_fields19.checkbox)({
      defaultValue: false,
      label: "Has Chosen a Cake"
    }),
    hasDelivered: (0, import_fields19.checkbox)({
      defaultValue: false,
      label: "Has gotten their cake"
    }),
    student: (0, import_fields19.relationship)({
      ref: "User.birthday"
    })
  }
});

// schemas/BugReport.ts
var import_fields20 = require("@keystone-6/core/fields");
var import_core18 = require("@keystone-6/core");
var BugReport = (0, import_core18.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      delete: isSignedIn,
      update: isSignedIn
    }
  },
  hooks: {
    // Mirror anything a user reports here into Bugsink so it lands in the
    // same place as the errors the server catches on its own. Never throws,
    // so a Bugsink outage cannot block someone filing a report.
    afterOperation: {
      create: async ({ item }) => {
        reportUserBug({
          title: String(item.name),
          description: item.description ? String(item.description) : void 0,
          submittedById: item.submittedById ? String(item.submittedById) : void 0
        });
      }
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "description", "submittedBy"],
      initialSort: { field: "date", direction: "ASC" },
      pageSize: 100
    }
  },
  fields: {
    name: (0, import_fields20.text)({ validation: { isRequired: true } }),
    description: (0, import_fields20.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    submittedBy: (0, import_fields20.relationship)({
      ref: "User"
    }),
    date: (0, import_fields20.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    read: (0, import_fields20.checkbox)({ defaultValue: false })
  }
});

// schemas/Bullying.ts
var import_fields21 = require("@keystone-6/core/fields");
var import_core19 = require("@keystone-6/core");
var Bullying = (0, import_core19.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      delete: isSignedIn,
      update: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["dateOfEvent", "studentOffender", "teacherAuthor"],
      initialSort: { field: "dateOfEvent", direction: "ASC" },
      pageSize: 100
    }
  },
  fields: {
    studentOffender: (0, import_fields21.relationship)({
      ref: "User"
    }),
    teacherAuthor: (0, import_fields21.relationship)({
      ref: "User"
    }),
    dateReported: (0, import_fields21.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    dateOfEvent: (0, import_fields21.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    investigationDate: (0, import_fields21.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    studentReporter: (0, import_fields21.text)(),
    employeeWitness: (0, import_fields21.text)(),
    studentWitness: (0, import_fields21.text)(),
    studentsInterviewed: (0, import_fields21.text)(),
    initialActions: (0, import_fields21.text)(),
    nextSteps: (0, import_fields21.text)(),
    reporter: (0, import_fields21.text)(),
    description: (0, import_fields21.text)(),
    determination: (0, import_fields21.select)({
      options: [
        { value: "No", label: "No" },
        { value: "Yes", label: "Yes" }
      ]
    }),
    determinationDate: (0, import_fields21.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    determinationExplanation: (0, import_fields21.text)(),
    assignmentInvestigator: (0, import_fields21.text)()
  }
});

// schemas/SortingHatQuestion.ts
var import_fields22 = require("@keystone-6/core/fields");
var import_core20 = require("@keystone-6/core");
var SortingHatQuestion = (0, import_core20.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      delete: isSignedIn,
      update: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["createdBy", "question"],
      pageSize: 100
    }
  },
  fields: {
    question: (0, import_fields22.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    gryffindorChoice: (0, import_fields22.text)(),
    hufflepuffChoice: (0, import_fields22.text)(),
    ravenclawChoice: (0, import_fields22.text)(),
    slytherinChoice: (0, import_fields22.text)(),
    createdBy: (0, import_fields22.relationship)({
      ref: "User"
    })
  }
});

// schemas/TrimesterAward.ts
var import_fields23 = require("@keystone-6/core/fields");
var import_core21 = require("@keystone-6/core");
var TrimesterAward = (0, import_core21.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      delete: isSignedIn,
      update: isSignedIn
    }
  },
  ui: {
    labelField: "teacher",
    listView: {
      initialColumns: ["howl", "teacher", "student", "trimester"],
      pageSize: 100
    }
  },
  fields: {
    howl: (0, import_fields23.select)({
      options: [
        { value: "Respect", label: "Respect" },
        { value: "Responsibility", label: "Responsibility" },
        { value: "Perseverance", label: "Perseverance" }
      ],
      validation: { isRequired: true }
    }),
    trimester: (0, import_fields23.select)({
      options: [
        { value: "1", label: "1" },
        { value: "2", label: "2" },
        { value: "3", label: "3" }
      ],
      isIndexed: true
    }),
    date: (0, import_fields23.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    student: (0, import_fields23.relationship)({
      ref: "User"
    }),
    teacher: (0, import_fields23.relationship)({
      ref: "User"
    })
  }
});

// schemas/video.ts
var import_fields24 = require("@keystone-6/core/fields");
var import_core22 = require("@keystone-6/core");
var Video = (0, import_core22.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      delete: isSignedIn,
      update: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "type", "link"],
      pageSize: 100
    }
  },
  fields: {
    name: (0, import_fields24.text)({ validation: { isRequired: true } }),
    description: (0, import_fields24.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    onHomePage: (0, import_fields24.checkbox)({ defaultValue: false, label: "On Home Page" }),
    type: (0, import_fields24.select)({
      options: [
        { value: "google drive", label: "google drive" },
        { value: "youtube", label: "Youtube" }
      ],
      validation: { isRequired: true }
    }),
    link: (0, import_fields24.text)()
  }
});

// mutations/AddStaff.ts
var import_core23 = require("@keystone-6/core");
var gql = String.raw;
var addStaff = (base) => import_core23.graphql.field({
  type: import_core23.graphql.String,
  args: {
    staffData: import_core23.graphql.arg({ type: import_core23.graphql.JSON })
  },
  resolve: async (source, args, context) => {
    console.log("Adding Staff");
    const allStaffUpdateResults = [];
    if (!args.staffData || typeof args.staffData === "string") return null;
    const staffDataList = args.staffData;
    await Promise.all(
      staffDataList.map(async (staffMember) => {
        const studentUpdateResults = {};
        const studentInfo = await context.query.User.findMany({
          where: { email: { equals: staffMember.email.toLowerCase() } },
          query: gql`
              id
              email
              name
          `
        });
        studentUpdateResults.email = staffMember.email.toLowerCase();
        if (!studentInfo[0]?.id) {
          console.log(`Creating new user ${staffMember.email}`);
          const nameArray = staffMember.email.split("@")[0].split(".");
          studentUpdateResults.name = nameArray.join(" ");
          studentUpdateResults.isStudent = false;
          studentUpdateResults.canManageCalendar = true;
          studentUpdateResults.canSeeOtherUsers = true;
          studentUpdateResults.canManageUsers = true;
          studentUpdateResults.canManageRoles = true;
          studentUpdateResults.canManageLinks = true;
          studentUpdateResults.canManageDiscipline = false;
          studentUpdateResults.canSeeAllDiscipline = false;
          studentUpdateResults.canSeeAllTeacherEvents = true;
          studentUpdateResults.canSeeStudentEvents = false;
          studentUpdateResults.canSeeOwnCallback = true;
          studentUpdateResults.canSeeAllCallback = true;
          studentUpdateResults.hasTA = staffMember.hasta ? true : false;
          studentUpdateResults.hasClasses = staffMember.hasclasses ? true : false;
          studentUpdateResults.isStaff = true;
          studentUpdateResults.isTeacher = staffMember.isteacher ? true : false;
          studentUpdateResults.password = "notPassword";
          const createdStudent = await context.query.User.createOne({
            data: {
              ...studentUpdateResults
            }
          });
        }
        studentUpdateResults.existed = !!studentInfo[0];
        allStaffUpdateResults.push(studentUpdateResults);
      })
    );
    const name = JSON.stringify(allStaffUpdateResults);
    return name;
  }
});

// mutations/authenticateWithGoogle.ts
var import_core24 = require("@keystone-6/core");
var import_google_auth_library = require("google-auth-library");
var CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
var client = new import_google_auth_library.OAuth2Client();
var authenticateUserWithGoogle = (base) => import_core24.graphql.field({
  type: import_core24.graphql.JSON,
  args: {
    idToken: import_core24.graphql.arg({ type: import_core24.graphql.nonNull(import_core24.graphql.String) })
  },
  // Cast to any: the resolver returns a small JSON object, but the inferred
  // union of branches includes optional `undefined` props which the strict
  // JSONValue type rejects. The runtime shape is valid JSON.
  resolve: async (source, { idToken }, context) => {
    if (!CLIENT_ID) {
      console.error(
        "[auth] authenticateUserWithGoogle: GOOGLE_OAUTH_CLIENT_ID is not set"
      );
      return { success: false, message: "Google sign-in is not configured" };
    }
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: CLIENT_ID
      });
      payload = ticket.getPayload();
    } catch {
      console.warn("[auth] Google ID token verification failed");
      return { success: false, message: "Invalid Google sign-in" };
    }
    if (!payload?.email || payload.email_verified !== true) {
      return {
        success: false,
        message: "Your Google account email is not verified"
      };
    }
    const email = payload.email.toLowerCase();
    const user = await context.sudo().query.User.findOne({
      where: { email },
      query: "id name email"
    });
    if (!user) {
      console.log("[auth] Google sign-in: no account for", email, {
        hd: payload.hd
      });
      return {
        success: false,
        message: "No account found for this Google email"
      };
    }
    const sessionToken = await context.sessionStrategy?.start({
      data: { listKey: "User", itemId: String(user.id) },
      context
    });
    if (!sessionToken || typeof sessionToken !== "string") {
      console.error("[auth] Google sign-in: failed to start session");
      captureError(
        new Error("Google sign-in: sessionStrategy.start returned no token"),
        {
          tags: { mutation: "authenticateUserWithGoogle" },
          userId: String(user.id)
        }
      );
      return { success: false, message: "Could not start session" };
    }
    return {
      success: true,
      sessionToken,
      item: { id: user.id, name: user.name, email: user.email }
    };
  }
});

// mutations/impersonateUser.ts
var import_core25 = require("@keystone-6/core");
var impersonateUser = (base) => import_core25.graphql.field({
  type: import_core25.graphql.JSON,
  args: {
    userId: import_core25.graphql.arg({ type: import_core25.graphql.nonNull(import_core25.graphql.String) })
  },
  resolve: async (source, { userId }, context) => {
    if (process.env.NODE_ENV === "production") {
      return { success: false, message: "Impersonation is disabled" };
    }
    if (process.env.ALLOW_IMPERSONATION !== "true") {
      return { success: false, message: "Impersonation is disabled" };
    }
    if (!context.session?.data?.isSuperAdmin) {
      return {
        success: false,
        message: "Only superadmins can impersonate users"
      };
    }
    const user = await context.sudo().query.User.findOne({
      where: { id: String(userId) },
      query: "id name email"
    });
    if (!user) {
      return { success: false, message: "User not found" };
    }
    const sessionToken = await context.sessionStrategy?.start({
      data: { listKey: "User", itemId: String(user.id) },
      context
    });
    if (!sessionToken || typeof sessionToken !== "string") {
      return { success: false, message: "Could not start session" };
    }
    console.log(
      `[impersonate] ${context.session?.itemId} -> ${user.id} (${user.email})`
    );
    return {
      success: true,
      sessionToken,
      item: { id: user.id, name: user.name, email: user.email }
    };
  }
});

// mutations/queryCommunicator.ts
var import_core26 = require("@keystone-6/core");

// lib/communicator/graphqlExecutor.ts
var import_fs = require("fs");
var import_path = require("path");
var SCHEMA_PATH = (0, import_path.join)(process.cwd(), "lib", "communicator", "schema.graphql");
var SCHEMA_CACHE_TTL = 5 * 60 * 1e3;
var cachedSchema = null;
var cachedAt = 0;
function loadCommunicatorSchema(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedSchema && now - cachedAt < SCHEMA_CACHE_TTL) {
    return cachedSchema;
  }
  try {
    cachedSchema = (0, import_fs.readFileSync)(SCHEMA_PATH, "utf-8");
    cachedAt = now;
    return cachedSchema;
  } catch (error) {
    throw new Error(
      `Could not load the Communicator GraphQL schema from ${SCHEMA_PATH}`
    );
  }
}
var CallerScopedGraphQL = class {
  constructor(context) {
    this.context = context;
  }
  async query(request) {
    const result = await this.context.graphql.raw({
      query: request.query,
      variables: request.variables
    });
    return {
      data: result.data,
      errors: result.errors?.map((e) => ({
        message: e.message,
        locations: e.locations,
        path: e.path?.map((p) => String(p)),
        extensions: e.extensions
      }))
    };
  }
  async getSchema(forceRefresh = false) {
    return loadCommunicatorSchema(forceRefresh);
  }
};

// lib/communicator/lmStudio.ts
var LM_STUDIO_ENDPOINT = process.env.LM_STUDIO_ENDPOINT;
function requireEndpoint() {
  if (!LM_STUDIO_ENDPOINT) {
    throw new Error(
      "LM_STUDIO_ENDPOINT is not configured. Set it to the OpenAI-compatible base URL of your LM Studio server, e.g. http://10.0.0.156:1234/v1"
    );
  }
  return LM_STUDIO_ENDPOINT;
}
var DEFAULT_COMMUNICATOR_MODEL = "openai/gpt-oss-120b";
function getCommunicatorModel() {
  const configured = process.env.COMMUNICATOR_MODEL?.trim();
  return configured || DEFAULT_COMMUNICATOR_MODEL;
}
var LMStudioClient = class {
  // Resolved lazily, not in the constructor: this class is exported as a
  // singleton, so throwing at construction would take the whole server down at
  // import time instead of failing the one request that needs it.
  get baseUrl() {
    return requireEndpoint();
  }
  // REST API endpoint doesn't use the /v1 prefix, so strip it if present
  get restApiBaseUrl() {
    return this.baseUrl.replace(/\/v1\/?$/, "");
  }
  /**
   * Get available models from LM Studio (OpenAI-compatible endpoint)
   * Returns empty array if LM Studio is down
   */
  async getModels() {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      });
      if (!response.ok) {
        console.error("LM Studio models request failed:", response.statusText);
        return [];
      }
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error("Failed to fetch models from LM Studio:", error);
      return [];
    }
  }
  /**
   * Get available models with token limits from LM Studio REST API
   * Uses the /api/v0/models endpoint which includes max_context_length
   * Falls back to OpenAI-compatible endpoint if REST API fails
   */
  async getModelsWithLimits() {
    try {
      const response = await fetch(`${this.restApiBaseUrl}/api/v0/models`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      });
      if (response.ok) {
        const data = await response.json();
        return data.data || [];
      }
      console.warn(
        "LM Studio REST API not available, falling back to OpenAI-compatible endpoint"
      );
      const openaiModels = await this.getModels();
      return openaiModels.map((model) => ({
        id: model.id,
        object: model.object,
        type: "llm",
        max_context_length: 0
        // Unknown from OpenAI-compatible endpoint
      }));
    } catch (error) {
      console.error(
        "Failed to fetch models with limits from LM Studio:",
        error
      );
      try {
        const openaiModels = await this.getModels();
        return openaiModels.map((model) => ({
          id: model.id,
          object: model.object,
          type: "llm",
          max_context_length: 0
          // Unknown from OpenAI-compatible endpoint
        }));
      } catch (fallbackError) {
        console.error("Fallback also failed:", fallbackError);
        return [];
      }
    }
  }
  /**
   * Send a chat completion request to LM Studio
   */
  async chatCompletion(request) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `LM Studio request failed: ${response.statusText}. ${errorText}`
      );
    }
    return await response.json();
  }
  /**
   * Helper method for simple text completions
   */
  async complete(model, prompt, systemPrompt, temperature = 0.7, maxTokens) {
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });
    const response = await this.chatCompletion({
      model,
      messages,
      temperature,
      ...maxTokens && { max_tokens: maxTokens }
    });
    return response.choices[0]?.message?.content || "";
  }
  /**
   * Chat completion with tool calling support
   */
  async chatCompletionWithTools(request) {
    return this.chatCompletion(request);
  }
};
var lmStudio = new LMStudioClient();

// lib/communicator/queryGenerator.ts
var EVALUATE_RESPONSE_TOOL = {
  type: "function",
  function: {
    name: "evaluate_response",
    description: "Evaluate whether the current data and explanation fully answer the user's question.",
    parameters: {
      type: "object",
      properties: {
        score: {
          type: "number",
          description: "Score from 1-10 indicating how well the question was answered (10 = perfect, 1 = not answered)"
        },
        is_complete: {
          type: "boolean",
          description: "Whether the answer is complete and satisfactory"
        },
        missing_information: {
          type: "string",
          description: "What information is missing or needed for a complete answer (empty if complete)"
        },
        suggested_followup: {
          type: "string",
          description: "A follow-up question to get the missing information (empty if complete)"
        }
      },
      required: ["score", "is_complete"]
    }
  }
};
var IDENTIFY_TYPES_TOOL = {
  type: "function",
  function: {
    name: "identify_schema_types",
    description: "Identify which GraphQL types are needed to answer the user's question.",
    parameters: {
      type: "object",
      properties: {
        types: {
          type: "array",
          items: { type: "string" },
          description: 'List of GraphQL type names needed (e.g., ["User", "Post"])'
        },
        reasoning: {
          type: "string",
          description: "Brief explanation of why these types are needed"
        }
      },
      required: ["types"]
    }
  }
};
var GRAPHQL_TOOL = {
  type: "function",
  function: {
    name: "generate_graphql_query",
    description: "Generate a valid GraphQL query based on the user question and available schema. The query should fetch all necessary data to answer the user's question.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The complete GraphQL query string including operation type, field selections, and any necessary arguments"
        },
        variables: {
          type: "object",
          description: "Optional variables for the GraphQL query"
        },
        reasoning: {
          type: "string",
          description: "Brief explanation of why this query was chosen"
        }
      },
      required: ["query"]
    }
  }
};
var QueryGeneratorService = class {
  // GraphQL access scoped to the requesting user. Supplied per request.
  constructor(graphql9) {
    this.graphql = graphql9;
  }
  // Token/character limits for context management
  MAX_RESULT_CHARS = 4e3;
  // ~1000 tokens - more conservative
  MAX_TOKENS = 2e3;
  // Max tokens for LLM responses
  MAX_ITERATIONS = 4;
  // Max follow-up queries
  MIN_SCORE_THRESHOLD = 6;
  // Minimum score to consider complete
  MAX_TOOL_ATTEMPTS = 2;
  // Retries when a model botches a tool call
  /**
   * Truncate large JSON results to fit within token limits
   */
  truncateResults(results, maxChars = this.MAX_RESULT_CHARS) {
    const jsonString = JSON.stringify(results, null, 2);
    if (jsonString.length <= maxChars) {
      return results;
    }
    console.log(
      `\u26A0\uFE0F Results too large (${jsonString.length} chars), truncating...`
    );
    if (Array.isArray(results)) {
      const truncated = [];
      let currentLength = 2;
      for (const item of results) {
        const itemString = JSON.stringify(item, null, 2);
        if (currentLength + itemString.length + 2 > maxChars) {
          break;
        }
        truncated.push(item);
        currentLength += itemString.length + 2;
      }
      return {
        _truncated: true,
        _totalItems: results.length,
        _showingItems: truncated.length,
        data: truncated
      };
    }
    if (typeof results === "object" && results !== null) {
      const truncated = { _truncated: false };
      let totalSize = 0;
      for (const [key, value] of Object.entries(results)) {
        if (Array.isArray(value)) {
          const truncatedArray = [];
          let arraySize = 0;
          for (const item of value) {
            const itemString = JSON.stringify(item, null, 2);
            if (totalSize + arraySize + itemString.length > maxChars) {
              break;
            }
            truncatedArray.push(item);
            arraySize += itemString.length;
          }
          if (truncatedArray.length < value.length) {
            truncated[key] = truncatedArray;
            truncated._truncated = true;
            truncated[`_${key}_total`] = value.length;
            truncated[`_${key}_showing`] = truncatedArray.length;
          } else {
            truncated[key] = value;
          }
          totalSize += arraySize;
        } else {
          truncated[key] = value;
        }
      }
      return truncated;
    }
    return {
      _truncated: true,
      _note: "Results were too large and have been truncated",
      _preview: jsonString.substring(0, maxChars) + "..."
    };
  }
  /**
   * Parse the schema to extract a type summary (just type names and descriptions)
   * Excludes Mutation type since we only support queries
   */
  getTypeSummary(schema) {
    const lines = schema.split("\n");
    const summary = ["Available GraphQL Types:\n"];
    for (const line of lines) {
      const match = line.match(/^(type|input|enum|interface)\s+(\w+)/);
      if (match && match[2] !== "Mutation") {
        summary.push(line.trim());
      }
    }
    return summary.join("\n");
  }
  /**
   * Extract specific types from the full schema
   * Always includes Query type and excludes Mutation type
   * Automatically includes related input types for filters/sorting
   */
  extractTypes(schema, typeNames) {
    const lines = schema.split("\n");
    const result = [];
    let inType = false;
    const typesToExtract = new Set(typeNames);
    typesToExtract.add("Query");
    const relatedInputs = /* @__PURE__ */ new Set();
    for (const typeName of typeNames) {
      relatedInputs.add(`${typeName}WhereInput`);
      relatedInputs.add(`${typeName}OrderByInput`);
      relatedInputs.add(`${typeName}WhereUniqueInput`);
      relatedInputs.add(`${typeName}ManyRelationFilter`);
    }
    relatedInputs.forEach((inputType) => {
      typesToExtract.add(inputType);
    });
    typesToExtract.add("OrderDirection");
    typesToExtract.add("QueryMode");
    typesToExtract.add("StringFilter");
    typesToExtract.add("StringNullableFilter");
    typesToExtract.add("IntNullableFilter");
    typesToExtract.add("BooleanFilter");
    typesToExtract.add("DateTimeFilter");
    typesToExtract.add("DateTimeNullableFilter");
    typesToExtract.add("IDFilter");
    typesToExtract.add("NestedStringFilter");
    for (const line of lines) {
      const typeMatch = line.match(
        /^(type|input|enum|interface|scalar)\s+(\w+)/
      );
      if (typeMatch && typeMatch[2]) {
        const typeName = typeMatch[2];
        if (typeName === "Mutation") {
          inType = false;
          continue;
        }
        if (typesToExtract.has(typeName)) {
          inType = true;
          result.push(line);
        } else {
          inType = false;
        }
        continue;
      }
      if (inType) {
        result.push(line);
        if (line.trim() === "}") {
          inType = false;
          result.push("");
        }
      }
    }
    return result.join("\n");
  }
  /**
   * Step 1: Identify which schema types are relevant
   */
  async identifyRelevantTypes(question, model) {
    const schema = await this.graphql.getSchema();
    const typeSummary = this.getTypeSummary(schema);
    console.log("Type summary length:", typeSummary.length, "characters");
    const systemPrompt = `You are a GraphQL schema analyzer. Given a user's question and a list of available GraphQL types, identify which types are needed to answer the question.`;
    const userPrompt = `${typeSummary}

User Question: "${question}"

Use the identify_schema_types tool to specify which types are needed.`;
    const response = await lmStudio.chatCompletionWithTools({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      tools: [IDENTIFY_TYPES_TOOL],
      tool_choice: "required",
      temperature: 0.2,
      max_tokens: 500
      // Type identification should be brief
    });
    const choice = response.choices[0];
    if (!choice || !choice.message.tool_calls || choice.message.tool_calls.length === 0) {
      throw new Error("LLM did not identify types using the tool");
    }
    const toolCall = choice.message.tool_calls[0];
    if (!toolCall) {
      throw new Error("No tool call returned");
    }
    const args = this.parseToolArguments(toolCall.function.arguments) ?? {};
    console.log("Identified types:", args.types);
    console.log("Reasoning:", args.reasoning);
    return {
      types: Array.isArray(args.types) ? args.types : [],
      reasoning: args.reasoning || "No reasoning provided"
    };
  }
  /**
   * Step 2: Generate a GraphQL query with only relevant types
   */
  async generateQuery(question, model, userId, userName) {
    const { types } = await this.identifyRelevantTypes(question, model);
    const fullSchema = await this.graphql.getSchema();
    const relevantSchema = this.extractTypes(fullSchema, types);
    console.log("Relevant schema length:", relevantSchema.length, "characters");
    console.log("Relevant schema:\n", relevantSchema);
    const now = /* @__PURE__ */ new Date();
    const currentDate = now.toISOString().split("T")[0];
    const currentDateTime = now.toISOString();
    const userContextSection = userId || userName ? `
CURRENT USER CONTEXT (Teacher-focused):
${userId ? `- User ID: ${userId}` : ""}
${userName ? `- User Name: ${userName}` : ""}
- CRITICAL: The current user is a TEACHER unless specified otherwise
- When the teacher asks about "me", "my", "I", etc., use this information to filter queries as a TEACHER

Teacher Query Patterns (IMPORTANT):
- "my students" or "students in my class" \u2192 Use block1Students, block2Students, etc. fields where the current user is the teacher
- "my block 1 class" or "my period 1" \u2192 Use block1Students where current user is block1Teacher
- "my callbacks" \u2192 Filter callbacks where teacher = current user (callbacks are late assignments assigned by teachers)
- "callbacks I assigned" \u2192 Filter callbacks where teacher = current user
- "PBIS cards I gave" \u2192 Filter pbisCards where teacher = current user
- "my TA students" \u2192 Use taStudents where current user is taTeacher

Example queries for teachers:
- "Show my block 1 students" \u2192 query { user(where: { id: "${userId}" }) { block1Students { name } } }
- "My callbacks" \u2192 query { callbacks(where: { teacher: { id: { equals: "${userId}" } } }) { student { name } title } }
- "PBIS cards I gave" \u2192 query { pbisCards(where: { teacher: { id: { equals: "${userId}" } } }) { student { name } category } }
` : "";
    const systemPrompt = `You are a GraphQL query generator for a KeystoneJS GraphQL API. Given a user's natural language question and a GraphQL schema, your job is to generate a valid GraphQL query that will fetch the data needed to answer the question.

CURRENT DATE/TIME:
- Today's Date: ${currentDate}
- Current DateTime: ${currentDateTime}
- Use this information to calculate date ranges for queries like "last week", "this month", "yesterday", etc.
- For date comparisons, use ISO 8601 format (YYYY-MM-DDTHH:MM:SS.sssZ)
${userContextSection}

Important guidelines:
1. Generate syntactically correct GraphQL queries
2. Only use fields and types that exist in the provided schema
3. Include all necessary fields to answer the user's question
4. Use appropriate filters, sorting, and pagination if needed
5. Keep queries efficient - don't over-fetch data
6. CRITICAL: You must ONLY generate queries (query { ... }), NEVER mutations or subscriptions
7. If the user asks to create, update, or delete data, you must refuse and explain that only read operations are allowed
8. CRITICAL - Field Aliases: If you need to query the same field multiple times with different arguments, you MUST use aliases
   This applies to ALL fields: users, teachers, students, callbacks, pbisCards, etc.
   Example - WRONG: query { users(where: {...}) { id } users(where: {...}) { id } }
   Example - WRONG: query { teachers(where: {...}) { id } teachers(where: {...}) { id } }
   Example - CORRECT: query { students: users(where: {...}) { id } staff: users(where: {...}) { id } }
   Example - CORRECT: query { mathTeachers: teachers(where: {...}) { id } scienceTeachers: teachers(where: {...}) { id } }
   ALWAYS use descriptive aliases when querying the same field multiple times - this is REQUIRED by GraphQL

KeystoneJS Filter Syntax (IMPORTANT):
- For boolean fields, use: { fieldName: { equals: true } } NOT { fieldName: true }
- For string fields, use: { fieldName: { equals: "value" } } or { contains: "value" }
- CRITICAL - Case-Insensitive Text Search: ALWAYS use mode: "insensitive" for string filters to make searches case-insensitive
  Example: { name: { contains: "john", mode: insensitive } }
  Example: { name: { equals: "Smith", mode: insensitive } }
  This ensures searches work regardless of capitalization (e.g., "John", "JOHN", "john" all match)
- For number comparisons: { fieldName: { gt: 5, lt: 10 } }
- For sorting, use: orderBy: [{ fieldName: asc }] or orderBy: [{ fieldName: desc }]
- For limiting results: take: 10
- For skipping results: skip: 5
- CRITICAL - Relationship Filters: When filtering on relationships, you MUST use "some", "none", or "every"
  Example: { students: { some: { name: { contains: "John", mode: insensitive } } } }
  Example: { teacher: { name: { equals: "Smith", mode: insensitive } } } // for single relationships
  NEVER: { students: { name: { contains: "John" } } } // WRONG - missing "some"

CRITICAL - User Query Types (MUST UNDERSTAND):
- user (singular) uses UserWhereUniqueInput - ONLY accepts unique fields like { id: "..." }
  WRONG: user(where: { name: "John", isTeacher: true }) \u2190 name and isTeacher are NOT unique fields
  CORRECT: user(where: { id: "123" }) \u2190 only use for unique lookups by ID
- users (plural) uses UserWhereInput - accepts filtering fields like name, isStaff, isStudent, etc.
  CORRECT: users(where: { name: { contains: "John", mode: insensitive }, isStaff: { equals: true } })
- When filtering by name, isStaff, isStudent, or any non-unique field, ALWAYS use users (plural), NEVER user (singular)
- People here say "teacher" to mean anyone who works at the school, so DEFAULT to isStaff
  DEFAULT: users(where: { isStaff: { equals: true } })
  isTeacher does exist and marks classroom teachers specifically (those with a TA group or
  assigned classes - roughly half of staff). Use it ONLY when the question clearly means
  classroom teachers as distinct from other staff.

Domain-Specific Rules (CRITICAL):
- ALL users (teachers, staff, students) are in the same "users" table
- When asking about TEACHERS or STAFF: ALWAYS filter by { isStaff: { equals: true } } using users (plural)
- When asking about STUDENTS: ALWAYS filter by { isStudent: { equals: true } } using users (plural)
- CRITICAL: "teacher" in a question usually means any employee, so default to isStaff: { equals: true }. Only use isTeacher when the question means classroom teachers as opposed to other staff.
- CRITICAL: If the question asks about a student (e.g., "what teachers does [name] have"), you MUST:
  1. Use users (plural) not user (singular) when filtering by name
  2. Combine name filter with isStudent filter: { isStudent: { equals: true }, name: { contains: "name", mode: insensitive } }

Callback Assignment Terminology (CRITICAL):
- "Callbacks" are LATE ASSIGNMENTS or MISSING WORK assigned by teachers to students
- Terms that mean callbacks: "late work", "late assignments", "callback assignments", "missing work", "callbacks"
- Callbacks have a teacher (who assigned it) and student (who needs to complete it)

Callback Query Rules for Teachers:
- When a TEACHER asks "my callbacks" or "callbacks I assigned", query callbacks table with teacher filter
- CORRECT: query { callbacks(where: { teacher: { id: { equals: "..." } } }) { id title student { name } dateAssigned } }
- callbackCount on User is for STUDENTS (callbacks assigned TO them), not teachers
- For counting teacher's callbacks: query callbacks table with teacher filter and count results

PBIS Card Rules:
- Card counts on User are RELATIONSHIP counts, computed live. They are always accurate.
  - studentPbisCardsCount = cards a student RECEIVED
  - teacherPbisCardsCount = cards a staff member GAVE
  - staffPbisCardsReceivedCount / staffPbisCardsGivenCount = staff-to-staff cards
- Each accepts the same filters as the underlying list, so date ranges go inside it:
  studentPbisCardsCount(where: { dateGiven: { gte: "2026-09-01T00:00:00.000Z" } })
  With no argument it counts every card on record.
- CRITICAL: these counts CANNOT be used in orderBy. UserOrderByInput has no card
  fields at all. There is no way to sort users by cards in the query.
- So for "who has the most cards" style questions, DO NOT try to sort. Fetch the
  candidates with their count and let the explanation step find the maximum:
  query { users(where: { isStudent: { equals: true } }) { id name studentPbisCardsCount } }
- When a TEACHER asks "how many PBIS cards have I given", use teacherPbisCardsCount,
  or query the pbisCards list filtered by teacher if you need the individual cards.
- Do not invent stored count fields such as PbisCardCount, YearPbisCount or
  taPbisCardCount. They were removed; only the relationship counts above exist.

Collection Period Rules:
- "The last collection", "this collection", "since the last collection" and
  "this week's cards" all refer to a PBIS collection RUN, not a calendar week or
  month. The runs are the rows of pbisCollectionDates.
- NEVER invent a date like the first of the month for these. Fetch the latest run
  first: query { pbisCollectionDates(orderBy: { collectionDate: desc }, take: 1)
  { collectionDate } }, then filter cards with dateGiven gte that value.
- If you answer with a date range, state the actual range you used so the reader
  can see what "last collection" was taken to mean.

Who Counts As A Teacher:
- Administrators bulk-import PBIS cards hundreds at a time, so their totals are
  not comparable to a teacher handing out cards individually. For any "who gave
  the most cards" or similar ranking of staff, EXCLUDE them:
  users(where: { isStaff: { equals: true }, isSuperAdmin: { equals: false } })
- Include them only if the question explicitly asks about administrators.

Counting and Ranking Rules:
- Prefer a *Count field with a where filter over fetching rows and counting them
  yourself. counts are computed by the database and are exact; counting rows in a
  large JSON payload by eye is unreliable and has produced wrong answers.
- Read the field description before using a count. Several counts mean "all time"
  unless you pass a filter - asking for "open" or "outstanding" and then using an
  unfiltered count is a silent error that returns a plausible but wrong number.
- GraphQL here cannot GROUP BY. There is no way to ask "which description/category
  /teacher appears most often" in one query. If a question needs grouping, either
  ask for counts of specific candidate values one at a time, or say plainly that
  the data cannot be grouped in a single query and offer the closest thing you can
  answer exactly.
- Never present a ranking derived from scanning many rows as if it were exact.

Name and Display Rules:
- The name field for users includes BOTH first and last name (e.g., "John Smith")
- For searches: use { name: { contains: "John", mode: insensitive } } to find partial matches
- ALWAYS use mode: insensitive for all name searches to handle case variations
- For teacher/student relationships: questions like "what teachers does John Smith have" mean checking block1Teacher, block2Teacher, etc.
- For class rosters: questions like "what students does Mr Smith have" mean checking block1Students, block2Students, etc.

Example correct queries:
query { users(where: { isStaff: { equals: true } }, orderBy: [{ name: asc }], take: 10) { id name callbackCount } }
query { users(where: { isStudent: { equals: true } }) { id name studentPbisCardsCount } }
query { users(where: { isStudent: { equals: true }, name: { contains: "Korbin", mode: insensitive } }, take: 1) { id name block1Teacher { id name } block2Teacher { id name } } }
query { callbacks(where: { student: { name: { contains: "John", mode: insensitive } } }) { id student { name } title } }
query { pbisCards(where: { teacher: { id: { equals: "123" } } }) { id student { name } category dateGiven } }
query { students: users(where: { isStudent: { equals: true } }) { id name } staff: users(where: { isStaff: { equals: true } }) { id name } }
query { user(where: { id: "123" }) { id name } }
query { users(where: { name: { contains: "Smith", mode: insensitive }, isStaff: { equals: true } }) { id name } }

GraphQL Schema:
${relevantSchema}`;
    const userPrompt = `Generate a GraphQL query to answer this question: "${question}"

Use the generate_graphql_query tool to provide your answer.`;
    let lastFailure = "";
    for (let attempt = 1; attempt <= this.MAX_TOOL_ATTEMPTS; attempt++) {
      const attemptPrompt = attempt === 1 ? userPrompt : `${userPrompt}

Your previous attempt failed: ${lastFailure}
Call the generate_graphql_query tool with a "query" argument whose value is the complete GraphQL query as a single string.`;
      const response = await lmStudio.chatCompletionWithTools({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: attemptPrompt }
        ],
        tools: [GRAPHQL_TOOL],
        tool_choice: "required",
        temperature: 0.2,
        max_tokens: 1e3
        // Queries should be concise
      });
      const toolCall = response.choices[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        lastFailure = "the model replied without calling the tool";
        console.warn(`\u26A0\uFE0F Query generation attempt ${attempt}: ${lastFailure}`);
        continue;
      }
      const args = this.parseToolArguments(toolCall.function.arguments);
      const queryArgs = this.extractQueryArgs(args);
      if (!queryArgs) {
        lastFailure = `the tool call did not include a "query" string (arguments: ${String(
          toolCall.function.arguments
        ).substring(0, 300)})`;
        console.warn(`\u26A0\uFE0F Query generation attempt ${attempt}: ${lastFailure}`);
        continue;
      }
      if (!this.isQueryOperation(queryArgs.query)) {
        throw new Error(
          "Operation not allowed. Only read operations (queries) are permitted. Mutations and subscriptions are not supported."
        );
      }
      return {
        query: queryArgs.query,
        variables: queryArgs.variables,
        reasoning: queryArgs.reasoning || "No reasoning provided"
      };
    }
    throw new Error(
      `The model "${model}" did not return a usable GraphQL query after ${this.MAX_TOOL_ATTEMPTS} attempts: ${lastFailure}`
    );
  }
  /**
   * Tool-call arguments are supposed to be a JSON string, but local models
   * sometimes double-encode them or emit invalid JSON. Returns null when the
   * arguments can't be parsed.
   */
  parseToolArguments(raw) {
    if (raw && typeof raw === "object") {
      return raw;
    }
    if (typeof raw !== "string") {
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string") {
        try {
          return JSON.parse(parsed);
        } catch {
          return null;
        }
      }
      return parsed;
    } catch {
      return null;
    }
  }
  /**
   * Pull the generated query out of the tool arguments, tolerating the wrapper
   * shapes and field aliases models use instead of a bare { query, ... }.
   */
  extractQueryArgs(args) {
    if (!args || typeof args !== "object") {
      return null;
    }
    const containers = [args, args.arguments, args.parameters, args.input];
    for (const container of containers) {
      if (!container || typeof container !== "object") {
        continue;
      }
      const value = container.query ?? container.graphql_query ?? container.graphqlQuery;
      if (typeof value === "string" && value.trim()) {
        return {
          query: value.trim(),
          variables: container.variables,
          reasoning: container.reasoning
        };
      }
    }
    return null;
  }
  /**
   * Validate that a GraphQL operation is a query (not mutation or subscription)
   */
  isQueryOperation(graphqlString) {
    const normalized = graphqlString.replace(/#.*/g, "").replace(/\s+/g, " ").trim();
    if (/^\s*(mutation|subscription)\s*[{\(]/i.test(normalized)) {
      return false;
    }
    if (/^\s*query\s*[{\(]/i.test(normalized)) {
      return true;
    }
    if (/^\s*\{/.test(normalized)) {
      return true;
    }
    return false;
  }
  /**
   * Generate an explanation of query results
   */
  async explainResults(question, query, results, model, maxChars = this.MAX_RESULT_CHARS) {
    const alreadyTruncated = results._truncated === true;
    const originalSize = JSON.stringify(results).length;
    const truncatedResults = alreadyTruncated ? results : this.truncateResults(results, maxChars);
    const wasTruncated = truncatedResults._truncated === true;
    const truncatedSize = JSON.stringify(truncatedResults).length;
    console.log(
      `Results size: ${originalSize} chars -> ${truncatedSize} chars (truncated: ${wasTruncated}, already: ${alreadyTruncated})`
    );
    const systemPrompt = `You are a helpful assistant that explains data to teachers. Given a user's question, the GraphQL query that was executed, and the results, provide a clear, concise, natural language explanation of the answer.

Guidelines:
1. Directly answer the user's question
2. Be specific and cite actual data from the results (names, titles, descriptions, etc.)
3. Keep it concise but complete
4. Use natural, conversational language
5. If the results are empty or don't contain relevant data, clearly state that
6. IMPORTANT: Do NOT include or mention any IDs (user IDs, record IDs, etc.) in your response - users don't need to see internal identifiers
7. IMPORTANT: Do NOT include email addresses in your response unless the user specifically asked for emails
8. CRITICAL: Format your response using Markdown - use headers (##, ###), lists (-, *), **bold**, and proper formatting for readability

Name Display Rules:
9. When displaying names, use FIRST NAME ONLY for brevity and friendliness (e.g., "John" not "John Smith")
10. Extract the first name from the full name field (names are stored as "FirstName LastName")

Terminology Rules:
11. Use "callback assignment" or "late assignment" instead of just "callback" when explaining to make it clear
12. Example: "John has 3 callback assignments" or "Sarah has 2 late assignments" (NOT "John has 3 callbacks")
13. PBIS cards can be referred to as "PBIS cards" or "positive behavior cards"
${wasTruncated ? `14. CRITICAL - THE RESULTS ARE INCOMPLETE. They were cut to fit, and the
    rows you were given are an arbitrary slice, not the top or first ones by any
    meaningful order. Therefore you MUST NOT state or imply a maximum, minimum,
    "most", "least", "top", "best", "worst", or any ranking or total. Say plainly
    that the data was too large to show in full, report only what is visible and
    label it as a partial sample, and suggest narrowing the question (a specific
    person, class, or date range) to get a reliable answer.` : ""}`;
    const userPrompt = `User's Question: "${question}"

GraphQL Query Executed:
\`\`\`graphql
${query}
\`\`\`

Query Results${wasTruncated ? " (truncated for brevity)" : ""}:
\`\`\`json
${JSON.stringify(truncatedResults, null, 2)}
\`\`\`

Please explain what this data tells us in answer to the user's question. Format your response in Markdown with appropriate headers, lists, and formatting for readability.`;
    const explanation = await lmStudio.complete(
      model,
      userPrompt,
      systemPrompt,
      0.7,
      this.MAX_TOKENS
      // Add max_tokens parameter
    );
    return explanation.trim();
  }
  /**
   * Evaluate if the response adequately answers the question
   */
  async evaluateResponse(originalQuestion, explanation, allData, model) {
    const systemPrompt = `You are a quality evaluator for question-answering systems. Your job is to determine if a response adequately answers the user's original question.

CRITICAL RULES:
1. If the response is incomplete (is_complete = false), you MUST provide a suggested_followup question
2. If results are empty or no data found, suggest trying alternate spellings, checking if the person is a student vs staff, or broadening the search
3. If data exists but doesn't answer the question, suggest what additional information is needed
4. The suggested_followup should be a clear, actionable question that can be used to refine the search`;
    const isEmpty = allData.length === 0 || allData.length === 1 && (JSON.stringify(allData[0]).length < 50 || JSON.stringify(allData[0]) === "{}" || Array.isArray(allData[0]) && allData[0].length === 0);
    const userPrompt = `Original Question: "${originalQuestion}"

Current Explanation:
${explanation}

Available Data Summary:
${JSON.stringify(allData, null, 2).substring(0, 2e3)}
${isEmpty ? "\n\u26A0\uFE0F WARNING: The data appears to be empty or no results were found. Consider suggesting alternate search strategies." : ""}

Evaluate whether this explanation fully answers the original question. Use the evaluate_response tool.
${isEmpty ? "IMPORTANT: Since no data was found, you MUST provide a suggested_followup with alternative search strategies." : ""}`;
    const response = await lmStudio.chatCompletionWithTools({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      tools: [EVALUATE_RESPONSE_TOOL],
      tool_choice: "required",
      temperature: 0.3,
      max_tokens: 500
    });
    const choice = response.choices[0];
    if (!choice || !choice.message.tool_calls || choice.message.tool_calls.length === 0) {
      return { score: 7, isComplete: true };
    }
    const toolCall = choice.message.tool_calls[0];
    if (!toolCall) {
      return { score: 7, isComplete: true };
    }
    const args = this.parseToolArguments(toolCall.function.arguments);
    if (!args || typeof args !== "object") {
      return { score: 7, isComplete: true };
    }
    console.log(
      `Evaluation - Score: ${args.score}/10, Complete: ${args.is_complete}`
    );
    if (!args.is_complete) {
      console.log(`Missing: ${args.missing_information}`);
      console.log(
        `Suggested followup: ${args.suggested_followup || "(none provided)"}`
      );
    }
    let suggestedFollowup = args.suggested_followup;
    if (!args.is_complete && !suggestedFollowup) {
      if (args.missing_information) {
        suggestedFollowup = `Find ${args.missing_information.toLowerCase()}`;
      } else {
        suggestedFollowup = `Search for more information related to: ${originalQuestion}`;
      }
      console.log(`\u26A0\uFE0F Generated fallback followup: ${suggestedFollowup}`);
    }
    return {
      score: args.score,
      isComplete: args.is_complete,
      missingInfo: args.missing_information,
      suggestedFollowup
    };
  }
  /**
   * Calculate dynamic truncation limit based on model context length
   */
  calculateTruncationLimit(modelContextLength) {
    if (!modelContextLength || modelContextLength === 0) {
      return this.MAX_RESULT_CHARS;
    }
    const reservedTokens = 1e3 + 200 + 500 + this.MAX_TOKENS;
    const safetyBuffer = 0.2;
    const availableTokens = modelContextLength - reservedTokens;
    const tokensForResults = availableTokens * (1 - safetyBuffer);
    const maxChars = Math.max(1e3, Math.floor(tokensForResults * 4));
    console.log(
      `Dynamic truncation: context=${modelContextLength}, available=${tokensForResults} tokens, maxChars=${maxChars}`
    );
    return maxChars;
  }
  /**
   * Complete flow with iterative refinement: Generate query, execute, evaluate, and refine if needed
   */
  async processQuery(question, model, userId, userName) {
    let modelContextLength;
    try {
      const models = await lmStudio.getModelsWithLimits();
      const currentModel = models.find((m) => m.id === model);
      modelContextLength = currentModel?.max_context_length;
      console.log(
        `Model ${model} context length: ${modelContextLength || "unknown"}`
      );
    } catch (error) {
      console.warn("Could not fetch model context length:", error);
    }
    let currentQuestion = question;
    let allQueries = [];
    let allData = [];
    let finalExplanation = "";
    let iteration = 0;
    while (iteration < this.MAX_ITERATIONS) {
      iteration++;
      console.log(`
=== Iteration ${iteration} ===`);
      console.log(`Question: ${currentQuestion}`);
      let generated;
      try {
        generated = await this.generateQuery(
          currentQuestion,
          model,
          userId,
          userName
        );
      } catch (error) {
        if (allData.length > 0 && finalExplanation) {
          console.warn(
            `\u26A0\uFE0F Follow-up query generation failed on iteration ${iteration}, returning earlier results:`,
            error
          );
          iteration -= 1;
          break;
        }
        throw error;
      }
      const { query, variables, reasoning } = generated;
      allQueries.push(query);
      console.log("Generated query:", query);
      const result = await this.graphql.query({ query, variables });
      console.log("Result:", result);
      if (result.errors) {
        const isQueryShapeError = (e) => !e.path || e.path.length === 0;
        const retryableError = result.errors.find(
          (e) => isQueryShapeError(e) || e.extensions?.code === "GRAPHQL_PARSE_FAILED" || e.extensions?.code === "GRAPHQL_VALIDATION_FAILED" || e.message.includes("Syntax Error") || e.message.includes("conflict") || e.message.includes("differing arguments") || e.message.includes("is not defined by type") || e.message.includes("Cannot query field") || e.message.includes("UserWhereUniqueInput")
        );
        if (retryableError && iteration < this.MAX_ITERATIONS) {
          console.log(
            `\u26A0\uFE0F GraphQL ${retryableError.message.includes("Syntax Error") ? "parse" : "validation"} error detected, retrying with error context...`
          );
          console.log("Error:", retryableError.message);
          let errorGuidance = "";
          if (retryableError.extensions?.code === "GRAPHQL_PARSE_FAILED" || retryableError.message.includes("Syntax Error")) {
            const loc = retryableError.locations?.[0];
            const where = loc ? ` The parser stopped at line ${loc.line}, column ${loc.column}.` : "";
            errorGuidance = `CRITICAL: Your query is not valid GraphQL - it failed to parse, so none of it ran.${where} Common causes: unbalanced { } or ( ), a trailing comma, a missing field name, or the query being cut off before it finished. Rewrite the whole query from scratch as ONE complete, syntactically valid query operation. Do not send a fragment or a partial query.`;
          } else if (retryableError.message.includes("UserWhereUniqueInput")) {
            errorGuidance = `CRITICAL ERROR: You used user (singular) with fields that don't exist in UserWhereUniqueInput. UserWhereUniqueInput ONLY accepts unique fields like { id: "..." }. When filtering by name, isStaff, isStudent, or any non-unique field, you MUST use users (plural) instead. Also, "teacher" in a question usually means any employee, so prefer isStaff unless the question specifically means classroom teachers.`;
          } else if (retryableError.message.includes("conflict") || retryableError.message.includes("differing arguments")) {
            const fieldMatch = retryableError.message.match(/Fields "(\w+)"/);
            const fieldName = fieldMatch ? fieldMatch[1] : "the same field";
            errorGuidance = `CRITICAL: You queried "${fieldName}" multiple times with different arguments. GraphQL requires aliases when querying the same field multiple times. Use descriptive aliases like "first: ${fieldName}(...)" and "second: ${fieldName}(...)" or more descriptive names based on the filter (e.g., "students: users(...)" and "staff: users(...)").`;
          } else if (retryableError.message.includes("is not defined by type")) {
            errorGuidance = `The field you used doesn't exist in that input type. Check the schema and use the correct field name and input type. Remember: user (singular) only accepts unique fields like id, while users (plural) accepts filtering fields.`;
          } else if (retryableError.message.includes("Cannot query field")) {
            const m = retryableError.message.match(
              /Cannot query field "(\w+)" on type "(\w+)"/
            );
            const field = m ? m[1] : "that field";
            const onType = m ? m[2] : "that type";
            errorGuidance = `CRITICAL: "${field}" does not exist on type "${onType}". Do not guess field names. Look at the "${onType}" type in the schema you were given and use only the fields listed there. The schema you see is the complete set of what you may query - if something is not in it, it is not available and you should answer using what is, or say the data is not available.`;
          }
          currentQuestion = `${currentQuestion}

IMPORTANT: The previous query failed with this error: "${retryableError.message}". ${errorGuidance} Please fix the query to resolve this issue.`;
          continue;
        }
        throw new Error(
          `GraphQL query failed: ${result.errors.map((e) => e.message).join(", ")}`
        );
      }
      allData.push(result.data);
      let combinedData2 = allData.length === 1 ? allData[0] : { iteration_results: allData };
      const truncationLimit = this.calculateTruncationLimit(modelContextLength);
      const dataToExplain = this.truncateResults(combinedData2, truncationLimit);
      finalExplanation = await this.explainResults(
        question,
        // Use original question
        allQueries.join("\n---\n"),
        dataToExplain,
        model,
        truncationLimit
      );
      if (iteration < this.MAX_ITERATIONS) {
        const evaluation = await this.evaluateResponse(
          question,
          finalExplanation,
          allData,
          model
        );
        if (evaluation.isComplete || evaluation.score >= this.MIN_SCORE_THRESHOLD) {
          console.log(`\u2713 Answer is complete (score: ${evaluation.score}/10)`);
          return {
            query: allQueries.join("\n---\n"),
            variables,
            reasoning,
            data: combinedData2,
            explanation: finalExplanation,
            iterations: iteration,
            evaluationScore: evaluation.score
          };
        }
        if (evaluation.suggestedFollowup) {
          console.log(`\u21BB Needs refinement - following up...`);
          currentQuestion = evaluation.suggestedFollowup;
        } else {
          if (evaluation.missingInfo) {
            currentQuestion = `Find ${evaluation.missingInfo.toLowerCase()}`;
            console.log(`\u21BB Generated fallback followup: ${currentQuestion}`);
          } else {
            const hasStudentFilter = allQueries.some(
              (q) => q.includes("isStudent")
            );
            if (!hasStudentFilter && question.toLowerCase().includes("student")) {
              currentQuestion = `${question} (make sure to search for students only)`;
              console.log(`\u21BB Adding student filter to followup`);
            } else {
              console.log(`\u26A0 Incomplete but no clear followup - stopping`);
              break;
            }
          }
        }
      }
    }
    console.log(`\u2713 Max iterations reached (${this.MAX_ITERATIONS})`);
    const combinedData = allData.length === 1 ? allData[0] : { iteration_results: allData };
    return {
      query: allQueries.join("\n---\n"),
      variables: void 0,
      reasoning: "Multi-step query process",
      data: combinedData,
      explanation: finalExplanation,
      iterations: iteration
    };
  }
};
function createQueryGenerator(graphql9) {
  return new QueryGeneratorService(graphql9);
}

// mutations/queryCommunicator.ts
var MAX_QUESTION_LENGTH = 2e3;
var queryCommunicator = (base) => import_core26.graphql.field({
  type: import_core26.graphql.JSON,
  args: {
    question: import_core26.graphql.arg({ type: import_core26.graphql.nonNull(import_core26.graphql.String) }),
    // Accepted but ignored. The model is configuration (COMMUNICATOR_MODEL)
    // rather than a user choice. Kept optional rather than removed so a
    // browser tab left open on the old page keeps working instead of failing
    // validation on an unknown argument; it can be deleted once no client
    // sends it.
    model: import_core26.graphql.arg({ type: import_core26.graphql.String })
  },
  resolve: async (source, args, context) => {
    const session2 = await context.session;
    if (!session2) {
      throw new Error("You must be logged in to use the communicator");
    }
    if (!session2.data.isStaff) {
      throw new Error("Only staff members can access the communicator");
    }
    if (!session2.data.isCommunicatorEnabled) {
      throw new Error(
        "You do not have permission to use the communicator. Please contact an administrator."
      );
    }
    const model = getCommunicatorModel();
    const question = args.question.trim();
    if (!question) {
      throw new Error("Please enter a question.");
    }
    if (question.length > MAX_QUESTION_LENGTH) {
      throw new Error(
        `Questions are limited to ${MAX_QUESTION_LENGTH} characters.`
      );
    }
    const user = await context.query.User.findOne({
      where: { id: session2.itemId },
      query: "id name email"
    });
    if (!user) {
      throw new Error("User not found");
    }
    const persist = (data) => context.sudo().query.CommunicatorChat.createOne({
      data: { user: { connect: { id: user.id } }, ...data },
      query: "id"
    });
    try {
      const generator = createQueryGenerator(new CallerScopedGraphQL(context));
      const result = await generator.processQuery(
        question,
        model,
        String(user.id),
        user.name
      );
      const chat = await persist({
        question,
        explanation: result.explanation || null,
        graphqlQuery: result.query || null,
        model,
        iterations: result.iterations || null,
        evaluationScore: result.evaluationScore || null,
        status: "succeeded",
        rawData: result.data ?? null
      });
      return {
        chatId: chat?.id ?? null,
        question,
        explanation: result.explanation ?? null,
        graphqlQuery: result.query ?? null,
        iterations: result.iterations ?? null,
        evaluationScore: result.evaluationScore ?? null,
        rawData: result.data ?? null,
        error: false,
        message: null
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to process the communicator request";
      console.error("Communicator Query Error:", errorMessage);
      captureError(error, {
        tags: { mutation: "queryCommunicator", model },
        userId: String(user.id)
      });
      let chatId = null;
      try {
        const failedChat = await persist({
          question,
          model,
          status: "failed",
          errorMessage,
          rawData: { error: errorMessage }
        });
        chatId = failedChat?.id ?? null;
      } catch (dbError) {
        console.error("Failed to save error to database:", dbError);
        captureError(dbError, {
          tags: { mutation: "queryCommunicator", step: "saveErrorToDb" }
        });
      }
      return {
        chatId,
        question,
        explanation: null,
        graphqlQuery: null,
        iterations: null,
        evaluationScore: null,
        rawData: null,
        error: true,
        message: errorMessage
      };
    }
  }
});

// mutations/recalculateCallback.ts
var import_core27 = require("@keystone-6/core");
var gql2 = String.raw;
var recalculateCallback = (base) => import_core27.graphql.field({
  type: base.object("Callback"),
  args: {
    callbackId: import_core27.graphql.arg({ type: import_core27.graphql.nonNull(import_core27.graphql.ID) })
  },
  resolve: async (source, args, context) => {
    const callbackID = args.callbackId;
    const callback = await context.query.Callback.findOne({
      where: { id: callbackID },
      query: gql2`
      id
      teacher{
        id
      }
      student{
        id
      }
      `
    });
    if (!callback) return null;
    const studentId = callback.student.id;
    const teacherId = callback.teacher.id;
    const student = await context.query.User.findOne({
      where: { id: studentId },
      query: gql2`
                id
                 callbackTotal: callbackItemsCount
                 callbackToDo: callbackItemsCount(where:{dateCompleted:null})
                callbackItems(where: {NOT: {daysLate: null}}){
                  daysLate
                }
              
            `
    });
    function getAvg(grades) {
      const total = grades.reduce((acc, c) => acc + c, 0);
      return total / grades.length;
    }
    const completedCallbacks = student.callbackItems;
    const listOfDaysLate = completedCallbacks.map(
      (item) => item.daysLate
    );
    const averageTimeToComplete = Math.round(getAvg(listOfDaysLate) || 0);
    const teacher = await context.query.User.findOne({
      where: { id: teacherId },
      query: gql2`
                id
                 callbackTotal: callbackAssignedCount
                 callbackToDo: callbackAssignedCount(where:{dateCompleted:null})
              
            `
    });
    const updateStudentCallbacks = await context.query.User.updateOne({
      where: { id: studentId },
      data: {
        callbackCount: student.callbackToDo,
        totalCallbackCount: student.callbackTotal,
        averageTimeToCompleteCallback: Math.floor(averageTimeToComplete)
      }
    });
    const updateTeacherCallbacks = await context.query.User.updateOne({
      where: { id: teacherId },
      data: {
        callbackCount: teacher.callbackToDo,
        totalCallbackCount: teacher.callbackTotal
      }
    });
    return updateStudentCallbacks;
  }
});

// mutations/sendEmail.ts
var import_core28 = require("@keystone-6/core");
var sendEmail = (base) => import_core28.graphql.field({
  type: import_core28.graphql.Boolean,
  args: {
    emailData: import_core28.graphql.arg({ type: import_core28.graphql.JSON })
  },
  resolve: async (source, args, context) => {
    const session2 = await context.session;
    const isAllowed = isSignedIn({ session: session2, context });
    if (!isAllowed) return false;
    const email = args.emailData;
    if (!email) return false;
    if (typeof email !== "object") return false;
    const to = email.toAddress;
    const from = email.fromAddress;
    const subject = email.subject || "Email from NCUJHS.Tech";
    const body = email.body;
    await sendAnEmail(to, from, subject, body);
    return true;
  }
});

// mutations/updateStudentSchedules.ts
var import_core29 = require("@keystone-6/core");
var gql3 = String.raw;
var updateStudentSchedules = (base) => import_core29.graphql.field({
  type: import_core29.graphql.String,
  args: {
    studentScheduleData: import_core29.graphql.arg({ type: import_core29.graphql.JSON })
  },
  resolve: async (source, args, context) => {
    console.log("Updating Student Schedules");
    const allStudentUpdateResults = [];
    if (!args.studentScheduleData) return null;
    const studentDataList = JSON.parse(
      args.studentScheduleData
    );
    const slots = [
      ...Array.from({ length: NUMBER_OF_BLOCKS }, (_, i) => `block${i + 1}`),
      "ta"
    ];
    const teacherEmails = [
      ...new Set(
        studentDataList.flatMap((student) => slots.map((slot) => student[slot])).filter((email) => !!email)
      )
    ];
    const teachers = await context.query.User.findMany({
      where: { email: { in: teacherEmails } },
      query: gql3`
          id
          email
        `
    });
    const teacherIdByEmail = new Map(
      teachers.map((teacher) => [teacher.email, teacher.id])
    );
    const unmatchedEmails = teacherEmails.filter(
      (email) => !teacherIdByEmail.has(email)
    );
    if (unmatchedEmails.length > 0) {
      console.warn(
        `updateStudentSchedules: no user found for ${unmatchedEmails.length} teacher email(s): ${unmatchedEmails.join(", ")}`
      );
    }
    await Promise.all(
      studentDataList.map(async (student) => {
        const studentUpdateResults = {};
        const studentInfo = await context.query.User.findMany({
          where: { email: { equals: student.email } },
          query: gql3`
              id
              email
              name
          `
        });
        studentUpdateResults.email = student.email;
        for (const slot of slots) {
          const teacherEmail = student[slot];
          if (!teacherEmail) continue;
          const teacherId = teacherIdByEmail.get(teacherEmail);
          if (!teacherId) continue;
          const target = slot === "ta" ? "taTeacher" : `${slot}Teacher`;
          studentUpdateResults[target] = { connect: { id: teacherId } };
        }
        const suppliedName = student.name?.trim();
        studentUpdateResults.name = suppliedName || student.email.split("@")[0].split(".").join(" ");
        if (!studentInfo[0]?.id) {
          studentUpdateResults.isStudent = true;
          studentUpdateResults.password = "notpassword";
          const createdStudent = await context.query.User.createOne({
            data: {
              ...studentUpdateResults
            },
            query: "id"
          });
        }
        if (studentInfo[0]?.id) {
          const updatedStudent = await context.query.User.updateOne({
            where: { id: studentInfo[0].id },
            data: {
              ...studentUpdateResults
            }
          });
        }
        studentUpdateResults.existed = !!studentInfo[0];
        allStudentUpdateResults.push(studentUpdateResults);
      })
    );
    const name = JSON.stringify(allStudentUpdateResults);
    return name;
  }
});

// keystone.ts
var databaseURL = process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/postgres";
var keystone_default = withAuth(
  (0, import_core30.config)({
    db: {
      provider: "postgresql",
      url: databaseURL
    },
    // server options
    server: {
      // the port to run the server on
      port: Number(process.env.PORT) || 4e3,
      cors: {
        origin: [
          /^https?:\/\/localhost:\d+$/,
          "https://ncujhs.tech",
          "https://www.ncujhs.tech",
          "https://www.ncujhs.tech/",
          "https://old.ncujhs.tech",
          "https://old.ncujhs.tech/",
          "http://10.0.0.23:7979"
        ],
        credentials: true
      }
    },
    // This config allows us to set up features of the Admin UI https://keystonejs.com/docs/apis/config#ui
    ui: {
      // For our starter, we check that someone has session data before letting them see the Admin UI.
      isAccessAllowed: (context) => !!context.session?.data?.isSuperAdmin
    },
    lists: {
      User,
      AssignmentHistory,
      Birthday,
      BugReport,
      Bullying,
      Callback,
      CallbackRewardRun,
      Calendar,
      CellPhoneViolation,
      ChromebookCheck,
      CommunicatorChat,
      Discipline,
      Link,
      Message,
      PbisCard,
      StaffPbisCard,
      PbisCollectionDate,
      RandomDrawingWin,
      SortingHatQuestion,
      StudentFocus,
      TrimesterAward,
      Video
    },
    session,
    graphql: {
      playground: process.env.NODE_ENV === "development",
      apolloConfig: {
        // Keystone appends these to its own plugins, so the playground config
        // above is unaffected.
        plugins: [bugsinkApolloPlugin]
      },
      extendGraphqlSchema: import_core30.graphql.extend((base) => {
        return {
          mutation: {
            recalculateCallback: recalculateCallback(base),
            sendEmail: sendEmail(base),
            updateStudentSchedules: updateStudentSchedules(base),
            addStaff: addStaff(base),
            queryCommunicator: queryCommunicator(base),
            authenticateUserWithGoogle: authenticateUserWithGoogle(base),
            impersonateUser: impersonateUser(base)
          }
        };
      })
    }
  })
);
//# sourceMappingURL=config.js.map

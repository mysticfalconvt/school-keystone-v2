"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// keystone.ts
var keystone_exports = {};
__export(keystone_exports, {
  default: () => keystone_default
});
module.exports = __toCommonJS(keystone_exports);
var import_config2 = require("dotenv/config");
var import_core28 = require("@keystone-6/core");

// auth.ts
var import_auth = require("@keystone-6/auth");
var import_session = require("@keystone-6/core/session");

// lib/mail.ts
var import_nodemailer = require("nodemailer");
var import_config = require("dotenv/config");
var transport = (0, import_nodemailer.createTransport)({
  service: "gmail",
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  },
  tls: {
    ciphers: "SSLv3"
  }
});
var devTransport = (0, import_nodemailer.createTransport)({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});
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
  const info = await transport.sendMail({
    to,
    from: process.env.MAIL_USER,
    subject: "Your password reset token!",
    html: makeANiceEmail(`Your Password Reset Token is here!
      <a href="${process.env.FRONTEND_URL}/reset?token=${resetToken}">Click Here to reset</a>
    `)
  });
  if (process.env.MAIL_USER?.includes("ethereal.email")) {
    console.log(`\u{1F48C} Message Sent!  Preview it at ${(0, import_nodemailer.getTestMessageUrl)(info)}`);
  }
}
async function sendMagicLinkEmail(token, email) {
  if (process.env.NODE_ENV === "development") {
    const info = await devTransport.sendMail({
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
    console.log(info);
  } else {
    const info = await transport.sendMail({
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
  }
}
async function sendAnEmail(to, from, subject, body) {
  console.log(process.env.MAIL_HOST);
  console.log(process.env.MAIL_USER);
  console.log(process.env.MAIL_PASS);
  console.log(process.env.MAIL_PORT);
  if (process.env.NODE_ENV === "development") {
    const info = await devTransport.sendMail({
      to,
      from: process.env.MAIL_USER,
      replyTo: from,
      subject,
      html: makeANiceEmail(body)
    });
    console.log(info);
  } else {
    const info = await transport.sendMail({
      to,
      from: process.env.MAIL_USER,
      replyTo: from,
      subject,
      html: makeANiceEmail(body)
    });
    console.log(info);
    if (process.env.MAIL_USER?.includes("ethereal.email")) {
      console.log(`\u{1F48C} Message Sent!  Preview it at ${(0, import_nodemailer.getTestMessageUrl)(info)}`);
    }
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
  sessionData: "name id isSuperAdmin canSeeAllCallback canManageCalendar canSeeOtherUsers canManageUsers canManageRoles canManageLinks canManageDiscipline canSeeAllDiscipline canSeeAllTeacherEvents canSeeStudentEvents canSeeOwnCallback isCommunicatorEnabled hasTA hasClasses isStudent isParent isStaff isTeacher isGuidance canManagePbis canHaveSpecialGroups",
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
    sendToken: async ({ itemId, identity, token, context }) => {
      if (itemId && identity && token) {
        await sendMagicLinkEmail(token, identity);
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

// schemas/CellPhoneViolation.ts
var import_fields3 = require("@keystone-6/core/fields");
var import_core3 = require("@keystone-6/core");
var CellPhoneViolation = (0, import_core3.list)({
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
    description: (0, import_fields3.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    student: (0, import_fields3.relationship)({
      ref: "User.studentCellPhoneViolation"
    }),
    teacher: (0, import_fields3.relationship)({
      ref: "User.teacherCellPhoneViolation"
    }),
    dateGiven: (0, import_fields3.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" },
      isIndexed: true
    })
  }
});

// schemas/ChromebookAssignment.ts
var import_core4 = require("@keystone-6/core");
var ChromebookAssignment = (0, import_core4.list)({
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
      initialColumns: ["number", "student", "checkLog"],
      pageSize: 100
    }
  },
  fields: {
    // teacher: relationship({
    //   ref: "User",
    // }),
    // student: relationship({
    //   ref: "User.chromebookCheck",
    // }),
    // number: text(),
    // checkLog: relationship({
    //   ref: "ChromebookCheck.assignment",
    //   many: true,
    // }),
  }
});

// schemas/CommunicatorChat.ts
var import_core5 = require("@keystone-6/core");
var import_fields4 = require("@keystone-6/core/fields");
function canManageCommunicatorChats({ session: session2 }) {
  if (!session2) return false;
  return !!(session2.data.isSuperAdmin || session2.data.canManagePbis);
}
function isStaff({ session: session2 }) {
  if (!session2) return false;
  return !!session2.data.isStaff;
}
var CommunicatorChat = (0, import_core5.list)({
  access: {
    operation: {
      query: isStaff,
      create: isStaff,
      delete: canManageCommunicatorChats,
      update: canManageCommunicatorChats
    },
    filter: {
      query: ({ session: session2 }) => {
        if (!session2) return false;
        if (session2.data.isSuperAdmin || session2.data.canManagePbis) {
          return true;
        }
        return {
          user: { id: { equals: session2.itemId } }
        };
      }
    }
  },
  ui: {
    listView: {
      initialColumns: ["user", "question", "createdAt"],
      pageSize: 50
    }
  },
  fields: {
    user: (0, import_fields4.relationship)({
      ref: "User.communicatorChats"
      // ui: {
      //   displayMode: '',
      //   cardFields: ['name', 'email'],
      //   linkToItem: true,
      // },
    }),
    question: (0, import_fields4.text)({
      validation: { isRequired: true },
      ui: {
        displayMode: "textarea"
      }
    }),
    explanation: (0, import_fields4.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    graphqlQuery: (0, import_fields4.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    errorMessage: (0, import_fields4.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    hasError: (0, import_fields4.text)({
      defaultValue: "false"
    }),
    model: (0, import_fields4.text)({
      validation: { isRequired: true }
    }),
    iterations: (0, import_fields4.integer)(),
    evaluationScore: (0, import_fields4.integer)(),
    userRating: (0, import_fields4.integer)({
      defaultValue: 0,
      validation: {
        min: 0,
        max: 10
      }
    }),
    userComment: (0, import_fields4.text)({
      defaultValue: "",
      ui: {
        displayMode: "textarea"
      }
    }),
    rawData: (0, import_fields4.json)({
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
    timestamp: (0, import_fields4.timestamp)(),
    createdAt: (0, import_fields4.timestamp)({
      defaultValue: { kind: "now" }
    })
  }
});

// schemas/ChromebookCheck.ts
var import_fields5 = require("@keystone-6/core/fields");
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
      initialColumns: ["time", "assignment"],
      pageSize: 100
    }
  },
  fields: {
    time: (0, import_fields5.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    student: (0, import_fields5.relationship)({
      ref: "User.chromebookCheck"
    }),
    message: (0, import_fields5.text)()
  }
});

// schemas/Discipline.ts
var import_fields6 = require("@keystone-6/core/fields");
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
    teacherComments: (0, import_fields6.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    adminComments: (0, import_fields6.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    classType: (0, import_fields6.select)({
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
    location: (0, import_fields6.select)({
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
    timeOfDay: (0, import_fields6.select)({
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
    student: (0, import_fields6.relationship)({
      ref: "User.studentDiscipline"
    }),
    teacher: (0, import_fields6.relationship)({
      ref: "User.teacherDiscipline"
    }),
    date: (0, import_fields6.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    addressed: (0, import_fields6.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    inappropriateLanguage: (0, import_fields6.checkbox)(),
    physicalConduct: (0, import_fields6.checkbox)(),
    nonCompliance: (0, import_fields6.checkbox)(),
    disruption: (0, import_fields6.checkbox)(),
    propertyMisuse: (0, import_fields6.checkbox)(),
    otherConduct: (0, import_fields6.checkbox)(),
    // Teacher Actions
    VerbalWarning: (0, import_fields6.checkbox)(),
    buddyRoom: (0, import_fields6.checkbox)(),
    conferenceWithStudent: (0, import_fields6.checkbox)(),
    ParentContact: (0, import_fields6.checkbox)(),
    PlanningRoomReferral: (0, import_fields6.checkbox)(),
    FollowupPlan: (0, import_fields6.checkbox)(),
    LossOfPrivilege: (0, import_fields6.checkbox)(),
    DetentionWithTeacher: (0, import_fields6.checkbox)(),
    IndividualizedInstruction: (0, import_fields6.checkbox)(),
    GuidanceReferral: (0, import_fields6.checkbox)(),
    ReferToAdministrator: (0, import_fields6.checkbox)(),
    OtherAction: (0, import_fields6.checkbox)(),
    // Others Involved
    none: (0, import_fields6.checkbox)(),
    peers: (0, import_fields6.checkbox)(),
    teacherInvolved: (0, import_fields6.checkbox)(),
    substitute: (0, import_fields6.checkbox)(),
    unknown: (0, import_fields6.checkbox)(),
    othersInvolved: (0, import_fields6.checkbox)()
  }
});

// schemas/Link.ts
var import_fields7 = require("@keystone-6/core/fields");
var import_core8 = require("@keystone-6/core");
var Link = (0, import_core8.list)({
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
    name: (0, import_fields7.text)({ validation: { isRequired: true } }),
    description: (0, import_fields7.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    forTeachers: (0, import_fields7.checkbox)({
      defaultValue: false,
      label: "Teachers can view"
    }),
    forStudents: (0, import_fields7.checkbox)({
      defaultValue: false,
      label: "Students can view"
    }),
    forParents: (0, import_fields7.checkbox)({
      defaultValue: false,
      label: "Parents can view"
    }),
    onHomePage: (0, import_fields7.checkbox)({
      defaultValue: false,
      label: "Display on the home page"
    }),
    forPbis: (0, import_fields7.checkbox)({
      defaultValue: false,
      label: "Display on the PBIS page"
    }),
    forEPortfolio: (0, import_fields7.checkbox)({
      defaultValue: false,
      label: "Display on the ePortfolio page"
    }),
    modifiedBy: (0, import_fields7.relationship)({
      ref: "User"
    }),
    modified: (0, import_fields7.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    link: (0, import_fields7.text)()
  }
});

// schemas/Message.ts
var import_fields8 = require("@keystone-6/core/fields");
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
    subject: (0, import_fields8.text)(),
    message: (0, import_fields8.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    sender: (0, import_fields8.relationship)({
      ref: "User.messageSender"
    }),
    receiver: (0, import_fields8.relationship)({
      ref: "User.messageReceiver"
    }),
    sent: (0, import_fields8.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    read: (0, import_fields8.checkbox)({ defaultValue: false, label: "Read" }),
    link: (0, import_fields8.text)()
  }
});

// schemas/PbisCard.ts
var import_fields9 = require("@keystone-6/core/fields");
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
    category: (0, import_fields9.text)({
      isIndexed: true
    }),
    cardMessage: (0, import_fields9.text)({
      ui: {
        displayMode: "textarea"
      },
      isIndexed: true
    }),
    student: (0, import_fields9.relationship)({
      ref: "User.studentPbisCards"
    }),
    teacher: (0, import_fields9.relationship)({
      ref: "User.teacherPbisCards"
    }),
    dateGiven: (0, import_fields9.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    counted: (0, import_fields9.checkbox)({ defaultValue: false, label: "Counted" })
  }
});

// schemas/PbisCollection.ts
var import_fields10 = require("@keystone-6/core/fields");
var import_core11 = require("@keystone-6/core");
var PbisCollection = (0, import_core11.list)({
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
      initialColumns: ["name", "collectionDate"],
      pageSize: 100
    }
  },
  fields: {
    name: (0, import_fields10.text)(),
    collectionDate: (0, import_fields10.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    personalLevelWinners: (0, import_fields10.text)({
      ui: {
        itemView: {
          fieldMode: "hidden"
        },
        listView: {
          fieldMode: "hidden"
        }
      }
    }),
    randomDrawingWinners: (0, import_fields10.text)({
      ui: {
        itemView: {
          fieldMode: "hidden"
        },
        listView: {
          fieldMode: "hidden"
        }
      }
    }),
    taTeamsLevels: (0, import_fields10.text)({
      ui: {
        itemView: {
          fieldMode: "hidden"
        },
        listView: {
          fieldMode: "hidden"
        }
      }
    }),
    taTeamNewLevelWinners: (0, import_fields10.text)({
      ui: {
        itemView: {
          fieldMode: "hidden"
        },
        listView: {
          fieldMode: "hidden"
        }
      }
    }),
    currentPbisTeamGoal: (0, import_fields10.text)({
      defaultValue: "0",
      validation: { isRequired: true }
    }),
    collectedCards: (0, import_fields10.text)(),
    dateModified: (0, import_fields10.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    lastModifiedBy: (0, import_fields10.relationship)({ ref: "User" })
  }
});

// schemas/PbisCollectionDate.ts
var import_fields11 = require("@keystone-6/core/fields");
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
    collectionDate: (0, import_fields11.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    randomDrawingWinners: (0, import_fields11.relationship)({
      ref: "RandomDrawingWin.collectionDate",
      many: true
    }),
    personalLevelWinners: (0, import_fields11.relationship)({
      ref: "User",
      many: true
    }),
    taNewLevelWinners: (0, import_fields11.relationship)({
      ref: "User",
      many: true
    }),
    staffRandomWinners: (0, import_fields11.relationship)({
      ref: "User",
      many: true
    }),
    collectedCards: (0, import_fields11.text)(),
    lastModifiedBy: (0, import_fields11.relationship)({ ref: "User" })
  }
});

// schemas/PbisTeam.ts
var import_fields12 = require("@keystone-6/core/fields");
var import_core13 = require("@keystone-6/core");
var PbisTeam = (0, import_core13.list)({
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
      initialColumns: ["teamName", "taTeacher"],
      pageSize: 100
    }
  },
  fields: {
    teamName: (0, import_fields12.text)(),
    taTeacher: (0, import_fields12.relationship)({
      ref: "User.taTeam",
      many: true
    }),
    uncountedCards: (0, import_fields12.integer)({ defaultValue: 0 }),
    countedCards: (0, import_fields12.integer)({ defaultValue: 0 }),
    currentLevel: (0, import_fields12.integer)({ defaultValue: 0 }),
    numberOfStudents: (0, import_fields12.integer)(),
    averageCardsPerStudent: (0, import_fields12.integer)({ defaultValue: 0 }),
    dateModified: (0, import_fields12.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    lastModifiedBy: (0, import_fields12.relationship)({ ref: "User" })
  }
});

// schemas/RandomDrawingWin.ts
var import_fields13 = require("@keystone-6/core/fields");
var import_core14 = require("@keystone-6/core");
var RandomDrawingWin = (0, import_core14.list)({
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
var import_core15 = require("@keystone-6/core");
var StudentFocus = (0, import_core15.list)({
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
var import_core16 = require("@keystone-6/core");
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
  })
};
var permissionsList = Object.keys(
  permissionFields
);

// schemas/User.ts
var User = (0, import_core16.list)({
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
    specialGroupStudents: (0, import_fields16.relationship)({ ref: "User", many: true }),
    coTeachesWithTeacher: (0, import_fields16.relationship)({ ref: "User", many: true }),
    //other relationships
    taTeam: (0, import_fields16.relationship)({ ref: "PbisTeam.taTeacher" }),
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
    //PBIS Collection Winners
    currentTaWinner: (0, import_fields16.relationship)({
      ref: "User.studentIsCurrentWinner",
      many: false
    }),
    previousTaWinner: (0, import_fields16.relationship)({
      ref: "User.studentIsPreviousWinner",
      many: false
    }),
    studentIsCurrentWinner: (0, import_fields16.relationship)({
      ref: "User.currentTaWinner",
      many: false
    }),
    studentIsPreviousWinner: (0, import_fields16.relationship)({
      ref: "User.previousTaWinner",
      many: false
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
    // Important Info
    callbackCount: (0, import_fields16.integer)({ defaultValue: 0 }),
    totalCallbackCount: (0, import_fields16.integer)({ defaultValue: 0 }),
    PbisCardCount: (0, import_fields16.integer)({ defaultValue: 0 }),
    YearPbisCount: (0, import_fields16.integer)({ defaultValue: 0 }),
    teacherSubject: (0, import_fields16.text)({ defaultValue: void 0 }),
    taPbisCardCount: (0, import_fields16.integer)({ defaultValue: 0 }),
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
    // Sorting Hat
    sortingHat: (0, import_fields16.text)({ defaultValue: "" })
  },
  hooks: {
    afterOperation: async ({ operation, item, context }) => {
      if (operation === "create" && item?.isStudent) {
        const createBirtday = await context.query.Birthday.createOne({
          data: {
            student: { connect: { id: item.id } }
          }
          // resolveFields: "id",
        });
      }
    }
  }
});

// schemas/Birthday.ts
var import_fields18 = require("@keystone-6/core/fields");
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
    cakeType: (0, import_fields18.text)(),
    date: (0, import_fields18.timestamp)({
      // validation: {isRequired: true},
      isIndexed: true
    }),
    hasChosen: (0, import_fields18.checkbox)({
      defaultValue: false,
      label: "Has Chosen a Cake"
    }),
    hasDelivered: (0, import_fields18.checkbox)({
      defaultValue: false,
      label: "Has gotten their cake"
    }),
    student: (0, import_fields18.relationship)({
      ref: "User.birthday"
    })
  }
});

// schemas/BugReport.ts
var import_fields19 = require("@keystone-6/core/fields");
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
  ui: {
    listView: {
      initialColumns: ["name", "description", "submittedBy"],
      initialSort: { field: "date", direction: "ASC" },
      pageSize: 100
    }
  },
  fields: {
    name: (0, import_fields19.text)({ validation: { isRequired: true } }),
    description: (0, import_fields19.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    submittedBy: (0, import_fields19.relationship)({
      ref: "User"
    }),
    date: (0, import_fields19.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    read: (0, import_fields19.checkbox)({ defaultValue: false })
  }
});

// schemas/Bullying.ts
var import_fields20 = require("@keystone-6/core/fields");
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
    studentOffender: (0, import_fields20.relationship)({
      ref: "User"
    }),
    teacherAuthor: (0, import_fields20.relationship)({
      ref: "User"
    }),
    dateReported: (0, import_fields20.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    dateOfEvent: (0, import_fields20.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    investigationDate: (0, import_fields20.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    studentReporter: (0, import_fields20.text)(),
    employeeWitness: (0, import_fields20.text)(),
    studentWitness: (0, import_fields20.text)(),
    studentsInterviewed: (0, import_fields20.text)(),
    initialActions: (0, import_fields20.text)(),
    nextSteps: (0, import_fields20.text)(),
    reporter: (0, import_fields20.text)(),
    description: (0, import_fields20.text)(),
    determination: (0, import_fields20.select)({
      options: [
        { value: "No", label: "No" },
        { value: "Yes", label: "Yes" }
      ]
    }),
    determinationDate: (0, import_fields20.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    determinationExplanation: (0, import_fields20.text)(),
    assignmentInvestigator: (0, import_fields20.text)()
  }
});

// schemas/SortingHatQuestion.ts
var import_fields21 = require("@keystone-6/core/fields");
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
    question: (0, import_fields21.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    gryffindorChoice: (0, import_fields21.text)(),
    hufflepuffChoice: (0, import_fields21.text)(),
    ravenclawChoice: (0, import_fields21.text)(),
    slytherinChoice: (0, import_fields21.text)(),
    createdBy: (0, import_fields21.relationship)({
      ref: "User"
    })
  }
});

// schemas/TrimesterAward.ts
var import_fields22 = require("@keystone-6/core/fields");
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
    howl: (0, import_fields22.select)({
      options: [
        { value: "Respect", label: "Respect" },
        { value: "Responsibility", label: "Responsibility" },
        { value: "Perseverance", label: "Perseverance" }
      ],
      validation: { isRequired: true }
    }),
    trimester: (0, import_fields22.select)({
      options: [
        { value: "1", label: "1" },
        { value: "2", label: "2" },
        { value: "3", label: "3" }
      ],
      isIndexed: true
    }),
    date: (0, import_fields22.timestamp)({
      validation: { isRequired: true },
      defaultValue: { kind: "now" }
    }),
    student: (0, import_fields22.relationship)({
      ref: "User"
    }),
    teacher: (0, import_fields22.relationship)({
      ref: "User"
    })
  }
});

// schemas/video.ts
var import_fields23 = require("@keystone-6/core/fields");
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
    name: (0, import_fields23.text)({ validation: { isRequired: true } }),
    description: (0, import_fields23.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    onHomePage: (0, import_fields23.checkbox)({ defaultValue: false, label: "On Home Page" }),
    type: (0, import_fields23.select)({
      options: [
        { value: "google drive", label: "google drive" },
        { value: "youtube", label: "Youtube" }
      ],
      validation: { isRequired: true }
    }),
    link: (0, import_fields23.text)()
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

// mutations/queryCommunicator.ts
var import_core24 = require("@keystone-6/core");
var queryCommunicator = (base) => import_core24.graphql.field({
  type: import_core24.graphql.JSON,
  args: {
    question: import_core24.graphql.arg({ type: import_core24.graphql.nonNull(import_core24.graphql.String) }),
    model: import_core24.graphql.arg({ type: import_core24.graphql.nonNull(import_core24.graphql.String) })
  },
  resolve: async (source, args, context) => {
    const session2 = await context.session;
    if (!session2) {
      throw new Error("You must be logged in to use the communicator");
    }
    console.log(session2.data);
    if (!session2.data.isStaff) {
      throw new Error("Only staff members can access the communicator");
    }
    if (!session2.data.isCommunicatorEnabled) {
      throw new Error(
        "You do not have permission to use the communicator. Please contact an administrator."
      );
    }
    const COMMUNICATOR_ENDPOINT = process.env.COMMUNICATOR_ENDPOINT;
    const COMMUNICATOR_API_KEY = process.env.COMMUNICATOR_API_KEY;
    if (!COMMUNICATOR_ENDPOINT || !COMMUNICATOR_API_KEY) {
      console.error("Communicator service configuration is missing");
      throw new Error("Communicator service is not configured");
    }
    const user = await context.query.User.findOne({
      where: { id: session2.itemId },
      query: "id name email"
    });
    if (!user) {
      throw new Error("User not found");
    }
    try {
      const response = await fetch(`${COMMUNICATOR_ENDPOINT}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": COMMUNICATOR_API_KEY
        },
        body: JSON.stringify({
          question: args.question,
          model: args.model,
          includeRawData: true,
          userId: user.id,
          userName: user.name
        })
      });
      if (!response.ok) {
        const errorText = await response.text();
        let errorDetails = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorDetails = JSON.stringify(errorJson, null, 2);
        } catch {
        }
        const errorMessage = `Communicator API error (${response.status} ${response.statusText}):
${errorDetails}`;
        console.error(errorMessage);
        await context.query.CommunicatorChat.createOne({
          data: {
            user: { connect: { id: user.id } },
            question: args.question,
            model: args.model,
            hasError: "true",
            errorMessage,
            rawData: { error: errorText, status: response.status }
          }
        });
        return {
          error: true,
          message: `The communicator service returned an error: ${response.statusText}`,
          details: errorDetails,
          status: response.status
        };
      }
      const data = await response.json();
      await context.query.CommunicatorChat.createOne({
        data: {
          user: { connect: { id: user.id } },
          question: data.question || args.question,
          explanation: data.explanation || null,
          graphqlQuery: data.graphqlQuery || null,
          model: args.model,
          iterations: data.iterations || null,
          evaluationScore: data.evaluationScore || null,
          hasError: "false",
          rawData: data.rawData || data,
          timestamp: data.timestamp || null
        }
      });
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to query communicator service";
      console.error("Communicator Query Error:", error);
      try {
        await context.query.CommunicatorChat.createOne({
          data: {
            user: { connect: { id: user.id } },
            question: args.question,
            model: args.model,
            hasError: "true",
            errorMessage,
            rawData: { error: errorMessage }
          }
        });
      } catch (dbError) {
        console.error("Failed to save error to database:", dbError);
      }
      return {
        error: true,
        message: errorMessage
      };
    }
  }
});

// mutations/recalculateCallback.ts
var import_core25 = require("@keystone-6/core");
var gql2 = String.raw;
var recalculateCallback = (base) => import_core25.graphql.field({
  type: base.object("Callback"),
  args: {
    callbackId: import_core25.graphql.arg({ type: import_core25.graphql.nonNull(import_core25.graphql.ID) })
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
var import_core26 = require("@keystone-6/core");
var sendEmail = (base) => import_core26.graphql.field({
  type: import_core26.graphql.Boolean,
  args: {
    emailData: import_core26.graphql.arg({ type: import_core26.graphql.JSON })
  },
  resolve: async (source, args, context) => {
    console.log("Sending an Email", args.emailData);
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
var import_core27 = require("@keystone-6/core");
var gql3 = String.raw;
var updateStudentSchedules = (base) => import_core27.graphql.field({
  type: import_core27.graphql.String,
  args: {
    studentScheduleData: import_core27.graphql.arg({ type: import_core27.graphql.JSON })
  },
  resolve: async (source, args, context) => {
    console.log("Updating Student Schedules");
    const allStudentUpdateResults = [];
    if (!args.studentScheduleData) return null;
    const studentDataList = JSON.parse(
      args.studentScheduleData
    );
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
        if (student.block1) {
          const block1Teacher = await context.query.User.findMany({
            where: { email: { equals: student.block1 } },
            query: gql3`
      id
    email
    `
          });
          if (block1Teacher.length > 0) {
            studentUpdateResults.block1Teacher = {
              connect: { id: block1Teacher[0].id }
            };
          }
        }
        if (student.block2) {
          const block2Teacher = await context.query.User.findMany({
            where: { email: { equals: student.block2 } },
            query: gql3`
      id
    email
    `
          });
          if (block2Teacher.length > 0) {
            studentUpdateResults.block2Teacher = {
              connect: { id: block2Teacher[0].id }
            };
          }
        }
        if (student.block3) {
          const block3Teacher = await context.query.User.findMany({
            where: { email: { equals: student.block3 } },
            query: gql3`
      id
    email
    `
          });
          if (block3Teacher.length > 0) {
            studentUpdateResults.block3Teacher = {
              connect: { id: block3Teacher[0].id }
            };
          }
        }
        if (student.block4) {
          const block4Teacher = await context.query.User.findMany({
            where: { email: { equals: student.block4 } },
            query: gql3`
      id
    email
    `
          });
          if (block4Teacher.length > 0) {
            studentUpdateResults.block4Teacher = {
              connect: { id: block4Teacher[0].id }
            };
          }
        }
        if (student.block5) {
          const block5Teacher = await context.query.User.findMany({
            where: { email: { equals: student.block5 } },
            query: gql3`
      id
    email
    `
          });
          if (block5Teacher.length > 0) {
            studentUpdateResults.block5Teacher = {
              connect: { id: block5Teacher[0].id }
            };
          }
        }
        if (student.block6) {
          const block6Teacher = await context.query.User.findMany({
            where: { email: { equals: student.block6 } },
            query: gql3`
      id
    email
    `
          });
          if (block6Teacher.length > 0) {
            studentUpdateResults.block6Teacher = {
              connect: { id: block6Teacher[0].id }
            };
          }
        }
        if (student.block7) {
          const block7Teacher = await context.query.User.findMany({
            where: { email: { equals: student.block7 } },
            query: gql3`
      id
    email
    `
          });
          if (block7Teacher.length > 0) {
            studentUpdateResults.block7Teacher = {
              connect: { id: block7Teacher[0].id }
            };
          }
        }
        if (student.block8) {
          const block8Teacher = await context.query.User.findMany({
            where: { email: { equals: student.block8 } },
            query: gql3`
      id
    email
    `
          });
          if (block8Teacher.length > 0) {
            studentUpdateResults.block8Teacher = {
              connect: { id: block8Teacher[0].id }
            };
          }
        }
        if (student.block9) {
          const block9Teacher = await context.query.User.findMany({
            where: { email: { equals: student.block9 } },
            query: gql3`
      id
    email
    `
          });
          if (block9Teacher.length > 0) {
            studentUpdateResults.block9Teacher = {
              connect: { id: block9Teacher[0].id }
            };
          }
        }
        if (student.block10) {
          const block10Teacher = await context.query.User.findMany({
            where: { email: { equals: student.block10 } },
            query: gql3`
      id
    email
    `
          });
          if (block10Teacher.length > 0) {
            studentUpdateResults.block10Teacher = {
              connect: { id: block10Teacher[0].id }
            };
          }
        }
        if (student.ta) {
          const taTeacher = await context.query.User.findMany({
            where: { email: { equals: student.ta } },
            query: gql3`
      id
    email
    `
          });
          if (taTeacher.length > 0) {
            studentUpdateResults.taTeacher = {
              connect: { id: taTeacher[0].id }
            };
          }
        }
        if (!studentInfo[0]?.id) {
          const nameArray = student.email.split("@")[0].split(".");
          studentUpdateResults.name = nameArray.join(" ");
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
        studentUpdateResults.name = studentInfo[0]?.name;
        allStudentUpdateResults.push(studentUpdateResults);
      })
    );
    const name = JSON.stringify(allStudentUpdateResults);
    return name;
  }
});

// keystone.ts
var databaseURL = process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/postgres";
if (databaseURL.includes("local")) console.log(databaseURL);
var keystone_default = withAuth(
  (0, import_core28.config)({
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
      Birthday,
      BugReport,
      Bullying,
      Callback,
      Calendar,
      CellPhoneViolation,
      ChromebookCheck,
      ChromebookAssignment,
      CommunicatorChat,
      Discipline,
      Link,
      Message,
      PbisCard,
      PbisCollection,
      PbisTeam,
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
      extendGraphqlSchema: import_core28.graphql.extend((base) => {
        return {
          mutation: {
            recalculateCallback: recalculateCallback(base),
            sendEmail: sendEmail(base),
            updateStudentSchedules: updateStudentSchedules(base),
            addStaff: addStaff(base),
            queryCommunicator: queryCommunicator(base)
          }
        };
      })
    }
  })
);
//# sourceMappingURL=config.js.map

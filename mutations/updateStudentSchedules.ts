import { graphql } from "@keystone-6/core";

const gql = String.raw;

type StudentData = {
  email: string;
  block1: string;
  block2: string;
  block3: string;
  block4: string;
  block5: string;
  block6: string;
  block7: string;
  block8: string;
  block9: string;
  block10: string;
  ta: string;
};

type StudentUpdateResultData = {
  email?: string;
  name?: string;
  password?: string;
  isStudent?: boolean;
  existed?: boolean;
  block1Teacher?: { connect: { id: string } } | null;
  block2Teacher?: { connect: { id: string } } | null;
  block3Teacher?: { connect: { id: string } } | null;
  block4Teacher?: { connect: { id: string } } | null;
  block5Teacher?: { connect: { id: string } } | null;
  block6Teacher?: { connect: { id: string } } | null;
  block7Teacher?: { connect: { id: string } } | null;
  block8Teacher?: { connect: { id: string } } | null;
  block9Teacher?: { connect: { id: string } } | null;
  block10Teacher?: { connect: { id: string } } | null;
  taTeacher?: { connect: { id: string } } | null;
};

export const updateStudentSchedules = (base: any) =>
  graphql.field({
    type: graphql.String,
    args: {
      studentScheduleData: graphql.arg({ type: graphql.JSON }),
    },
    resolve: async (source, args, context) => {
      // get JSON array of students and updated schedules
      console.log("Updating Student Schedules");
      const allStudentUpdateResults: StudentUpdateResultData[] = [];
      if (!args.studentScheduleData) return null;
      const studentDataList = args.studentScheduleData as StudentData[];

      //go through each student and update their schedule or create a new student
      await Promise.all(
        studentDataList.map(async (student) => {
          const studentUpdateResults: StudentUpdateResultData = {};
          const studentInfo = await context.query.User.findMany({
            where: { email: { equals: student.email } },
            query: gql`
              id
              email
              name
          `,
          });

          studentUpdateResults.email = student.email;

          //check if the student has a teacher for block 1
          if (student.block1) {
            const block1Teacher = await context.query.User.findMany({
              where: { email: { equals: student.block1 } },
              query: gql`
      id
    email
    `,
            });

            //if the student has a teacher for block 1 set the teacher to that teacher
            if (block1Teacher.length > 0) {
              studentUpdateResults.block1Teacher = {
                connect: { id: block1Teacher[0].id },
              };
            }
          }
          if (student.block2) {
            const block2Teacher = await context.query.User.findMany({
              where: { email: { equals: student.block2 } },
              query: gql`
      id
    email
    `,
            });
            if (block2Teacher.length > 0) {
              studentUpdateResults.block2Teacher = {
                connect: { id: block2Teacher[0].id },
              };
            }
          }
          if (student.block3) {
            const block3Teacher = await context.query.User.findMany({
              where: { email: { equals: student.block3 } },
              query: gql`
      id
    email
    `,
            });
            if (block3Teacher.length > 0) {
              studentUpdateResults.block3Teacher = {
                connect: { id: block3Teacher[0].id },
              };
            }
          }
          if (student.block4) {
            const block4Teacher = await context.query.User.findMany({
              where: { email: { equals: student.block4 } },
              query: gql`
      id
    email
    `,
            });
            if (block4Teacher.length > 0) {
              studentUpdateResults.block4Teacher = {
                connect: { id: block4Teacher[0].id },
              };
            }
          }
          if (student.block5) {
            const block5Teacher = await context.query.User.findMany({
              where: { email: { equals: student.block5 } },
              query: gql`
      id
    email
    `,
            });
            if (block5Teacher.length > 0) {
              studentUpdateResults.block5Teacher = {
                connect: { id: block5Teacher[0].id },
              };
            }
          }
          if (student.block6) {
            const block6Teacher = await context.query.User.findMany({
              where: { email: { equals: student.block6 } },
              query: gql`
      id
    email
    `,
            });
            if (block6Teacher.length > 0) {
              studentUpdateResults.block6Teacher = {
                connect: { id: block6Teacher[0].id },
              };
            }
          }
          if (student.block7) {
            const block7Teacher = await context.query.User.findMany({
              where: { email: { equals: student.block7 } },
              query: gql`
      id
    email
    `,
            });
            if (block7Teacher.length > 0) {
              studentUpdateResults.block7Teacher = {
                connect: { id: block7Teacher[0].id },
              };
            }
          }
          if (student.block8) {
            const block8Teacher = await context.query.User.findMany({
              where: { email: { equals: student.block8 } },
              query: gql`
      id
    email
    `,
            });
            if (block8Teacher.length > 0) {
              studentUpdateResults.block8Teacher = {
                connect: { id: block8Teacher[0].id },
              };
            }
          }
          if (student.block9) {
            const block9Teacher = await context.query.User.findMany({
              where: { email: { equals: student.block9 } },
              query: gql`
      id
    email
    `,
            });
            if (block9Teacher.length > 0) {
              studentUpdateResults.block9Teacher = {
                connect: { id: block9Teacher[0].id },
              };
            }
          }
          if (student.block10) {
            const block10Teacher = await context.query.User.findMany({
              where: { email: { equals: student.block10 } },
              query: gql`
      id
    email
    `,
            });
            if (block10Teacher.length > 0) {
              studentUpdateResults.block10Teacher = {
                connect: { id: block10Teacher[0].id },
              };
            }
          }
          if (student.ta) {
            const taTeacher = await context.query.User.findMany({
              where: { email: { equals: student.ta } },
              query: gql`
      id
    email
    `,
            });
            if (taTeacher.length > 0) {
              studentUpdateResults.taTeacher = {
                connect: { id: taTeacher[0].id },
              };
            }
          }

          //if user is new create new user
          if (!studentInfo[0]?.id) {
            console.log(`Creating new user ${student.email}`);
            //get name as a string from email separated by .
            const nameArray = student.email.split("@")[0].split(".");
            //join the names together
            studentUpdateResults.name = nameArray.join(" ");
            studentUpdateResults.isStudent = true;
            studentUpdateResults.password = "password";
            const createdStudent = await context.query.User.createOne({
              data: {
                ...studentUpdateResults,
              },
              query: "id",
            });
          }

          //if user exists update their schedule
          if (studentInfo[0]?.id) {
            console.log(`Updating user ${student.email}`);
            const updatedStudent = await context.query.User.updateOne({
              where: { id: studentInfo[0].id },
              data: {
                ...studentUpdateResults,
              },
            });
          }
          // save if student is new or updated and add data to array
          studentUpdateResults.existed = !!studentInfo[0];
          allStudentUpdateResults.push(studentUpdateResults);
        })
      );

      const name = JSON.stringify(allStudentUpdateResults);
      return name;
    },
  });

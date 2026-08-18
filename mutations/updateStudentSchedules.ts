import { graphql } from "@keystone-6/core";
import { NUMBER_OF_BLOCKS } from "../schemas/blocks";

const gql = String.raw;

type StudentData = {
  email: string;
  ta: string;
  // block1..block{NUMBER_OF_BLOCKS}, each holding a teacher's email address
  [block: string]: string;
};

type TeacherConnection = { connect: { id: string } } | null;

type StudentUpdateResultData = {
  email?: string;
  name?: string;
  password?: string;
  isStudent?: boolean;
  existed?: boolean;
  taTeacher?: TeacherConnection;
  // block1Teacher..block{NUMBER_OF_BLOCKS}Teacher
  [blockTeacher: string]: unknown;
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
      const studentDataList = JSON.parse(
        args.studentScheduleData as string
      ) as StudentData[];
      // Every slot a student can be scheduled into. Block numbers are keyed on
      // colour, so block{N} on a student always refers to the same class as
      // block{N} on the teacher.
      const slots = [
        ...Array.from({ length: NUMBER_OF_BLOCKS }, (_, i) => `block${i + 1}`),
        "ta",
      ];

      // Resolve every distinct teacher email once, rather than re-querying for
      // each student. With ~250 students this is ~35 lookups instead of ~3,250.
      const teacherEmails = [
        ...new Set(
          studentDataList
            .flatMap((student) => slots.map((slot) => student[slot]))
            .filter((email): email is string => !!email)
        ),
      ];
      const teachers = await context.query.User.findMany({
        where: { email: { in: teacherEmails } },
        query: gql`
          id
          email
        `,
      });
      const teacherIdByEmail = new Map<string, string>(
        teachers.map((teacher: any) => [teacher.email, teacher.id])
      );

      const unmatchedEmails = teacherEmails.filter(
        (email) => !teacherIdByEmail.has(email)
      );
      if (unmatchedEmails.length > 0) {
        console.warn(
          `updateStudentSchedules: no user found for ${unmatchedEmails.length} teacher email(s): ${unmatchedEmails.join(", ")}`
        );
      }

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

          for (const slot of slots) {
            const teacherId = teacherIdByEmail.get(student[slot]);
            if (!teacherId) continue;
            const target = slot === "ta" ? "taTeacher" : `${slot}Teacher`;
            studentUpdateResults[target] = { connect: { id: teacherId } };
          }

          //if user is new create new user
          if (!studentInfo[0]?.id) {
            //get name as a string from email separated by .
            const nameArray = student.email.split("@")[0].split(".");
            //join the names together
            studentUpdateResults.name = nameArray.join(" ");
            studentUpdateResults.isStudent = true;
            studentUpdateResults.password = "notpassword";
            const createdStudent = await context.query.User.createOne({
              data: {
                ...studentUpdateResults,
              },
              query: "id",
            });
          }

          //if user exists update their schedule
          if (studentInfo[0]?.id) {
            const updatedStudent = await context.query.User.updateOne({
              where: { id: studentInfo[0].id },
              data: {
                ...studentUpdateResults,
              },
            });
          }
          // save if student is new or updated and add data to array
          studentUpdateResults.existed = !!studentInfo[0];
          studentUpdateResults.name = studentInfo[0]?.name;
          allStudentUpdateResults.push(studentUpdateResults);
        })
      );

      const name = JSON.stringify(allStudentUpdateResults);
      return name;
    },
  });

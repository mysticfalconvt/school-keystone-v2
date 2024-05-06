import { KeystoneContext, SessionStore } from "@keystone-6/core/types";
import { Session } from "../types";
// import { UserUpdateInput, PbisTeamUpdateInput } from '../.keystone/schema-types';
import { User } from "../schemas/User";

const graphql = String.raw;

async function recalculateoldPbis(
  root: any,
  { userId }: { userId: string },
  context: KeystoneContext
): Promise<UserUpdateInput> {
  // console.log('Updating PBIS Count');
  const student = await context.query.User.findOne({
    where: { id: userId },
    query: graphql`

            id
             cards: studentPbisCardsCount(where:{counted:{equals: false}})
             yearCards: studentPbisCardsCount
            taTeacher{
        id
        taTeam{
            id
        }
    }
          `,
  });
  // console.log(student)
  const taTeacher = await context.query.User.findOne({
    where: { id: student.taTeacher.id },
    query: graphql`
        id
         cards: teacherPbisCardsCount(where:{counted:{equals: false}})
         yearCards: teacherPbisCardsCount
        taTeam{
            id
        }
    `,
  });
  // console.log("taTeacher",taTeacher)
  const updateTA = await context.query.User.updateOne({
    where: { id: student.taTeacher.id },
    data: {
      PbisCardCount: taTeacher.cards,
      YearPbisCount: taTeacher.yearCards,
    },
  });
  // console.log("updateTA",updateTA)
  const totalTeamCards = await context.query.PbisCard.count({
    where: { teacher: { taTeam: { id: { equals: taTeacher.taTeam.id } } } },
  });
  // console.log("totalTeamCards",totalTeamCards)
  const uncountedTeamCards = await context.query.PbisCard.count({
    where: {
      teacher: { taTeam: { id: { equals: taTeacher.taTeam.id } } },
      counted: { equals: false },
    },
  });
  // console.log("uncountedTeamCards",uncountedTeamCards)

  const updatedTeam = await context.query.PbisTeam.updateOne({
    where: { id: taTeacher.taTeam.id },
    data: {
      uncountedCards: uncountedTeamCards,
      countedCards: totalTeamCards,
    },
  });

  return await context.query.User.updateOne({
    where: { id: userId },
    data: {
      PbisCardCount: student.cards,
      YearPbisCount: student.yearCards,
    },
  });
}
export default recalculatePbis;

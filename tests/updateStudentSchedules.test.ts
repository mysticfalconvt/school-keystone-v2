import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { updateStudentSchedules } from '../mutations/updateStudentSchedules';

type UserData = Record<string, unknown>;

const resolveImport = async (
  student: Record<string, unknown>,
  existingName?: string,
) => {
  let updatedData: UserData | undefined;
  let createdData: UserData | undefined;
  const field = updateStudentSchedules(null) as unknown as {
    resolve: (
      source: unknown,
      args: { studentScheduleData: string },
      context: unknown,
    ) => Promise<string>;
  };
  const context = {
    query: {
      User: {
        findMany: async ({ where }: { where: Record<string, unknown> }) => {
          if ('in' in (where.email as Record<string, unknown>)) return [];
          return existingName
            ? [{ id: 'student-1', email: student.email, name: existingName }]
            : [];
        },
        updateOne: async ({ data }: { data: UserData }) => {
          updatedData = data;
        },
        createOne: async ({ data }: { data: UserData }) => {
          createdData = data;
        },
      },
    },
  };

  await field.resolve(null, { studentScheduleData: JSON.stringify([student]) }, context);
  return { updatedData, createdData };
};

describe('updateStudentSchedules names', () => {
  test('does not replace an existing name when an import has no name', async () => {
    const { updatedData } = await resolveImport(
      { email: 'hectorm.figueroa@example.test', ta: '' },
      'Héctorm Figueroa',
    );

    assert.ok(updatedData);
    assert.equal(updatedData.name, undefined);
  });

  test('updates an existing name when the import supplies one', async () => {
    const { updatedData } = await resolveImport(
      { email: 'hectorm.figueroa@example.test', ta: '', name: 'Héctorm Figueroa' },
      'Hector Figueroa',
    );

    assert.equal(updatedData?.name, 'Héctorm Figueroa');
  });

  test('derives a name only for a newly created student without one', async () => {
    const { createdData } = await resolveImport({
      email: 'hectorm.figueroa@example.test',
      ta: '',
    });

    assert.equal(createdData?.name, 'hectorm figueroa');
  });
});

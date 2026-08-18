// How many class blocks a student can be scheduled into.
//
// NCUJHS runs six colour-coded classes (ROYGBP) that rotate through six time
// slots, on an A/B rotation. A student's teacher for a given colour can differ
// between the A and B rotations, so each colour needs two slots:
//
//   block1..block6   = Red, Orange, Yellow, Green, Blue, Purple  (A rotation)
//   block7..block12  = Red, Orange, Yellow, Green, Blue, Purple  (B rotation)
//
// Block numbers are keyed on colour so a number means the same thing to every
// student and every teacher - the assignment views look up a student's
// block{N}Teacher and then read that teacher's block{N}Assignment.
//
// Changing this requires adding the matching block{N}Teacher / block{N}Students
// / block{N}Assignment / block{N}ClassName / block{N}AssignmentLastUpdated
// fields to schemas/User.ts, and updating NEXT_PUBLIC_NUMBER_OF_BLOCKS in the
// front end.
export const NUMBER_OF_BLOCKS = 12;

import { frame1 } from './examples/example'

frame1.generateLocals()

// for (const [key, value] of Object.entries(frame1.generateLocals())) {
//   console.table(value.local_globalCoordinates)
// }

frame1.generateData()
frame1.generateOrderDOF({ isRestrictedAbove: false })
frame1.createDictionary()
frame1.buildGlobal()
frame1.buildForces()
frame1.buildForcesFixedEndMoments()
frame1.buildDisplacements()
frame1.splitGlobal()
frame1.splitFEM()
if (frame1.solveDisplacement().ok) {
  frame1.solveForces()
}

import { Edges } from '../models/Edges.ts'
import { Frame } from '../models/Frame.ts'
import { Vertices } from '../models/Vertices.ts'

const vertices = new Vertices()

vertices.add({
  name: 'v1',
  coordinates: { x: 15 * 12, y: 20 * 12 },
  forces: { x: 0, y: 0, z: -100 }, //nodales
  displacements: { x: 0, y: 0, z: 0 },
  k: { x: 0, y: 0, z: 0 },
  isRestricted: { x: false, y: false, z: false },
  inputDOF: { x: 7, y: 8, z: 9 },
})
vertices.add({
  name: 'v2',
  coordinates: { x: 15 * 12, y: 0 },
  forces: { x: 0, y: 0, z: 0 }, //nodales
  displacements: { x: 0, y: 0, z: 0 },
  k: { x: 0, y: 0, z: 0 },
  isRestricted: { x: true, y: true, z: true },
  inputDOF: { x: 1, y: 2, z: 3 },
})
vertices.add({
  name: 'v3',
  coordinates: { x: 0, y: 20 * 12 },
  forces: { x: 0, y: 0, z: 0 }, //nodales
  displacements: { x: 0, y: 0, z: 0 },
  k: { x: 0, y: 0, z: 0 },
  isRestricted: { x: true, y: true, z: true },
  inputDOF: { x: 4, y: 5, z: 6 },
})

// console.log(vertices.getData());

const edges = new Edges(vertices.getData())

edges.add({
  name: 'e1',
  from: 'v2',
  to: 'v1',
  elasticity: 29 * 10 ** 3, //E
  inertia: 1200, //I
  shear: 11.2 * 10 ** 3, //G
  polarInertia: 400, //J
  fixedEndMoments: {
    i: { x: 0, y: 0, z: 0 },
    j: { x: 0, y: 0, z: 0 },
  },
})

edges.add({
  name: 'e2',
  from: 'v1',
  to: 'v3',
  elasticity: 29 * 10 ** 3, //E
  inertia: 1200, //I
  shear: 11.2 * 10 ** 3, //G
  polarInertia: 400, //J
  fixedEndMoments: {
    i: { x: 0, y: 0, z: 0 },
    j: { x: 0, y: 0, z: 0 },
  },
})

// console.log(edges.getData());

export const frame1 = new Frame(edges.getData())

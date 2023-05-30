import { Workbook } from 'exceljs'
// import { frame1 } from './examples/example'
// import { utils, writeFile } from 'xlsx'
import { Edges } from './models/Edges'
import { Frame } from './models/Frame'
import { Vertices } from './models/Vertices'
import { readExcel } from './utils/readExcel'

// frame1.generateLocals()
// frame1.generateData()
// frame1.generateOrderDOF({ isRestrictedAbove: false })
// frame1.createDictionary()
// frame1.buildGlobal()
// frame1.buildForces()
// frame1.buildForcesFixedEndMoments()
// frame1.buildDisplacements()
// frame1.splitGlobal()
// frame1.splitFEM()
// if (frame1.solveDisplacement().ok) {
//   frame1.solveForces()
// }
interface IVerticesExcelInput {
  name: string
  x: number
  y: number
  fx: number
  fy: number
  fz: number
  dx: number
  dy: number
  dz: number
  restrX: number
  restrY: number
  restrZ: number
  gdlX: number
  gdlY: number
  gdlZ: number
}

interface IEdgesExcelInput {
  name: string
  from: string
  to: string
  E: number
  G: number
  I: number
  J: number
  mep_i_x: number
  mep_i_y: number
  mep_i_z: number
  mep_j_x: number
  mep_j_y: number
  mep_j_z: number
}

const dataFromExcel = readExcel()

const verticesFromExcel = dataFromExcel.nodes
const edgesFromExcel = dataFromExcel.elements

const excelVertices = new Vertices()

for (const e of verticesFromExcel as IVerticesExcelInput[]) {
  excelVertices.add({
    name: e.name,
    coordinates: { x: e.x, y: e.y },
    forces: { x: e.fx, y: e.fy, z: e.fz }, //nodales
    displacements: { x: e.dx, y: e.dy, z: e.dz },
    k: { x: 0, y: 0, z: 0 },
    isRestricted: {
      x: e.restrX == 0 ? false : true,
      y: e.restrY == 0 ? false : true,
      z: e.restrZ == 0 ? false : true,
    },
    inputDOF: { x: 7, y: 8, z: 9 },
  })
}

const excelEdges = new Edges(excelVertices.getData())

for (const e of edgesFromExcel as IEdgesExcelInput[]) {
  excelEdges.add({
    name: e.name,
    from: e.from,
    to: e.to,
    elasticity: e.E,
    inertia: e.I,
    shear: e.G,
    polarInertia: e.J,
    fixedEndMoments: {
      i: {
        x: e.mep_i_x,
        y: e.mep_i_y,
        z: e.mep_i_z,
      },
      j: {
        x: e.mep_j_x,
        y: e.mep_j_y,
        z: e.mep_j_z,
      },
    },
  })
}

const excelFrame = new Frame(excelEdges.getData())

const locals = excelFrame.generateLocals()
excelFrame.generateData()
excelFrame.generateOrderDOF({ isRestrictedAbove: false })
excelFrame.createDictionary()
const globalK = excelFrame.buildGlobal()
const { global: globalF } = excelFrame.buildForces()
excelFrame.buildForcesFixedEndMoments()
const { global: globalU } = excelFrame.buildDisplacements()
const { kuu, kru, kur, krr } = excelFrame.splitGlobal()
const { femRestricted, femUnrestricted } = excelFrame.splitFEM()

let uSolved: number[][] = []
let fSolved: number[][] = []
if (excelFrame.solveDisplacement().ok) {
  uSolved = excelFrame.solveDisplacement().uSolved
  fSolved = excelFrame.solveForces()
}

//escribiendo hoja excel

function aoaToCell(
  sheet: any,
  arr: (number | string)[][],
  title: string,
  index: number,
  decimals = 2
) {
  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr[0].length; j++) {
      const value = arr[i][j]
      if (typeof value === 'number') {
        sheet.getRow(index + i).getCell(2 + j).value = value.toFixed(decimals)
      } else {
        sheet.getRow(index + i).getCell(2 + j).value = value
      }
    }
  }
  sheet.getRow(index + arr.length).getCell(2).value = title
  return arr.length + 3
}

function write() {
  const workbook = new Workbook()
  for (const [key, value] of Object.entries(locals)) {
    const sheet = workbook.addWorksheet(key)

    let currentRow = 2

    const cell = sheet.getRow(currentRow).getCell(2)
    cell.value = key
    currentRow++
    currentRow++

    currentRow += aoaToCell(
      sheet,
      value.transform,
      'Matriz de transformación',
      currentRow,
      2
    )
    currentRow += aoaToCell(
      sheet,
      value.transformTransposed,
      'Matriz de transformación transpuesta',
      currentRow,
      2
    )
    currentRow += aoaToCell(
      sheet,
      value.local_localCoordinates,
      'Matriz de local de rigideces en coordenadas locales',
      currentRow,
      2
    )
    currentRow += aoaToCell(
      sheet,
      value.local_globalCoordinates,
      'Matriz de local de rigideces en coordenadas globales',
      currentRow,
      2
    )
    currentRow += aoaToCell(
      sheet,
      value.fixedEndMoments_local,
      'Fuerza y momentos internos en coordenadas locales',
      currentRow,
      2
    )
    currentRow += aoaToCell(
      sheet,
      value.fixedEndMoments_global,
      'Fuerzas y momentos internos en coordenadas globales',
      currentRow,
      2
    )
  }
  //globalk
  let globalK_sheet_currentRow = 2
  const globalK_sheet = workbook.addWorksheet('globalK')

  globalK_sheet_currentRow += aoaToCell(
    globalK_sheet,
    globalK,
    'Matriz global de rigideces',
    globalK_sheet_currentRow,
    2
  )
  globalK_sheet_currentRow += aoaToCell(
    globalK_sheet,
    globalF,
    'Matriz global de fuerzas',
    globalK_sheet_currentRow,
    2
  )
  globalK_sheet_currentRow += aoaToCell(
    globalK_sheet,
    globalU,
    'Matriz global de desplazamientos',
    globalK_sheet_currentRow,
    2
  )
  globalK_sheet_currentRow += aoaToCell(
    globalK_sheet,
    kuu,
    'kuu',
    globalK_sheet_currentRow,
    2
  )
  globalK_sheet_currentRow += aoaToCell(
    globalK_sheet,
    kru,
    'kru',
    globalK_sheet_currentRow,
    2
  )
  globalK_sheet_currentRow += aoaToCell(
    globalK_sheet,
    kur,
    'kur',
    globalK_sheet_currentRow,
    2
  )
  globalK_sheet_currentRow += aoaToCell(
    globalK_sheet,
    krr,
    'krr',
    globalK_sheet_currentRow,
    2
  )
  globalK_sheet_currentRow += aoaToCell(
    globalK_sheet,
    femRestricted,
    'Fuerzas y momentos de empotramiento perfecto restringidas',
    globalK_sheet_currentRow,
    2
  )
  globalK_sheet_currentRow += aoaToCell(
    globalK_sheet,
    femUnrestricted,
    'Fuerzas y momentos de empotramiento perfecto no restringidas',
    globalK_sheet_currentRow,
    2
  )
  globalK_sheet_currentRow += aoaToCell(
    globalK_sheet,
    uSolved,
    'uSolved',
    globalK_sheet_currentRow,
    6
  )
  globalK_sheet_currentRow += aoaToCell(
    globalK_sheet,
    fSolved,
    'fSolved',
    globalK_sheet_currentRow,
    2
  )

  workbook.xlsx.writeFile('./excel/results.xlsx')
}

write()

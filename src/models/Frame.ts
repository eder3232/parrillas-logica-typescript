import { standard } from '../utils/localRigidezMatrix.ts'
import { tablePrinter } from '../utils/printer.ts'
import { IEdgesData, IEdgesOutput } from './Edges.ts'
import { IUtil, IVertex } from './Vertices.ts'

import { transpose, multiply, zeros, inv, subtract, add } from 'mathjs'

function twoDimensionalArray<T>(
  rows: number,
  columns: number,
  value: T
): T[][] {
  return Array(rows)
    .fill(null)
    .map((e) => Array(columns).fill(value))
}

interface ILocalArrays {
  transform: number[][]
  transformTransposed: number[][]
  local_localCoordinates: number[][]
  local_globalCoordinates: number[][]
  fixedEndMoments_local: number[][]
  fixedEndMoments_global: number[][]
  tableDOF: number[]
}

interface IDataArray {
  force: string | number
  displacement: string | number
  name: string
  dof_internal: number
  dof_user: number
  isRestricted: boolean
}

interface ISolvedDisplacementsReturn {
  ok: boolean
  message: string
  uSolved: number[][]
}

export class Frame {
  dataVertices: { [key: string]: IVertex }
  verticesUtils: IUtil
  dataEdges: IEdgesData
  // datos que se calcularan durante el proceso
  localArrays: { [key: string]: ILocalArrays } = {}
  settings: { isRestrictedAbove: boolean } = {
    isRestrictedAbove: true,
  }
  dataArray: {
    [key: string]: IDataArray
  } = {}
  orderDOF: {
    dof_internal: number
    isRestricted: boolean
    name: string
    dof_user: number
  }[] = []
  dofPointerInDataArray: { [key: string]: number } = {}

  globalK: number[][]

  f: {
    global: (number | string)[][]
    restricted: string[][]
    unrestricted: number[][]
    fem: number[][]
    fem_restricted: number[][]
    fem_unrestricted: number[][]
  }

  u: {
    global: (number | string)[][]
    restricted: number[][]
    unrestricted: string[][]
  }

  k: {
    krr: number[][]
    kru: number[][]
    kur: number[][]
    kuu: number[][]
  }

  solved: {
    u: {
      unrestricted: number[][]
      global: number[][]
    }
    f: { restricted: number[][]; global: number[][] }
  } = { f: { restricted: [], global: [] }, u: { unrestricted: [], global: [] } }

  constructor(edgesData: IEdgesOutput) {
    // datos de entrada que requerimos para el calculo
    this.dataVertices = edgesData.vertices.data
    this.verticesUtils = edgesData.vertices.util
    this.dataEdges = edgesData.edges
    //creando los valores necesarios para el programa
    const u = this.verticesUtils.unrestrictedDOF
    const r = this.verticesUtils.restrictedDOF
    const t = this.verticesUtils.totalDOF

    this.globalK = zeros(t, t).valueOf() as number[][]

    this.f = {
      global: zeros(t, 1).valueOf() as number[][],
      restricted: twoDimensionalArray(r, 1, ''),
      unrestricted: twoDimensionalArray(u, 1, 0),
      fem: zeros(t, 1).valueOf() as number[][],
      fem_restricted: zeros(r, 1).valueOf() as number[][],
      fem_unrestricted: zeros(u, 1).valueOf() as number[][],
    }

    this.u = {
      global: zeros(t, 1).valueOf() as number[][],
      restricted: twoDimensionalArray(r, 1, 0),
      unrestricted: twoDimensionalArray(u, 1, ''),
    }

    this.k = {
      krr: zeros(r, r).valueOf() as number[][],
      kru: zeros(r, u).valueOf() as number[][],
      kur: zeros(u, r).valueOf() as number[][],
      kuu: zeros(u, u).valueOf() as number[][],
    }
  }

  generateLocals() {
    Object.entries(this.dataEdges).map(([key, edge]) => {
      const local = standard({
        elasticity: edge.elasticity,
        inertia: edge.inertia,
        // area: edge.area,
        long: edge.long,
        shear: edge.shear,
        polarInertia: edge.polarInertia,
      })

      const c = edge.cos
      const s = edge.sin
      const transform = [
        [c, s, 0, 0, 0, 0],
        [-s, c, 0, 0, 0, 0],
        [0, 0, 1, 0, 0, 0],
        [0, 0, 0, c, s, 0],
        [0, 0, 0, -s, c, 0],
        [0, 0, 0, 0, 0, 1],
      ]

      // tablePrinter(transform, 2)

      const transformTransposed = transpose(transform)

      const global = multiply(multiply(transformTransposed, local), transform)

      // darle forma a los momentos de empotramiento perfecto

      const fixedEndMoments_i = []
      const fixedEndMoments_j = []
      for (const axis of this.verticesUtils.axisDOF) {
        fixedEndMoments_i.push(edge['fixedEndMoments']['i'][axis])
        fixedEndMoments_j.push(edge['fixedEndMoments']['j'][axis])
      }
      const fixedEndMoments = [...fixedEndMoments_i, ...fixedEndMoments_j].map(
        (e) => [e]
      )

      // tranformamos a coordenadas globales

      const fixedEndMoments_global = multiply(
        transformTransposed,
        fixedEndMoments
      ) as number[][]

      // tablePrinter(fixedEndMoments_global, 2)

      this.localArrays[key] = {
        transform: transform,
        transformTransposed: transformTransposed,
        local_localCoordinates: local,
        local_globalCoordinates: global,
        fixedEndMoments_local: fixedEndMoments_global,
        fixedEndMoments_global: fixedEndMoments_global,
        tableDOF: edge.tableDOF,
      }
    })
    return this.localArrays
  }

  generateData() {
    for (const [key, value] of Object.entries(this.dataVertices)) {
      this.verticesUtils.axisDOF.map((dof) => {
        const dataPartial: Partial<IDataArray> = {}
        const dofName = `Node-${key}-${dof}`
        const dofInternal = value.DOF[dof]['internal']
        const dofUser = value.DOF[dof]['user']
        const isRestricted = value.isRestricted[dof]

        if (value.isRestricted[dof]) {
          //grados de libertad restringidos
          dataPartial.force = `F-${key}-${dof}`
          dataPartial.displacement = value.displacements[dof]
        } else {
          // grados de libertad no restringidos
          dataPartial.force = value.forces[dof]
          dataPartial.displacement = `U-${key}-${dof}`
        }

        dataPartial['dof_internal'] = dofInternal
        dataPartial['dof_user'] = dofUser
        dataPartial['name'] = dofName
        dataPartial['isRestricted'] = isRestricted
        const data = dataPartial as IDataArray
        this.dataArray[data.dof_internal] = data
      })
    }
    return this.dataArray
  }

  generateOrderDOF({ isRestrictedAbove }: { isRestrictedAbove: boolean }) {
    const dofDataRestricted: {
      dof_user: number
      dof_internal: number
      isRestricted: boolean
      name: string
    }[] = []
    const dofDataUnrestricted: {
      dof_user: number
      dof_internal: number
      isRestricted: boolean
      name: string
    }[] = []
    this.settings.isRestrictedAbove = isRestrictedAbove

    for (const [key, value] of Object.entries(this.dataArray)) {
      if (value.isRestricted) {
        dofDataRestricted.push({
          dof_internal: +key,
          isRestricted: true,
          dof_user: value.dof_user,
          name: value.name,
        })
      } else {
        dofDataUnrestricted.push({
          dof_internal: +key,
          isRestricted: false,
          dof_user: value.dof_user,
          name: value.name,
        })
      }
    }
    // reordenando para tratar de darle la forma que quiere el usuario

    dofDataRestricted.sort((a, b) => a.dof_user - b.dof_user)
    dofDataUnrestricted.sort((a, b) => a.dof_user - b.dof_user)

    if (isRestrictedAbove) {
      this.orderDOF = [...dofDataRestricted, ...dofDataUnrestricted]
    } else {
      this.orderDOF = [...dofDataUnrestricted, ...dofDataRestricted]
    }
    return this.orderDOF
  }

  createDictionary() {
    this.orderDOF.map((e, i) => {
      this.dofPointerInDataArray[e.dof_internal] = i
    })
    // console.log(this.dofPointerInDataArray)
    return this.dofPointerInDataArray
  }

  assembler(e: ILocalArrays) {
    const lengthTableDOF = this.verticesUtils.axisDOF.length * 2
    for (let i = 0; i < lengthTableDOF; i++) {
      const row = this.dofPointerInDataArray[e.tableDOF[i]]
      for (let j = 0; j < lengthTableDOF; j++) {
        const column = this.dofPointerInDataArray[e.tableDOF[j]]

        this.globalK[row][column] += e.local_globalCoordinates[i][j]
      }
    }
  }

  buildGlobal() {
    for (const [key, value] of Object.entries(this.localArrays)) {
      this.assembler(value)
    }
    // tablePrinter(this.globalK, 0)
    return this.globalK
  }

  // TODO springs

  buildForces() {
    if (this.settings.isRestrictedAbove) {
      for (const [key, value] of Object.entries(this.dataArray)) {
        if (value['isRestricted']) {
          this.f.restricted[this.dofPointerInDataArray[key]][0] = `F-${key}`
          this.f.global[this.dofPointerInDataArray[key]][0] = `F-${key}`
        } else {
          this.f.unrestricted[
            this.dofPointerInDataArray[key] - this.verticesUtils.restrictedDOF
          ][0] = value.force as number
          this.f.global[this.dofPointerInDataArray[key]][0] =
            value.force as number
        }
      }
    } else {
      for (const [key, value] of Object.entries(this.dataArray)) {
        if (value['isRestricted']) {
          this.f.restricted[
            this.dofPointerInDataArray[key] - this.verticesUtils.unrestrictedDOF
          ][0] = `F-${key}`
          this.f.global[this.dofPointerInDataArray[key]][0] = `F-${key}`
        } else {
          this.f.unrestricted[this.dofPointerInDataArray[key]][0] =
            value.force as number
          this.f.global[this.dofPointerInDataArray[key]][0] =
            value.force as number
        }
      }
    }

    return {
      restricted: this.f.restricted,
      unrestricted: this.f.unrestricted,
      global: this.f.global,
    }
  }

  buildForcesFixedEndMoments() {
    for (const [key, value] of Object.entries(this.localArrays)) {
      // this.f.fem[this.dofPointerInDataArray[value.tableDOF[0]]][0] +=
      //   value.fixedEndMoments_global[0][0]
      // this.f.fem[this.dofPointerInDataArray[value.tableDOF[1]]][0] +=
      //   value.fixedEndMoments_global[1][0]
      // this.f.fem[this.dofPointerInDataArray[value.tableDOF[2]]][0] +=
      //   value.fixedEndMoments_global[2][0]

      // this.f.fem[this.dofPointerInDataArray[value.tableDOF[3]]][0] +=
      //   value.fixedEndMoments_global[3][0]
      // this.f.fem[this.dofPointerInDataArray[value.tableDOF[4]]][0] +=
      //   value.fixedEndMoments_global[4][0]
      // this.f.fem[this.dofPointerInDataArray[value.tableDOF[5]]][0] +=
      //   value.fixedEndMoments_global[5][0]

      for (let i = 0; i < value.tableDOF.length; i++) {
        this.f.fem[this.dofPointerInDataArray[value.tableDOF[i]]][0] +=
          value.fixedEndMoments_global[i][0]
      }
    }
    // console.log('fem')
    // tablePrinter(this.f.fem, 2)
    return this.f.fem
  }

  buildDisplacements() {
    if (this.settings.isRestrictedAbove) {
      for (const [key, value] of Object.entries(this.dataArray)) {
        if (value['isRestricted']) {
          this.u.restricted[this.dofPointerInDataArray[key]][0] =
            value.displacement as number
          this.u.global[this.dofPointerInDataArray[key]][0] = value.displacement
        } else {
          this.u.unrestricted[
            this.dofPointerInDataArray[key] - this.verticesUtils.restrictedDOF
          ][0] = `u-${key}`
          this.u.global[this.dofPointerInDataArray[key]][0] = `u-${key}`
        }
      }
    } else {
      for (const [key, value] of Object.entries(this.dataArray)) {
        if (value['isRestricted']) {
          this.u.restricted[
            this.dofPointerInDataArray[key] - this.verticesUtils.unrestrictedDOF
          ][0] = value.displacement as number
          this.u.global[this.dofPointerInDataArray[key]][0] = value.displacement
        } else {
          this.u.unrestricted[this.dofPointerInDataArray[key]][0] = `u-${key}`
          this.u.global[this.dofPointerInDataArray[key]][0] = `u-${key}`
        }
      }
    }

    // console.log(this.u)
    return {
      restricted: this.u.restricted,
      unrestricted: this.u.unrestricted,
      global: this.u.global,
    }
  }

  splitGlobal() {
    const u = this.verticesUtils.unrestrictedDOF
    const r = this.verticesUtils.restrictedDOF
    if (this.settings.isRestrictedAbove) {
      // |krr kru|
      // |kur kuu|
      // krr
      for (let i = 0; i < r; i++) {
        for (let j = 0; j < r; j++) {
          this.k.krr[i][j] = this.globalK[i][j]
        }
      }
      //kru
      for (let i = 0; i < r; i++) {
        for (let j = 0; j < u; j++) {
          this.k.kru[i][j] = this.globalK[i][j + r]
        }
      }
      //kur
      for (let i = 0; i < u; i++) {
        for (let j = 0; j < r; j++) {
          this.k.kur[i][j] = this.globalK[i + r][j]
        }
      }
      //kuu
      for (let i = 0; i < u; i++) {
        for (let j = 0; j < u; j++) {
          this.k.kuu[i][j] = this.globalK[i + r][j + r]
        }
      }
    } else {
      // |kuu kur|
      // |kru krr|
      //krr
      for (let i = 0; i < r; i++) {
        for (let j = 0; j < r; j++) {
          this.k.krr[i][j] = this.globalK[i + u][j + u]
        }
      }
      //kru
      for (let i = 0; i < r; i++) {
        for (let j = 0; j < u; j++) {
          this.k.kru[i][j] = this.globalK[i + u][j]
        }
      }
      //kur
      for (let i = 0; i < u; i++) {
        for (let j = 0; j < r; j++) {
          this.k.kur[i][j] = this.globalK[i][j + u]
        }
      }
      //kuu
      for (let i = 0; i < u; i++) {
        for (let j = 0; j < u; j++) {
          this.k.kuu[i][j] = this.globalK[i][j]
        }
      }
    }
    console.log('krr')
    tablePrinter(this.k.krr, 2)
    console.log('kur')
    tablePrinter(this.k.kur, 2)
    console.log('kru')
    tablePrinter(this.k.kru, 2)
    console.log('kuu')
    tablePrinter(this.k.kuu, 2)

    return {
      kuu: this.k.kuu,
      kru: this.k.kru,
      kur: this.k.kur,
      krr: this.k.krr,
    }
  }

  splitFEM() {
    const u = this.verticesUtils.unrestrictedDOF
    const r = this.verticesUtils.restrictedDOF

    if (this.settings.isRestrictedAbove) {
      //fr
      for (let i = 0; i < r; i++) {
        this.f.fem_restricted[i][0] = this.f.fem[i][0]
      }
      //fu
      for (let i = 0; i < u; i++) {
        this.f.fem_unrestricted[i][0] = this.f.fem[i + r][0]
      }
    } else {
      //fr
      for (let i = 0; i < r; i++) {
        this.f.fem_restricted[i][0] = this.f.fem[i + u][0]
      }
      //fu
      for (let i = 0; i < u; i++) {
        this.f.fem_unrestricted[i][0] = this.f.fem[i][0]
      }
    }
    // console.log('femRestricted')
    // tablePrinter(this.f.fem_restricted, 2)
    // console.log('femUnrestricted')
    // tablePrinter(this.f.fem_unrestricted, 2)

    return {
      femRestricted: this.f.fem_restricted,
      femUnrestricted: this.f.fem_unrestricted,
    }
  }

  solveDisplacement(): ISolvedDisplacementsReturn {
    try {
      inv(this.k.kuu)
    } catch {
      return {
        ok: false,
        message: 'La matriz kuu no tiene inversa, verifica los datos.',
        uSolved: [],
      }
    }

    this.solved.u.unrestricted = multiply(
      inv(this.k.kuu),
      subtract(
        subtract(this.f.unrestricted, this.f.fem_unrestricted),
        multiply(this.k.kur, this.u.restricted)
      )
    )

    console.log('uSolved')
    tablePrinter(this.solved.u.unrestricted, 4)
    return { uSolved: this.solved.u.unrestricted, ok: true, message: '' }
  }

  solveForces() {
    this.solved.f.restricted = add(
      add(
        multiply(this.k.krr, this.u.restricted),
        multiply(this.k.kru, this.solved.u.unrestricted)
      ),
      this.f.fem_restricted
    )
    console.log('fSolved')
    tablePrinter(this.solved.f.restricted, 6)
    return this.solved.f.restricted
  }
}

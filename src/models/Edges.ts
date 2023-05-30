import { IVerticesReturn } from './Vertices.ts'

interface IAxisInterface {
  x: number
  y: number
  z: number
}

interface IFixedEndMoments {
  i: IAxisInterface
  j: IAxisInterface
}

interface IEdgeInput {
  name: string
  from: string
  to: string
  elasticity: number
  inertia: number
  //   area: number
  shear: number
  polarInertia: number
  fixedEndMoments: IFixedEndMoments
}

export interface IEdge {
  name: string
  inertia: number
  elasticity: number
  //   area: number
  shear: number
  polarInertia: number
  long: number
  //   ea_l: number
  ei_l: number
  cos: number
  sin: number
  tableDOF: number[]
  tableDOF_string: string
  fixedEndMoments: IFixedEndMoments
}

export interface IEdgesData {
  [key: string]: IEdge
}

export interface IEdgesOutput {
  edges: IEdgesData
  vertices: IVerticesReturn
}

export class Edges {
  data: IEdgesData = {}
  verticesFullData: IVerticesReturn
  constructor(vertices: IVerticesReturn) {
    this.verticesFullData = vertices
  }

  add({
    name,
    from,
    to,
    elasticity,
    inertia,
    // area,
    shear,
    polarInertia,
    fixedEndMoments,
  }: IEdgeInput) {
    //Validaciones

    if (this.verticesFullData.data[from] === undefined) {
      throw new Error(`${from} no existe en los vertices.`)
    }
    if (this.verticesFullData.data[to] === undefined) {
      throw new Error(`${to} no existe en los vertices.`)
    }

    //valores necesarios
    const verticesData = this.verticesFullData.data
    const verticesUtil = this.verticesFullData.util
    const fromX = verticesData[from].coordinates.x
    const fromY = verticesData[from].coordinates.y
    const toX = verticesData[to].coordinates.x
    const toY = verticesData[to].coordinates.y

    const long = ((toX - fromX) ** 2 + (toY - fromY) ** 2) ** 0.5

    const ei_l = (elasticity * inertia) / long
    // const ea_l = (elasticity * area) / long

    const cos = (toX - fromX) / long
    const sin = (toY - fromY) / long

    const tableDOF: number[] = []

    verticesUtil.axisDOF.map((a) => {
      tableDOF.push(verticesData[from].DOF[a].internal)
    })
    verticesUtil.axisDOF.map((a) => {
      tableDOF.push(verticesData[to].DOF[a].internal)
    })

    let tableDOF_string = ''

    tableDOF.map((dof, i) => {
      i !== 0 ? (tableDOF_string += ` - `) : (tableDOF_string += '')
      tableDOF_string += String(dof)
    })

    const data = {
      name,
      inertia,
      elasticity,
      //   area,
      shear,
      polarInertia,
      long,
      //   ea_l,
      ei_l,
      cos,
      sin,
      tableDOF,
      tableDOF_string,
      fixedEndMoments,
    }

    this.data[name] = data
  }

  getData(): IEdgesOutput {
    return {
      edges: this.data,
      vertices: this.verticesFullData,
    }
  }
}

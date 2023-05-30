export interface IUtil {
  axisCoordinates: ReadonlyArray<'x' | 'y'>
  axisDOF: ReadonlyArray<'x' | 'y' | 'z'>
  restrictedDOF: number
  unrestrictedDOF: number
  totalDOF: number
}

export interface IVertex {
  //   id: string
  name: string
  coordinates: { x: number; y: number }
  forces: { x: number; y: number; z: number }
  displacements: { x: number; y: number; z: number }
  isRestricted: { x: boolean; y: boolean; z: boolean }
  DOF: {
    x: { internal: number; user: number }
    y: { internal: number; user: number }
    z: { internal: number; user: number }
  }
  k: { x: number; y: number; z: number }
}

interface IVertexAdd {
  name: string
  coordinates: { x: number; y: number }
  forces: { x: number; y: number; z: number }
  displacements: { x: number; y: number; z: number }
  k: { x: number; y: number; z: number }
  isRestricted: { x: boolean; y: boolean; z: boolean }
  inputDOF: { x: number; y: number; z: number }
}

export interface IVerticesReturn {
  // se que es redundante, pero me parece que debe estar separado lo que devuelve de la propia clase
  util: IUtil
  data: { [key: string]: IVertex }
}

export class Vertices {
  util: IUtil = {
    axisCoordinates: ['x', 'y'],
    axisDOF: ['x', 'y', 'z'],
    restrictedDOF: 0,
    unrestrictedDOF: 0,
    totalDOF: 0,
  }
  data: { [key: string]: IVertex } = {}

  add({
    name,
    coordinates,
    forces,
    displacements,
    k,
    isRestricted,
    inputDOF,
  }: IVertexAdd) {
    // validaciones
    // verificar si el name ya existe
    if (name in this.data) {
      throw new Error(
        'El nudo ya existe! Los nudos deben tener un nombre único.'
      )
    }
    // verificar si los grados de libertad restringidos
    // no tengan una fuerza aplicada
    for (const a of this.util.axisDOF) {
      if (isRestricted[a] === true && forces[a] !== 0) {
        throw new Error(
          `El vertices ${name} tiene el eje ${a} restringido, por lo tanto, no puede tener una fuerza aplicada. `
        )
      } else if (isRestricted[a] !== true && displacements[a] !== 0) {
        throw new Error(
          `El vertices ${name} tiene el eje ${a} no restringido, por lo tanto, no puede tener un desplazamiento.`
        )
      }
    }
    // verificar si un grado de libertad que posee un resorte, no este restringido.

    for (const a of this.util.axisDOF) {
      if (k[a] !== 0 && isRestricted[a]) {
        throw new Error(
          `El vertices ${name}en el eje ${a} tiene un resortes y está restringido, el grado de libertad no puede estar restringido, ya que de ser asi calculariamos la reacción, pero lo que queremos calcular en ese grado de libertad es el desplazamiento, con el que podras calcular la fuerza interna del resorte.`
        )
      }
    }

    // contando grados de libertad
    for (const axis of this.util.axisDOF) {
      if (isRestricted[axis]) {
        this.util.restrictedDOF += 1
      } else {
        this.util.unrestrictedDOF += 1
      }
      this.util.totalDOF += 1
    }

    const DOF = {
      x: { internal: 0, user: inputDOF['x'] },
      y: { internal: 0, user: inputDOF['y'] },
      z: { internal: 0, user: inputDOF['z'] },
    }

    const enumerator = Object.keys(this.data).length * this.util.axisDOF.length

    for (const [index, element] of this.util.axisDOF.entries()) {
      DOF[element]['internal'] = enumerator + index
    }

    this.data[name] = {
      coordinates,
      forces,
      displacements,
      isRestricted,
      DOF: DOF,
      k,
      name,
    }
  }

  getData(): IVerticesReturn {
    return {
      data: this.data,
      util: this.util,
    }
  }
}

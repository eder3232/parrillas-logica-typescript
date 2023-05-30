import { zeros } from 'mathjs'

export function tablePrinter(arr: number[][], decimals: number) {
  //se supone que recibe una matriz rectangular constante de ixj
  const newArr: number[][] = zeros(
    arr.length,
    arr[0].length
  ).valueOf() as number[][]

  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr[0].length; j++) {
      // console.log(arr[i][j])
      newArr[i][j] = Number(arr[i][j].toFixed(decimals))
    }
  }

  console.table(newArr)
  return newArr
}

import { readFile, utils } from 'xlsx'
export function readExcel() {
  const dataExcel = readFile('./excel/dataParrillas.xlsx', { cellDates: true })
  const libro1 = dataExcel.Sheets[dataExcel.SheetNames[0]]
  const nodes = utils.sheet_to_json(libro1)

  const libro2 = dataExcel.Sheets[dataExcel.SheetNames[1]]
  const elements = utils.sheet_to_json(libro2)
  return { nodes, elements }
}

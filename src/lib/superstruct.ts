import { struct, superstruct } from 'superstruct'
let customStruct = struct

export const getSuperstruct = () => {
  return customStruct
}
export const defineSuperstruct = (types: any) => {
  customStruct = superstruct({ types })
}

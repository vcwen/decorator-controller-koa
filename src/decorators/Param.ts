import { List, Map } from 'immutable'
import { clone, defaults } from 'lodash'
import 'reflect-metadata'
import { MetadataKey } from '../constants/MetadataKey'

export interface IParamOptions {
  name: string
  source?: 'query' | 'path' | 'header' | 'body' | 'context' | 'any'
  type?: any
  required?: boolean
  desc?: string
}

export interface IParamMetadata {
  name: string
  source: 'query' | 'path' | 'header' | 'body' | 'context' | 'any'
  type: any
  required: boolean
  desc?: string
}

const getParamMetadata = (options: any, index: number, target: object, propertyKey: string) => {
  options = clone(options)
  defaults(options, { name: propertyKey, source: 'any', type: 'string', required: false })
  const paramsMetadata: List<any> = Reflect.getMetadata(MetadataKey.PARAMS, target, propertyKey) || List()
  if (paramsMetadata.has(index)) {
    const existingOptions = paramsMetadata.get(index) || {}
    return Object.assign({}, existingOptions, options)
  } else {
    return options
  }
}

const defineParamMetadata = (options: any, index: number, target: object, propertyKey: string) => {
  const paramMetadata = getParamMetadata(options, index, target, propertyKey)
  const paramsMetadata: List<any> = Reflect.getMetadata(MetadataKey.PARAMS, target, propertyKey) || List()
  Reflect.defineMetadata(MetadataKey.PARAMS, paramsMetadata.set(index, paramMetadata), target, propertyKey)
}

export function Param(options: IParamOptions) {
  return (target: object, propertyKey: string, index: number) => {
    defineParamMetadata(options, index, target, propertyKey)
  }
}

export function Required(options: IParamOptions) {
  return (target: object, propertyKey: string, index: number) => {
    defineParamMetadata(Object.assign({}, options, { required: true }), index, target, propertyKey)
  }
}

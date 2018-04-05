import { clone } from 'lodash'
import 'reflect-metadata'
import { MetadataKey } from '../constants/MetadataKey'
import { PropertyDecorator } from '../types/PropertyDecorator'
export interface IResultOptions {
  name?: string
  type: any
  desc?: string
}

export interface IResultMetadata {
  name: string
  type: any
  desc?: string
}

export function Result(options: IResultOptions): PropertyDecorator {
  return (target: any, propertyKey: string) => {
    const resultMeta = clone(options)
    resultMeta.name = resultMeta.name || ''
    Reflect.defineMetadata(MetadataKey.RESULT, resultMeta, target, propertyKey)
  }
}

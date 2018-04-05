import decamelize from 'decamelize'
import { clone, defaults } from 'lodash'
import path from 'path'
import pluralize from 'pluralize'
import 'reflect-metadata'
import { MetadataKey } from '../constants/MetadataKey'
import { Constructor } from '../types/Constructor'

export interface ICtrlOptions {
  plural?: string
  prefix?: string
  name?: string
  desc?: string
}

export interface ICtrlMetadata {
  name: string
  plural: string
  prefix: string
  path: string
  desc?: string
}

const getCtrlMetadata = (options, constructor: Constructor) => {
  options = clone(options)
  defaults(options, { name: constructor.name.split(/controller$/i)[0] })
  if (!options.plural) {
    options.plural = pluralize.plural(decamelize(options.name, '-'))
  }
  if (options.prefix) {
    options.path = path.join(options.prefix, options.plural)
  } else {
    options.path = options.plural
  }
  return options
}

export function Controller(options: ICtrlOptions): (c: Constructor) => void
export function Controller(constructor: Constructor): void
export function Controller(value: ICtrlOptions | Constructor) {
  if (typeof value === 'object') {
    return (constructor: Constructor) => {
      const metadata = getCtrlMetadata(value, constructor)
      Reflect.defineMetadata(MetadataKey.CONTROLLER, metadata, constructor)
    }
  } else {
    const constructor = value
    const metadata = getCtrlMetadata({}, constructor)
    Reflect.defineMetadata(MetadataKey.CONTROLLER, metadata, constructor)
  }
}

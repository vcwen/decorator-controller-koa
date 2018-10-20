import decamelize from 'decamelize'
import { clone, defaults } from 'lodash'
import path from 'path'
import nodepath from 'path'
import pluralize from 'pluralize'
import 'reflect-metadata'
import { MetadataKey } from '../constants/MetadataKey'
import { getOwnPropertyNames } from '../lib/util'
import { Constructor } from '../types/Constructor'
import { IRouteMetadata } from './Route'

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
  defaults(options, { name: constructor.name.split(/controller$/i)[0], prefix: '' })
  if (!options.plural) {
    options.plural = pluralize.plural(decamelize(options.name, '-'))
  }
  options.path = path.join('/', options.prefix, options.plural)

  return options
}

const fixRouteMetadata = (ctrl: Constructor, ctrlMetadata: ICtrlMetadata) => {
  const props = getOwnPropertyNames(ctrl.prototype)
  props.forEach((prop) => {
    const routeMetadata: IRouteMetadata = Reflect.getOwnMetadata(MetadataKey.ROUTE, ctrl.prototype, prop)
    if (routeMetadata) {
      routeMetadata.path = nodepath.join(ctrlMetadata.path, routeMetadata.path)
      Reflect.defineMetadata(MetadataKey.ROUTE, routeMetadata, ctrl.prototype, prop)
    }
  })
}

export function Controller(options: ICtrlOptions): (c: Constructor) => void
export function Controller(constructor: Constructor): void
export function Controller(value: ICtrlOptions | Constructor) {
  if (typeof value === 'object') {
    return (constructor: Constructor) => {
      const metadata = getCtrlMetadata(value, constructor)
      Reflect.defineMetadata(MetadataKey.CONTROLLER, metadata, constructor)
      fixRouteMetadata(constructor, metadata)
    }
  } else {
    const constructor = value
    const metadata = getCtrlMetadata({}, constructor)
    Reflect.defineMetadata(MetadataKey.CONTROLLER, metadata, constructor)
    fixRouteMetadata(constructor, metadata)
  }
}

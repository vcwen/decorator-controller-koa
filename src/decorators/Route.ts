import { Map } from 'immutable'
import { clone, defaults } from 'lodash'
import 'reflect-metadata'
import { HttpMethod } from '../constants/HttpMethod'
import { MetadataKey } from '../constants/MetadataKey'
import { PropertyDecorator } from '../types/PropertyDecorator'

export interface IRouteOptions {
  private?: boolean
  name?: string
  path?: string
  method?: HttpMethod
  desc?: string
}

export interface IRouteMetadata {
  private: boolean
  name: string
  path: string
  method: HttpMethod
  desc?: string
}

const getRouteMetadata = (options: any, _: object, propertyKey: string) => {
  const metadata = clone(options)
  defaults(metadata, { method: HttpMethod.GET, name: propertyKey, path: propertyKey, private: false })
  return metadata
}

const defineRouteMetadata = (metadata, target: object, propertyKey: string) => {
  const routes: Map<string, IRouteMetadata> = Reflect.getMetadata(MetadataKey.ROUTES, target.constructor) || Map()
  Reflect.defineMetadata(MetadataKey.ROUTES, routes.set(propertyKey, metadata), target.constructor)
}

export function Route(options: IRouteOptions): PropertyDecorator
export function Route(target: object, propertyKey: string): void
export function Route(value: any) {
  if (arguments.length === 1) {
    return (target: object, propertyKey: string) => {
      const metadata = getRouteMetadata(value, target, propertyKey)
      defineRouteMetadata(metadata, target, propertyKey)
    }
  } else {
    const [target, propertyKey] = arguments
    const metadata = getRouteMetadata({}, target, propertyKey)
    defineRouteMetadata(metadata, target, propertyKey)
  }
}

interface IMethodifyOptions {
  private?: boolean
  name?: string
  path?: string
  desc?: string
}

function methodifyRouteDecorator(method: HttpMethod) {
  // tslint:disable-next-line:only-arrow-functions
  return function(value: any) {
    if (arguments.length === 1) {
      const options = clone(value)
      options.method = method
      return (target: object, propertyKey: string) => {
        const metadata = getRouteMetadata(options, target, propertyKey)
        defineRouteMetadata(metadata, target, propertyKey)
      }
    } else {
      const [target, propertyKey] = arguments
      const metadata = getRouteMetadata({ method }, target, propertyKey)
      defineRouteMetadata(metadata, target, propertyKey)
    }
  }
}

export function Get(options: IMethodifyOptions): PropertyDecorator
export function Get(target: object, propertyKey: string): void
export function Get() {
  return methodifyRouteDecorator(HttpMethod.GET).apply(null, arguments)
}

export function Post(options: IMethodifyOptions): PropertyDecorator
export function Post(target: object, propertyKey: string): void
export function Post() {
  return methodifyRouteDecorator(HttpMethod.POST).apply(null, arguments)
}

export function Put(options: IMethodifyOptions): PropertyDecorator
export function Put(target: object, propertyKey: string): void
export function Put() {
  return methodifyRouteDecorator(HttpMethod.PUT).apply(null, arguments)
}

export function Patch(options: IMethodifyOptions): PropertyDecorator
export function Patch(target: object, propertyKey: string): void
export function Patch() {
  return methodifyRouteDecorator(HttpMethod.PATCH).apply(null, arguments)
}
export function Delete(options: IMethodifyOptions): PropertyDecorator
export function Delete(target: object, propertyKey: string): void
export function Delete() {
  return methodifyRouteDecorator(HttpMethod.DELETE).apply(null, arguments)
}

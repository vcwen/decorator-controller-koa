import Boom from 'boom'
import { Map } from 'immutable'
import { List } from 'immutable'
import Router from 'koa-router'
import path from 'path'
import { struct } from 'superstruct'
import { MetadataKey } from '../constants/MetadataKey'
import { ICtrlMetadata } from '../decorators/Controller'
import { IParamMetadata } from '../decorators/Param'
import { IRouteMetadata } from '../decorators/Route'
import { HttpStatus } from './HttpStatus'

export function setupController(router: Router, controller: { [key: string]: any }, superstruct: any = struct) {
  const routes = createRoutes(controller, superstruct)
  if (routes) {
    routes.forEach((route) => {
      router[route.method](route.path, route.action)
    })
    return routes
  }
}

export function createAction(controller: object, propKey: string, superstruct: any = struct) {
  const paramsMeta: List<IParamMetadata> = Reflect.getMetadata(MetadataKey.PARAMS, controller, propKey) || List()

  const action = async (ctx: Router.IRouterContext) => {
    const args = paramsMeta.map((paramMeta) => {
      let value: any
      switch (paramMeta.source) {
        case 'query':
          value = ctx.query[paramMeta.name]
          break
        case 'path':
          value = ctx.params[paramMeta.name]
          break
        case 'body':
          value = ctx.request.body[paramMeta.name]
          break
        case 'header':
          value = ctx.header[paramMeta.name]
          break
        case 'context':
          return ctx
        default:
          value =
            ctx.query[paramMeta.name] ||
            (ctx.request.body && ctx.request.body[paramMeta.name]) ||
            (ctx.params && ctx.params[paramMeta.name]) ||
            ctx.header[paramMeta.name]
      }

      if (paramMeta.required && !value) {
        ctx.throw(400, paramMeta.name + ' is required')
      }

      if (!value) {
        return
      }
      if (paramMeta.type !== 'string' && typeof value === 'string') {
        try {
          value = JSON.parse(value)
        } catch (err) {
          ctx.throw(401, `invalid argument "${paramMeta.name}": ${err}`)
        }
      }
      if (typeof paramMeta.type === 'object') {
        const Schema = superstruct(paramMeta.type)
        try {
          value = Schema(value)
        } catch (ex) {
          throw Boom.badRequest(ex)
        }
      }
      return value
    })
    try {
      const response = await controller[propKey].apply(controller, args.toArray())
      if (response instanceof HttpStatus) {
        ctx.status = response.statusCode
        ctx.body = response.body
        if (response.redirectUrl) {
          ctx.status = response.statusCode
          ctx.redirect(response.redirectUrl)
        }
      } else {
        ctx.body = response
      }
    } catch (err) {
      if (Boom.isBoom(err)) {
        ctx.throw(err.output.statusCode, err.message)
      } else {
        throw err
      }
    }
  }
  return action
}

export function createRoute(controller: any, propKey: string, superstruct: any = struct) {
  const ctrlMeta: ICtrlMetadata = Reflect.getMetadata(MetadataKey.CONTROLLER, controller.constructor)
  const routesMetadata: Map<string, IRouteMetadata> =
    Reflect.getMetadata(MetadataKey.ROUTES, controller.constructor) || Map()
  const routeMetadata = routesMetadata.get(propKey) as IRouteMetadata
  const action = createAction(controller, propKey, superstruct)
  const urlPath = path.join('/', ctrlMeta.path, routeMetadata.path)
  return { method: routeMetadata.method.toLowerCase(), path: urlPath, action }
}

export function createRoutes(controller: { [key: string]: any }, superstruct: any = struct): any[] | undefined {
  const routes: any[] = []
  const routesMetadata = Reflect.getMetadata(MetadataKey.ROUTES, controller.constructor) as Map<string, IRouteMetadata>
  for (const propKey of routesMetadata.keys()) {
    routes.push(createRoute(controller, propKey, superstruct))
  }
  return routes
}

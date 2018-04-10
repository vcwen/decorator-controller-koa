import Boom from 'boom'
import { List, Map } from 'immutable'
import Router, { IRouterContext } from 'koa-router'
import { get } from 'lodash'
import nodepath from 'path'
import 'reflect-metadata'
import { MetadataKey } from '../constants/MetadataKey'
import { ICtrlMetadata } from '../decorators/Controller'
import { IParamMetadata } from '../decorators/Param'
import { IRouteMetadata } from '../decorators/Route'
import { getSuperstruct } from '../lib/superstruct'
import { HttpStatus } from './HttpStatus'

const applyCtrlMiddlewares = (router: Router, middlewares: any[]) => {
  middlewares.forEach((middleware) => {
    router.use(middleware)
  })
}
const applyRouteMiddlewares = (router: Router, middlewares: any[], method: string, path: string) => {
  middlewares.forEach((middleware) => {
    router[method](path, middleware)
  })
}
export function createController(controller: object) {
  const ctrlMetadata: ICtrlMetadata = Reflect.getMetadata(MetadataKey.CONTROLLER, controller.constructor)
  const router = new Router({ prefix: ctrlMetadata.path })
  const ctrlMiddlewares: Map<string, any[]> = Map()
  const beforeCtrlMiddlewares = ctrlMiddlewares.get('before') || []
  applyCtrlMiddlewares(router, beforeCtrlMiddlewares)
  const routes = createRoutes(controller)
  routes.forEach((route) => {
    const beforeRouteMiddlewares = get(route, 'middlewares.before', [])
    applyRouteMiddlewares(router, beforeRouteMiddlewares, route.method, route.path)
    router[route.method](route.path, route.action)
    const afterRouteMiddlewares = get(route, 'middlewares.after', [])
    applyRouteMiddlewares(router, afterRouteMiddlewares, route.method, route.path)
  })
  const afterCtrlMiddlewares = ctrlMiddlewares.get('after') || []
  applyCtrlMiddlewares(router, afterCtrlMiddlewares)
  return router
}

const getParams = (ctx: IRouterContext, paramsMetadata: List<IParamMetadata> = List()) => {
  return paramsMetadata.map((paramMeta) => {
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
      const struct = getSuperstruct()
      const Schema = struct(paramMeta.type)
      try {
        value = Schema(value)
      } catch (ex) {
        throw Boom.badRequest(ex)
      }
    }
    return value
  })
}

const processRoute = async (ctx: IRouterContext, controller: object, propKey: string, args: any[]) => {
  try {
    const response = await controller[propKey].apply(controller, args)
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

export function createAction(controller: object, propKey: string) {
  const paramsMetadata: List<IParamMetadata> = Reflect.getMetadata(MetadataKey.PARAMS, controller, propKey) || List()

  const action = async (ctx: IRouterContext, next?: any) => {
    const args = getParams(ctx, paramsMetadata)
    await processRoute(ctx, controller, propKey, args.toArray())
    if (next) {
      await next()
    }
  }
  return action
}

export function createRoute(controller: any, propKey: string) {
  const routesMetadata: Map<string, IRouteMetadata> =
    Reflect.getMetadata(MetadataKey.ROUTES, controller.constructor) || Map()
  const routeMetadata = routesMetadata.get(propKey) as IRouteMetadata
  const action = createAction(controller, propKey)
  const urlPath = routeMetadata.path ? nodepath.join('/', routeMetadata.path) : ''
  return { method: routeMetadata.method.toLowerCase(), path: urlPath, action, middleware: { before: [], after: [] } }
}

export function createRoutes(controller: any): List<any> {
  const routes: List<any> = List()
  const routesMetadata = Reflect.getMetadata(MetadataKey.ROUTES, controller.constructor) as Map<string, IRouteMetadata>

  return routes.withMutations((rs) => {
    for (const propKey of routesMetadata.keys()) {
      rs.push(createRoute(controller, propKey))
    }
  })
}

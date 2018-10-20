import { List } from 'immutable'
import _ from 'lodash'
import { MetadataKey } from '../constants/MetadataKey'
import { ICtrlMetadata } from '../decorators/Controller'
import { IParamMetadata } from '../decorators/Param'
import { IResultMetadata } from '../decorators/Result'
import { IRouteMetadata } from '../decorators/Route'
import { IJsonSchema, loadControllerClasses } from './util'

const normalizeRootBodyParameter = (param: IParamMetadata) => {
  const requestBody = {
    description: param.desc,
    required: param.required,
    content: {
      'application/json': {
        schema: param.schema
      }
    }
  }
  return requestBody
}

const normalizeBodyParameters = (params: List<IParamMetadata>) => {
  const schema: IJsonSchema = { type: 'object', properties: {} }

  const requiredProps = [] as string[]
  params.forEach((item) => {
    if (item.required) {
      requiredProps.push(item.name)
      if (schema.properties) {
        const propSchema = item.schema
        if (item.desc) {
          propSchema.description = item.desc
        }
        schema.properties[item.name] = propSchema
      }
    }
  })
  const requestBody = {
    required: !_.isEmpty(schema.required),
    content: {
      'application/json': {
        schema
      }
    }
  }
  return requestBody
}

const normalizeRequestParameters = (params: List<IParamMetadata>) => {
  return params.map((item) => {
    return {
      in: item.source,
      name: item.name,
      schema: item.schema,
      required: item.required,
      description: item.desc
    }
  })
}
const normalizeParameters = (params: List<IParamMetadata>) => {
  const bodyParams = params.filter((item) => {
    return item.source === 'body'
  })
  let requestBody = undefined as any
  if (!bodyParams.isEmpty()) {
    const rootParam = params.find((item) => item.root)
    if (rootParam) {
      requestBody = normalizeRootBodyParameter(rootParam)
    } else {
      requestBody = normalizeBodyParameters(bodyParams)
    }
  }
  const normalParams = params.filter((item) => {
    return item.source !== 'body'
  })
  const requestParameters = normalizeRequestParameters(normalParams).toArray()
  return [requestParameters, requestBody] as [any[], any]
}

export const normalizeResponse = (options: { schema?: any; desc?: string }) => {
  const response: { content?: any; description?: string } = { description: options.desc }
  if (options.schema) {
    response.content = { 'application/json': { schema: options.schema } }
  }
  return response
}

const createSwaggerRoute = <T>(ctrlClass: new (...args: any[]) => T, prop: string) => {
  const ctrlPrototype = ctrlClass.prototype
  const ctrlMetadata: ICtrlMetadata = Reflect.getOwnMetadata(MetadataKey.CONTROLLER, ctrlClass)
  const routeMetadata: IRouteMetadata = Reflect.getOwnMetadata(MetadataKey.ROUTE, ctrlPrototype, prop)
  if (!routeMetadata) {
    return
  }
  const route = {
    path: routeMetadata.path,
    method: routeMetadata.method,
    tags: [ctrlMetadata.name],
    description: routeMetadata.desc,
    parameters: [] as any[],
    requestBody: {} as any,
    responses: {} as any
  }
  const paramsMetadata: List<IParamMetadata> = Reflect.getOwnMetadata(MetadataKey.PARAM, ctrlPrototype, prop) || List()
  const [params, requestBody] = normalizeParameters(paramsMetadata)
  route.parameters = params
  route.requestBody = requestBody

  const resMetadata: List<IResultMetadata> = Reflect.getOwnMetadata(MetadataKey.RESULT, ctrlPrototype, prop) || List()
  if (!resMetadata.isEmpty()) {
    const response = {}
    resMetadata.forEach((item) => {
      response[item.status] = normalizeResponse(item)
    })
    route.responses = response
  }
  return route
}

const createSwaggerController = <T>(ctrlClass: new () => T) => {
  const ctrlMetadata: ICtrlMetadata = Reflect.getMetadata(MetadataKey.CONTROLLER, ctrlClass)
  const tag = {
    name: ctrlMetadata.name,
    desc: ctrlMetadata.desc
  }
  const paths: any = {}
  const props = Object.getOwnPropertyNames(ctrlClass.prototype)
  const routes = props.map((prop) => {
    return createSwaggerRoute(ctrlClass, prop)
  })
  routes.forEach((item) => {
    if (!item) {
      return
    }
    const path = item.path
    const method = item.method.toLowerCase()
    if (!paths[path]) {
      paths[path] = {}
    }
    Reflect.deleteProperty(item, 'path')
    Reflect.deleteProperty(item, 'method')
    paths[path][method] = item
  })
  return [tag, paths]
}

export const createOpenApi = async (
  ctrlDir: string,
  options: {
    title: string
    version: string
    servers?: Array<{ url: string; desc?: string }>
    desc?: string
  }
) => {
  const openApi = {
    openapi: '3.0.0',
    info: {
      title: options.title,
      description: options.desc,
      version: options.version
    },
    servers: options.servers,
    tags: [] as any[],
    paths: {} as any
  }

  const ctrls = await loadControllerClasses(ctrlDir)
  ctrls.forEach((ctrl: any) => {
    const [tag, paths] = createSwaggerController(ctrl)
    openApi.tags.push(tag)
    Object.assign(openApi.paths, paths)
  })
  return openApi
}

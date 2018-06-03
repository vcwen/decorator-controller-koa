import fs from 'fs'
import _ from 'lodash'
import nodepath from 'path'
import { struct } from 'superstruct'
import { MetadataKey } from '../constants/MetadataKey'
export const loadControllerClasses = async (ctrlDir: string): Promise<any[]> => {
  const paths = fs.readdirSync(ctrlDir)
  const ctrls = [] as any[]

  for (let path of paths) {
    path = nodepath.resolve(ctrlDir, path)

    const stat = fs.lstatSync(path)
    if (stat.isDirectory()) {
      ctrls.push(...(await loadControllerClasses(path)))
    } else if (stat.isFile()) {
      try {
        const ctrl = (await import(path)).default
        const metadata = Reflect.getOwnMetadata(MetadataKey.CONTROLLER, ctrl)
        if (metadata) {
          ctrls.push(ctrl)
        }
      } catch {
        // ignore the error
      }
    }
  }
  return ctrls
}

export interface IJsonSchema {
  title?: string
  type: string
  format?: string
  properties?: { [prop: string]: IJsonSchema }
  items?: IJsonSchema
  required?: string[]
  description?: string
}

const normalizeProp = (decoratedProp: string): [string, boolean] => {
  const regex = /(\w+?)(\?)?$/
  const match = regex.exec(decoratedProp)
  if (match) {
    const prop = match[1]
    if (match[2]) {
      return [prop, false]
    } else {
      return [prop, true]
    }
  } else {
    throw new Error('Invalid prop:' + decoratedProp)
  }
}

export const convertSchemaToJsonSchema = (schema: any) => {
  if (typeof schema === 'string') {
    return { type: schema }
  } else if (Array.isArray(schema)) {
    const propSchema: any = { type: 'array' }
    if (schema.length > 0 && schema[0]) {
      const itemSchema = convertSchemaToJsonSchema(schema[0])
      propSchema.items = itemSchema
    }
    return propSchema
  } else if (typeof schema === 'object') {
    const jsonSchema: IJsonSchema = { type: 'object', properties: {} }
    const requiredProps = [] as string[]
    for (const prop in schema) {
      if (schema.hasOwnProperty(prop)) {
        const propSchema = convertSchemaToJsonSchema(schema[prop])
        const [propName, required] = normalizeProp(prop)
        if (jsonSchema.properties) {
          jsonSchema.properties[propName] = propSchema
        }
        if (required) {
          requiredProps.push(propName)
        }
      }
    }
    if (!_.isEmpty(requiredProps)) {
      jsonSchema.required = requiredProps
    }
    return jsonSchema
  } else {
    throw new TypeError('Invalid schema:' + schema)
  }
}

export const normalizeSchema = (schema: any): IJsonSchema => {
  if (_.isEmpty(schema)) {
    throw new Error('Invalid schema.')
  }
  if (schema.type === 'object' && schema.properties) {
    return _.cloneDeep(schema)
  } else {
    return convertSchemaToJsonSchema(schema)
  }
}

const isPrimitiveType = (type: string) => {
  if (type === 'object' || type === 'array') {
    return false
  } else {
    return true
  }
}

const structSchemaFromJsonSchema = (schema: IJsonSchema, required: boolean = false) => {
  let structSchema: any = {}
  if (isPrimitiveType(schema.type)) {
    structSchema = schema.type
  } else if (schema.type === 'array') {
    if (schema.items && !_.isEmpty(schema.items)) {
      structSchema = struct.list([structSchemaFromJsonSchema(schema.items)])
    } else {
      structSchema = 'array'
    }
  } else {
    if (schema.properties) {
      const schemaDetail = schema.properties
      for (const prop in schemaDetail) {
        if (schemaDetail.hasOwnProperty(prop)) {
          structSchema[prop] = structSchemaFromJsonSchema(schemaDetail[prop])
        }
      }
    }
    structSchema = struct.partial(structSchema)
  }
  if (required) {
    struct(structSchema)
  } else {
    return struct.optional(structSchema)
  }
}

export const createStructFromJsonSchema = (schema: IJsonSchema) => {
  const structSchema = structSchemaFromJsonSchema(schema)
  if (typeof structSchema === 'string') {
    return struct(structSchema)
  } else {
    return struct.partial(structSchema)
  }
}

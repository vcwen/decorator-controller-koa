import { Controller } from '../decorators/Controller'
import { Param } from '../decorators/Param'
import { Result } from '../decorators/Result'
import { Route } from '../decorators/Route'

@Controller
export default class MyController {
  @Route
  @Result({
    desc: 'this is a object result',
    type: { code: 'string', name: 'string', target: 'object', level: 'number?' }
  })
  public test(
    @Param({ name: 'name', required: true })
    name: string,
    @Param({ name: 'target', type: 'boolean', required: true })
    target: object,
    @Param({ name: 'level', type: 'number' })
    level?: number
  ) {
    console.log('>>>>>>>')
    return { code: 'ok', name, target, level }
  }
}

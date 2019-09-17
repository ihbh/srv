import { Rsp } from '../rsp';
import { HttpHandler, HttpMethod } from '../http-handler';

@HttpHandler('/')
class HttpRoot {
  @HttpMethod('GET')
  async get(): Promise<Rsp> {
    return { text: 'You have reached IHBH.' };
  }
}

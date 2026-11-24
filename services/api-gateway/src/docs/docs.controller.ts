import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ApiExcludeController } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { documentedServices, toGatewaySpec } from './openapi-aggregator';

/** Nest services publish /api/docs-json, FastAPI services /openapi.json. */
const SPEC_PATHS = ['/api/docs-json', '/openapi.json'];

/** Serves each service's OpenAPI document, rewritten for the gateway (development only). */
@ApiExcludeController()
@Controller('api/docs/specs')
export class DocsController {
  constructor(private readonly http: HttpService) {}

  @Get(':name.json')
  async spec(@Param('name') name: string) {
    const service = documentedServices().find((s) => s.name === name);
    if (!service) throw new NotFoundException('Unknown service');
    for (const path of SPEC_PATHS) {
      try {
        const res = await firstValueFrom(this.http.get(`${service.url}${path}`, { timeout: 3000 }));
        if (res.data?.paths) return toGatewaySpec(res.data, service);
      } catch {
        // try the next convention
      }
    }
    throw new NotFoundException(`${name} does not publish an OpenAPI document (production mode?)`);
  }
}

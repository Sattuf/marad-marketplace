import { documentedServices, toGatewaySpec } from './openapi-aggregator';

describe('OpenAPI aggregation', () => {
  const services = documentedServices();

  it('lists each backend service once, with the gateway base of its paths', () => {
    const names = services.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(expect.arrayContaining(['auth-service', 'listings-service', 'messaging-service', 'fraud-service']));
    expect(services.find((s) => s.name === 'auth-service')!.strippedPrefixes).toEqual(['auth']);
    expect(services.find((s) => s.name === 'listings-service')!.strippedPrefixes).toEqual([]);
    expect(services.every((s) => s.serverUrl === '/api/v1')).toBe(true);
  });

  it('routes "try it out" through the gateway and hides internal routes', () => {
    const listings = services.find((s) => s.name === 'listings-service')!;
    const spec = toGatewaySpec(
      {
        openapi: '3.0.0',
        info: { title: 'Listings' },
        paths: {
          '/listings': { get: { summary: 'browse' } },
          '/listings/batch': { post: { summary: 'internal batch' } },
          '/listings/{id}/status': { put: { summary: 'internal status' }, get: { summary: 'public?' } },
          '/health': { get: {} },
        },
      },
      listings,
    );
    expect(spec.servers).toEqual([{ url: '/api/v1', description: 'API gateway' }]);
    expect(Object.keys(spec.paths)).toEqual(['/listings', '/listings/{id}/status']);
    expect(spec.paths['/listings/{id}/status']).not.toHaveProperty('put');
    expect(spec.components.securitySchemes.bearer).toMatchObject({ scheme: 'bearer' });
  });

  it('maps a service behind several stripped prefixes by operation tag', () => {
    const moderation = services.find((s) => s.name === 'moderation-service')!;
    const spec = toGatewaySpec(
      {
        paths: {
          '/': { get: { tags: ['App'] }, post: { tags: ['reports'] } },
          '/reports': { get: { tags: ['admin'] } },
          '/dashboard/stats': { get: { tags: ['admin'] } },
        },
      },
      moderation,
    );
    expect(Object.keys(spec.paths).sort()).toEqual(['/admin/dashboard/stats', '/admin/reports', '/reports']);
    expect(spec.paths['/reports']).toHaveProperty('post');
  });
});

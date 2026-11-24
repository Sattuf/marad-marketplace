import { BLOCKED_ROUTES, ROUTE_OVERRIDES, SERVICES_CONFIG, ServiceConfig } from '../proxy/services.config';

export interface ServiceDocs {
  /** Service name, e.g. "listings-service". */
  name: string;
  url: string;
  /** Public base URL of every rewritten path. */
  serverUrl: string;
  /**
   * Gateway prefixes that are stripped before forwarding (empty when the service's own
   * paths already carry their prefix). With several, an operation's tag chooses one.
   */
  strippedPrefixes: string[];
  docsPrefixByTag: Record<string, string>;
}

/**
 * One entry per backend service (several gateway prefixes can point to the same one).
 * When any prefix keeps the prefix in the forwarded path (stripPrefix: false), the service's
 * own paths already start with it, so they live under /api/v1; otherwise under /api/v1/<prefix>.
 */
export function documentedServices(config: ServiceConfig[] = SERVICES_CONFIG): ServiceDocs[] {
  const byUrl = new Map<string, ServiceConfig[]>();
  for (const svc of config) byUrl.set(svc.url, [...(byUrl.get(svc.url) ?? []), svc]);
  return [...byUrl.values()].map((entries) => {
    const keepsPrefix = entries.some((e) => e.stripPrefix === false);
    return {
      name: entries[0].name.replace(/-(conversations|mobile|reviews|admin|events)$/, ''),
      url: entries[0].url,
      serverUrl: '/api/v1',
      strippedPrefixes: keepsPrefix ? [] : entries.map((e) => e.prefix),
      docsPrefixByTag: Object.assign({}, ...entries.map((e) => e.docsPrefixByTag ?? {})),
    };
  });
}

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch', 'options', 'head'];

/**
 * Rewrites a service's own OpenAPI document for the public gateway: requests go through the
 * gateway (servers), and service-to-service routes the gateway refuses are not advertised.
 */
export function toGatewaySpec(spec: any, service: ServiceDocs): any {
  const paths: Record<string, any> = {};
  for (const [path, operations] of Object.entries<any>(spec?.paths ?? {})) {
    for (const [method, op] of Object.entries<any>(operations)) {
      if (!HTTP_METHODS.includes(method)) continue;
      const tags: string[] = (op?.tags ?? []).map((t: string) => t.toLowerCase());
      // Service plumbing (hello, health, Prometheus) is not part of the public API.
      if (tags.includes('app') || tags.includes('prometheus') || /^\/(health|metrics)\/?$/.test(path)) continue;
      const forwarded = path.replace(/\{[^}]+\}/g, 'x');
      const blocked = BLOCKED_ROUTES.some(
        (r) =>
          (r.service === '*' || r.service === service.name) &&
          (r.method === '*' || r.method === method.toUpperCase()) &&
          r.pattern.test(forwarded),
      );
      if (blocked) continue;
      let publicPath = path;
      // Paths the gateway forwards unchanged to this service (e.g. /users/:id/reviews).
      const overridden = ROUTE_OVERRIDES.some((o) => o.service === service.name && o.pattern.test(forwarded));
      if (service.strippedPrefixes.length && !overridden) {
        const prefix =
          tags.map((t) => service.docsPrefixByTag[t]).find(Boolean) ??
          service.strippedPrefixes.find((p) => tags.includes(p)) ??
          service.strippedPrefixes[0];
        publicPath = `/${prefix}${path === '/' ? '' : path}`;
      }
      paths[publicPath] = { ...(paths[publicPath] ?? {}), [method]: op };
    }
  }
  const components = { ...(spec?.components ?? {}) };
  components.securitySchemes = {
    ...(components.securitySchemes ?? {}),
    bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
  };
  return {
    ...spec,
    info: { ...(spec?.info ?? {}), title: `${service.name} (via API gateway)` },
    servers: [{ url: service.serverUrl, description: 'API gateway' }],
    security: [{ bearer: [] }],
    components,
    paths,
  };
}

import { ElasticsearchService } from './elasticsearch.service';

describe('ElasticsearchService.onModuleInit', () => {
  it('retries until Elasticsearch answers, then creates the index with its mapping', async () => {
    const service = new ElasticsearchService();
    const exists = jest
      .fn()
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockResolvedValue(false);
    const create = jest.fn().mockResolvedValue({});
    (service as any).client = { indices: { exists, create, putMapping: jest.fn() } };

    await service.onModuleInit(5, 1);

    expect(exists).toHaveBeenCalledTimes(3);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].body.mappings.properties.location).toEqual({ type: 'geo_point' });
  });

  it('gives up after the last attempt without throwing (the service still starts)', async () => {
    const service = new ElasticsearchService();
    const exists = jest.fn().mockRejectedValue(new Error('down'));
    (service as any).client = { indices: { exists, create: jest.fn(), putMapping: jest.fn() } };

    await expect(service.onModuleInit(3, 1)).resolves.toBeUndefined();
    expect(exists).toHaveBeenCalledTimes(3);
  });
});

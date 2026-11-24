import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { MapSearchDto } from './map-search.dto';
import { SearchQueryDto } from './search-query.dto';
import { TrackClickDto } from './track-click.dto';

// Same options as main.ts.
const pipe = new ValidationPipe({ whitelist: true, transform: true });
const run = (metatype: any, type: 'query' | 'body', value: unknown) =>
  pipe.transform(value, { metatype, type } as ArgumentMetadata);

describe('search DTO validation (global ValidationPipe)', () => {
  it('accepts a normal search and strips unknown parameters', async () => {
    const dto = await run(SearchQueryDto, 'query', { q: 'جوال', page: '2', limit: '20', debug: 'true' });
    expect(dto).toMatchObject({ q: 'جوال', page: '2', limit: '20' });
    expect(dto).not.toHaveProperty('debug');
  });

  it('rejects a non-numeric page and an oversized query', async () => {
    await expect(run(SearchQueryDto, 'query', { page: '1; DROP' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(run(SearchQueryDto, 'query', { q: 'x'.repeat(501) })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('converts map bounds to numbers and rejects impossible coordinates', async () => {
    const ok = await run(MapSearchDto, 'query', { topLeftLat: '36.5', topLeftLon: '36.1', bottomRightLat: '36.0', bottomRightLon: '37.2' });
    expect(ok.topLeftLat).toBe(36.5);
    await expect(
      run(MapSearchDto, 'query', { topLeftLat: '91', topLeftLon: '0', bottomRightLat: '0', bottomRightLon: '0' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a click for an unknown variant or a non-UUID listing', async () => {
    const base = { query: 'x', variant: 'A', session_id: 's1' };
    await expect(run(TrackClickDto, 'body', { ...base, variant: 'C' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(run(TrackClickDto, 'body', { ...base, listing_id: "1' OR 1=1" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(run(TrackClickDto, 'body', base)).resolves.toMatchObject(base);
  });
});

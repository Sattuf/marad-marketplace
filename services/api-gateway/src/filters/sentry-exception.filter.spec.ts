import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { SentryExceptionFilter, toErrorBody } from './sentry-exception.filter';

function hostFor(request: any) {
  const response: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  return {
    response,
    host: { switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }) } as any,
  };
}

describe('unified error body', () => {
  const request = { method: 'GET', url: '/listings/x?page=2', headers: { 'x-request-id': 'req-123' } };

  it('shapes an HttpException and keeps validation messages as a list', () => {
    const { host, response } = hostFor(request);
    new SentryExceptionFilter().catch(new BadRequestException(['price must be a number']), host);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json.mock.calls[0][0]).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: ['price must be a number'],
      requestId: 'req-123',
      path: '/listings/x',
    });
  });

  it('hides internals of unexpected errors behind a generic 500', () => {
    const { host, response } = hostFor(request);
    new SentryExceptionFilter().catch(new Error('password=hunter2 in SQL'), host);
    const body = response.json.mock.calls[0][0];
    expect(body).toMatchObject({ statusCode: 500, error: 'Internal Server Error', message: 'Internal server error' });
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });

  it('accepts string payloads and fills the standard reason phrase', () => {
    expect(toErrorBody(404, 'Listing not found')).toMatchObject({ error: 'Not Found', message: 'Listing not found' });
    expect(toErrorBody(429, new HttpException('Too many', 429).getResponse()).error).toBe('Too Many Requests');
    expect(toErrorBody(404, new NotFoundException().getResponse()).message).toBe('Not Found');
  });
});

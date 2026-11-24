import { requestId } from './request-id';

function run(header?: string) {
  const req: any = { headers: header === undefined ? {} : { 'x-request-id': header } };
  const res: any = { setHeader: jest.fn() };
  const next = jest.fn();
  requestId(req, res, next);
  return { id: req.headers['x-request-id'], res, next };
}

describe('requestId middleware', () => {
  it('assigns a UUID when the client sends none and echoes it in the response', () => {
    const { id, res, next } = run();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', id);
    expect(next).toHaveBeenCalled();
  });

  it('keeps a safe client id', () => {
    expect(run('mobile-4f9a2c1e').id).toBe('mobile-4f9a2c1e');
  });

  it('replaces ids that could forge log lines or are too long', () => {
    expect(run('abc\nFAKE LOG LINE').id).not.toContain('\n');
    expect(run('x'.repeat(200)).id).toHaveLength(36);
    expect(run('short').id).toHaveLength(36);
  });
});

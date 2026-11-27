import { BadGatewayException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AccountDeletionService, DELETION_GRACE_DAYS } from './account-deletion.service';

describe('AccountDeletionService', () => {
  const DAY = 24 * 3600 * 1000;
  let users: any;
  let redis: any;
  let otp: any;
  let service: AccountDeletionService;
  let fetchMock: jest.Mock;
  let user: any;

  beforeEach(async () => {
    user = {
      id: '11111111-1111-4111-8111-111111111111',
      passwordHash: await bcrypt.hash('correct horse', 4),
      phone: '+905321234567',
      isPhoneVerified: true,
      googleId: null,
      deletedAt: null,
    };
    users = {
      findOneById: jest.fn(async () => user),
      update: jest.fn(async (_id: string, data: any) => ({ ...user, ...data })),
    };
    redis = { deleteByPattern: jest.fn() };
    otp = { consumeCode: jest.fn() };
    const config = { get: jest.fn((_k: string, d?: string) => d) };
    service = new AccountDeletionService(users, redis, config as any, otp);
    fetchMock = jest.fn(async () => ({ ok: true }));
    global.fetch = fetchMock as any;
  });

  const visibilityCalls = () =>
    fetchMock.mock.calls.map(([url, init]) => ({ url, hidden: JSON.parse(init.body).hidden, secret: init.headers['x-internal-secret'] }));

  describe('requestDeletion', () => {
    it('refuses without re-authentication, even with a valid session', async () => {
      await expect(service.requestDeletion(user.id, {})).rejects.toBeInstanceOf(UnauthorizedException);
      expect(users.update).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refuses a wrong password and changes nothing', async () => {
      await expect(service.requestDeletion(user.id, { password: 'nope' })).rejects.toBeInstanceOf(UnauthorizedException);
      expect(users.update).not.toHaveBeenCalled();
    });

    it('with the right password: hides listings, closes the account, revokes every session', async () => {
      const result = await service.requestDeletion(user.id, { password: 'correct horse' });

      expect(visibilityCalls()).toEqual([
        { url: expect.stringContaining(`/listings/internal/owners/${user.id}/visibility`), hidden: true, secret: expect.any(String) },
      ]);
      expect(users.update).toHaveBeenCalledWith(user.id, { deletedAt: expect.any(Date), fcmToken: null });
      expect(redis.deleteByPattern).toHaveBeenCalledWith(`refresh:${user.id}:*`);
      const graceMs = Date.parse(result.purgeAfter) - Date.parse(result.deletedAt);
      expect(graceMs).toBe(DELETION_GRACE_DAYS * DAY);
    });

    it('accepts an SMS code through the same lock/attempt counting as sign-in', async () => {
      await service.requestDeletion(user.id, { otp: '123456' });
      expect(otp.consumeCode).toHaveBeenCalledWith(user.phone, '123456');
      expect(users.update).toHaveBeenCalled();
    });

    it('a wrong SMS code stops everything', async () => {
      otp.consumeCode.mockRejectedValue(new UnauthorizedException());
      await expect(service.requestDeletion(user.id, { otp: '000000' })).rejects.toBeInstanceOf(UnauthorizedException);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('if listings cannot be hidden, nothing changes (502) and the user can retry', async () => {
      fetchMock.mockResolvedValue({ ok: false });
      await expect(service.requestDeletion(user.id, { password: 'correct horse' })).rejects.toBeInstanceOf(BadGatewayException);
      expect(users.update).not.toHaveBeenCalled();
      expect(redis.deleteByPattern).not.toHaveBeenCalled();
    });

    it('refuses an account that is already closed', async () => {
      user.deletedAt = new Date();
      await expect(service.requestDeletion(user.id, { password: 'correct horse' })).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('restoreOnSignIn', () => {
    it('leaves normal accounts untouched (no network call)', async () => {
      await expect(service.restoreOnSignIn(user)).resolves.toBe(user);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('within the grace period: shows the listings again and reopens the account', async () => {
      user.deletedAt = new Date(Date.now() - 3 * DAY);
      const restored = await service.restoreOnSignIn(user);
      expect(visibilityCalls()[0].hidden).toBe(false);
      expect(users.update).toHaveBeenCalledWith(user.id, { deletedAt: null });
      expect(restored.deletedAt).toBeNull();
    });

    it('after the grace period: sign-in is refused like an unknown account', async () => {
      user.deletedAt = new Date(Date.now() - (DELETION_GRACE_DAYS + 1) * DAY);
      await expect(service.restoreOnSignIn(user)).rejects.toThrow('بيانات الدخول غير صحيحة');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

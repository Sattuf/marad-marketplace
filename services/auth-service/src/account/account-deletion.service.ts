import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { internalHeaders } from '../common/security';
import { OtpService } from '../otp/otp.service';
import { RedisService } from '../redis/redis.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

/** Days between a deletion request and the permanent scrub (docs/EXECUTION_PLAN.md L-D5). */
export const DELETION_GRACE_DAYS = 30;
const GRACE_MS = DELETION_GRACE_DAYS * 24 * 3600 * 1000;

export interface ReauthProof {
  password?: string;
  otp?: string;
  googleIdToken?: string;
}

/**
 * Account deletion, part 1 (L1.3a): close the account now, restorably.
 * Re-authentication is mandatory: a stolen or unattended session must not be enough to
 * erase someone's account. The 30-day scrub across services is part 2 (L1.3b).
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => OtpService))
    private readonly otpService: OtpService,
  ) {}

  async requestDeletion(userId: string, proof: ReauthProof): Promise<{ deletedAt: string; purgeAfter: string }> {
    const user = await this.usersService.findOneById(userId);
    if (!user || user.deletedAt) throw new UnauthorizedException('الحساب غير موجود');

    await this.reauthenticate(user, proof);

    // Listings first: if that service is down, nothing has changed and the user can retry.
    await this.setListingsHidden(user.id, true);
    const deletedAt = new Date();
    try {
      await this.usersService.update(user.id, { deletedAt, fcmToken: null });
    } catch (e) {
      await this.setListingsHidden(user.id, false).catch(() => undefined);
      throw e;
    }
    // Every session, on every device. Access tokens die within 15 minutes and are
    // already refused by JwtStrategy because deleted_at is set.
    await this.redisService.deleteByPattern(`refresh:${user.id}:*`);
    this.logger.log(`Account ${user.id} closed; scrub after ${DELETION_GRACE_DAYS} days`);
    return { deletedAt: deletedAt.toISOString(), purgeAfter: new Date(deletedAt.getTime() + GRACE_MS).toISOString() };
  }

  /**
   * Called on every successful sign-in. Within the grace period a sign-in undoes the
   * deletion; after it, the account no longer exists for sign-in purposes.
   */
  async restoreOnSignIn(user: User): Promise<User> {
    if (!user.deletedAt) return user;
    if (Date.now() - new Date(user.deletedAt).getTime() >= GRACE_MS) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }
    await this.setListingsHidden(user.id, false);
    this.logger.log(`Account ${user.id} restored by sign-in`);
    return this.usersService.update(user.id, { deletedAt: null });
  }

  private async reauthenticate(user: User, proof: ReauthProof): Promise<void> {
    if (proof.password) {
      const ok = !!user.passwordHash && (await bcrypt.compare(proof.password, user.passwordHash));
      if (!ok) throw new UnauthorizedException('كلمة المرور غير صحيحة');
      return;
    }
    if (proof.otp) {
      if (!user.phone || !user.isPhoneVerified) throw new BadRequestException('لا يوجد رقم هاتف موثّق في هذا الحساب');
      await this.otpService.consumeCode(user.phone, proof.otp); // throws on a wrong code
      return;
    }
    if (proof.googleIdToken) {
      if (!user.googleId) throw new BadRequestException('هذا الحساب غير مرتبط بـ Google');
      const audience = (this.configService.get<string>('GOOGLE_CLIENT_IDS') ?? this.configService.get<string>('GOOGLE_CLIENT_ID') ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      if (!audience.length) throw new ServiceUnavailableException('تسجيل الدخول عبر Google غير مفعّل');
      try {
        const ticket = await new OAuth2Client().verifyIdToken({ idToken: proof.googleIdToken, audience });
        if (ticket.getPayload()?.sub === user.googleId) return;
      } catch {
        // fall through to the uniform rejection
      }
      throw new UnauthorizedException('تعذّر التحقق من حساب Google');
    }
    throw new UnauthorizedException({ code: 'REAUTH_REQUIRED', message: 'أكّد هويتك بكلمة المرور أو برمز تحقق' });
  }

  private async setListingsHidden(userId: string, hidden: boolean): Promise<void> {
    const base = this.configService.get<string>('LISTINGS_SERVICE_URL', 'http://listings-service:3002');
    let ok = false;
    try {
      const res = await fetch(`${base}/listings/internal/owners/${userId}/visibility`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...internalHeaders() },
        body: JSON.stringify({ hidden }),
        signal: AbortSignal.timeout(5000),
      });
      ok = res.ok;
    } catch (e) {
      this.logger.error(`listings visibility call failed: ${(e as Error).message}`);
    }
    if (!ok) throw new BadGatewayException('تعذّر إكمال العملية الآن. حاول بعد قليل');
  }
}

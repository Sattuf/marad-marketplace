import { Injectable, Logger } from '@nestjs/common';
import { initializeApp, getApps } from 'firebase-admin/app';

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);

  constructor() {
    if (!getApps().length) {
      initializeApp(); // uses GOOGLE_APPLICATION_CREDENTIALS
      this.logger.log('Firebase Admin initialized.');
    }
  }

  async sendNotification(userId: string, title: string, body: string, _data?: Record<string, string>) {
    this.logger.log(`[MOCK FCM] Sending notification to user ${userId} - Title: ${title}, Body: ${body}`);
    // Real implementation:
    // await admin.messaging().send({ token: 'user_device_token', notification: { title, body }, data });
    return true;
  }
}

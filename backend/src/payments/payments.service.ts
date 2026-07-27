import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod, PaymentMethodType } from '../database/entities/payment-method.entity';
import { User } from '../database/entities/user.entity';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Stripe = require('stripe');

@Injectable()
export class PaymentsService {
  private stripe: any;

  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepo: Repository<PaymentMethod>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly configService: ConfigService,
  ) {
    const mode = this.configService.get('STRIPE_MODE') || 'test';
    const key = mode === 'production'
      ? this.configService.get('STRIPE_SECRET_KEY_PROD')
      : (this.configService.get('STRIPE_SECRET_KEY_TEST') || this.configService.get('STRIPE_SECRET_KEY'));
    if (key) {
      this.stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' as any });
    }
  }

  async getPaymentMethods(userId: string) {
    return this.paymentMethodRepo.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  async addPaymentMethod(
    userId: string,
    data: { type: PaymentMethodType; last4: string; brand: string; providerId: string; isDefault?: boolean }
  ) {
    if (data.isDefault) {
      await this.paymentMethodRepo.update({ userId }, { isDefault: false });
    } else {
      const count = await this.paymentMethodRepo.count({ where: { userId } });
      if (count === 0) data.isDefault = true;
    }
    return this.paymentMethodRepo.save(this.paymentMethodRepo.create({ userId, ...data }));
  }

  async deletePaymentMethod(userId: string, id: string) {
    const method = await this.paymentMethodRepo.findOne({ where: { id, userId } });
    if (!method) throw new NotFoundException('Payment method not found');
    await this.paymentMethodRepo.delete(id);
    return { success: true };
  }

  async createSetupSession(userId: string): Promise<{ url: string }> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'email', 'firstName', 'lastName', 'stripeCustomerId'],
    });
    if (!user) throw new NotFoundException('User not found');

    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId && this.stripe) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`.trim(),
        metadata: { userId },
      });
      stripeCustomerId = customer.id;
      await this.userRepo.update(userId, { stripeCustomerId } as any);
    }

    const rawAppUrl = this.configService.get('APP_URL');
    const appUrl = rawAppUrl && !rawAppUrl.includes('localhost')
      ? (rawAppUrl.startsWith('http') ? rawAppUrl : `https://${rawAppUrl}`)
      : 'https://ticketsystem-jzgf.onrender.com';

    const session = await this.stripe.checkout.sessions.create({
      mode: 'setup',
      currency: 'usd',
      customer: stripeCustomerId,
      success_url: `${appUrl.replace(/\/$/, '')}/dashboard?tab=payments&saved=1`,
      cancel_url: `${appUrl.replace(/\/$/, '')}/dashboard?tab=payments`,
      metadata: { userId },
    });

    return { url: session.url };
  }
}

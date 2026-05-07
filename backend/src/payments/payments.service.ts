import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethod, PaymentMethodType } from '../database/entities/payment-method.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepo: Repository<PaymentMethod>,
  ) {}

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
    // If it's the first or marked as default, make it default and unset others
    if (data.isDefault) {
      await this.paymentMethodRepo.update({ userId }, { isDefault: false });
    } else {
      const count = await this.paymentMethodRepo.count({ where: { userId } });
      if (count === 0) data.isDefault = true;
    }

    const method = this.paymentMethodRepo.create({
      userId,
      ...data,
    });
    return this.paymentMethodRepo.save(method);
  }

  async deletePaymentMethod(userId: string, id: string) {
    const method = await this.paymentMethodRepo.findOne({ where: { id, userId } });
    if (!method) throw new NotFoundException('Payment method not found');
    await this.paymentMethodRepo.delete(id);
    return { success: true };
  }
}

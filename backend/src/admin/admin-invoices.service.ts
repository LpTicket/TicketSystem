import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isValidEmailFormat, suggestEmailFix } from '../common/utils/email-typo';
import { MailService } from '../common/services/mail.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Stripe = require('stripe');

type CreateManualInvoiceInput = {
  customerName: string;
  customerEmail: string;
  companyName?: string;
  concept: string;
  description?: string;
  amount: number;
  currency?: string;
  addProcessingFee?: boolean;
  dueDays?: number;
  notes?: string;
};

@Injectable()
export class AdminInvoicesService {
  private stripe: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {
    const mode = this.configService.get('STRIPE_MODE') || 'test';
    const key = mode === 'production'
      ? this.configService.get('STRIPE_SECRET_KEY_PROD')
      : (this.configService.get('STRIPE_SECRET_KEY_TEST') || this.configService.get('STRIPE_SECRET_KEY'));

    if (key) {
      this.stripe = new Stripe(key, {
        apiVersion: '2024-12-18.acacia' as any,
      });
    }
  }

  private ensureStripeConfigured() {
    if (!this.stripe) {
      throw new BadRequestException('Stripe no está configurado en el backend.');
    }
  }

  private toCents(value: number) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Ingresa un monto válido para la factura.');
    }
    return Math.round(amount * 100);
  }

  private formatInvoice(invoice: any) {
    const customer = invoice.customer && typeof invoice.customer === 'object' ? invoice.customer : null;
    return {
      id: invoice.id,
      number: invoice.number || invoice.id,
      status: invoice.status,
      customerName: customer?.name || invoice.customer_name || null,
      customerEmail: customer?.email || invoice.customer_email || null,
      amountDue: (invoice.amount_due || 0) / 100,
      amountPaid: (invoice.amount_paid || 0) / 100,
      currency: String(invoice.currency || 'usd').toUpperCase(),
      hostedInvoiceUrl: invoice.hosted_invoice_url || null,
      invoicePdf: invoice.invoice_pdf || null,
      createdAt: invoice.created ? new Date(invoice.created * 1000).toISOString() : null,
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
      metadata: invoice.metadata || {},
    };
  }

  async listManualInvoices(limit = 20) {
    this.ensureStripeConfigured();
    const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
    const invoices = await this.stripe.invoices.list({
      limit: safeLimit,
      expand: ['data.customer'],
    });

    return {
      invoices: (invoices.data || [])
        .filter((invoice: any) => invoice.metadata?.source === 'lpticket_manual_invoice')
        .map((invoice: any) => this.formatInvoice(invoice)),
    };
  }

  async createManualInvoice(input: CreateManualInvoiceInput) {
    this.ensureStripeConfigured();

    const customerName = input.customerName?.trim();
    const customerEmail = input.customerEmail?.trim().toLowerCase();
    const concept = input.concept?.trim();
    const description = input.description?.trim();
    const notes = input.notes?.trim();
    const companyName = input.companyName?.trim();
    const currency = (input.currency || 'USD').trim().toLowerCase();
    const dueDays = Math.max(1, Math.min(Number(input.dueDays) || 7, 90));

    if (!customerName) throw new BadRequestException('Ingresa el nombre del cliente.');
    if (!customerEmail || !isValidEmailFormat(customerEmail)) {
      throw new BadRequestException('El correo del cliente no es válido.');
    }
    const suggestion = suggestEmailFix(customerEmail);
    if (suggestion) throw new BadRequestException(`Revisa el correo: ¿quisiste decir ${suggestion}?`);
    if (!concept) throw new BadRequestException('Ingresa el concepto de la factura.');
    if (!/^[a-z]{3}$/i.test(currency)) throw new BadRequestException('La moneda debe tener 3 letras, por ejemplo USD.');

    const baseCents = this.toCents(input.amount);
    const processingFeeCents = input.addProcessingFee ? Math.round(baseCents * 0.035) : 0;

    const customer = await this.stripe.customers.create({
      name: companyName ? `${customerName} - ${companyName}` : customerName,
      email: customerEmail,
      metadata: {
        source: 'lpticket_manual_invoice',
      },
    });

    const invoice = await this.stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: dueDays,
      auto_advance: false,
      description: description || concept,
      footer: notes || 'Gracias por confiar en LPTicket. Puedes completar el pago de forma segura desde el enlace de Stripe.',
      metadata: {
        source: 'lpticket_manual_invoice',
        lp_fee: input.addProcessingFee ? 'true' : 'false',
        lp_fee_percent: input.addProcessingFee ? '3.5' : '0',
      },
    });

    await this.stripe.invoiceItems.create({
      customer: customer.id,
      invoice: invoice.id,
      amount: baseCents,
      currency,
      description: description ? `${concept} - ${description}` : concept,
    });

    if (processingFeeCents > 0) {
      await this.stripe.invoiceItems.create({
        customer: customer.id,
        invoice: invoice.id,
        amount: processingFeeCents,
        currency,
        description: 'Processing Fee 3.5%',
      });
    }

    const finalized = await this.stripe.invoices.finalizeInvoice(invoice.id, {
      expand: ['customer'],
    });
    const sent = await this.stripe.invoices.sendInvoice(finalized.id, {
      expand: ['customer'],
    });
    const formattedInvoice = this.formatInvoice(sent);

    let premiumEmailSent = false;
    if (formattedInvoice.hostedInvoiceUrl) {
      try {
        await this.mailService.sendManualInvoiceEmail(customerEmail, {
          customerName,
          concept,
          description,
          baseAmount: baseCents / 100,
          processingFee: processingFeeCents / 100,
          total: (baseCents + processingFeeCents) / 100,
          currency: currency.toUpperCase(),
          dueDate: formattedInvoice.dueDate,
          hostedInvoiceUrl: formattedInvoice.hostedInvoiceUrl,
          invoiceNumber: formattedInvoice.number,
          notes,
        });
        premiumEmailSent = true;
      } catch (emailError: any) {
        console.error('Manual invoice premium email failed:', emailError?.message || emailError);
      }
    }

    return {
      invoice: formattedInvoice,
      totals: {
        base: baseCents / 100,
        processingFee: processingFeeCents / 100,
        total: (baseCents + processingFeeCents) / 100,
        currency: currency.toUpperCase(),
      },
      premiumEmailSent,
    };
  }
}

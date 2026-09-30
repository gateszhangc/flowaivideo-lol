import {
  Environment,
  WaffoPancake,
  type GraphQLResponse,
  type WebhookEvent,
  type WebhookEventData,
} from '@waffo/pancake-ts';

import {
  CheckoutSession,
  PaymentConfigs,
  PaymentEvent,
  PaymentEventType,
  PaymentInterval,
  PaymentOrder,
  PaymentProvider,
  PaymentSession,
  PaymentStatus,
  PaymentType,
  SubscriptionCycleType,
  SubscriptionInfo,
  SubscriptionStatus,
} from './types';

/** Waffo Pancake payment provider configuration. */
export interface PancakeConfigs extends PaymentConfigs {
  merchantId: string;
  storeId: string;
  privateKey: string;
  environment?: 'test' | 'prod';
  baseUrl?: string;
  webhookPublicKey?: string;
}

type PancakeClient = Pick<
  WaffoPancake,
  'checkout' | 'graphql' | 'orders' | 'webhooks'
>;

type PancakeAmountDetails = {
  currency?: string;
  subtotal?: string;
  total?: string;
};

type PancakeOrderRecord = {
  id: string;
  buyerEmail?: string;
  status?: string;
  billingPeriod?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  canceledAt?: string;
};

type PancakePaymentRecord = {
  id: string;
  orderId?: string;
  orderMerchantExternalId?: string;
  status?: string;
  createdAt?: string;
  snapshotAmountDetails?: PancakeAmountDetails;
  onetimeOrder?: PancakeOrderRecord | null;
  subscriptionOrder?: PancakeOrderRecord | null;
};

type PancakePaymentQuery = {
  payments?: PancakePaymentRecord[];
};

const PAYMENT_QUERY = `query ($ref: String!) {
  payments(limit: 10, filter: { orderMerchantExternalId: { eq: $ref } }) {
    id
    orderId
    orderMerchantExternalId
    status
    createdAt
    snapshotAmountDetails { currency subtotal total }
    onetimeOrder { id buyerEmail status }
    subscriptionOrder {
      id
      buyerEmail
      status
      billingPeriod
      currentPeriodStart
      currentPeriodEnd
      canceledAt
    }
  }
}`;

const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'ISK',
  'JPY',
  'KMF',
  'KRW',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);
const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND']);

function normalizePem(value: string) {
  return value.trim().replace(/\\n/g, '\n');
}

function asMetadata(value: Record<string, any> | undefined) {
  return Object.fromEntries(
    Object.entries(value || {})
      .filter(([, entry]) => entry !== undefined && entry !== null)
      .map(([key, entry]) => [key, String(entry)])
  );
}

function minorDigits(currency: string) {
  const normalized = currency.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(normalized)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(normalized)) return 3;
  return 2;
}

/** Convert Waffo's display amount (for example, "19.99") to template minor units. */
export function amountToMinorUnits(
  amount: string | number | undefined,
  currency: string
) {
  if (amount === undefined || amount === null || amount === '') return 0;

  const value = String(amount).trim();
  const sign = value.startsWith('-') ? -1 : 1;
  const unsigned = value.replace(/^[+-]/, '');
  const [whole = '0', fraction = ''] = unsigned.split('.');
  const digits = minorDigits(currency);
  const normalizedFraction = `${fraction}${'0'.repeat(digits)}`.slice(
    0,
    digits
  );
  const parsed = Number(`${whole || '0'}${normalizedFraction}`);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid Pancake amount: ${amount}`);
  }

  return sign * parsed;
}

function asDate(value: string | undefined, field: string) {
  if (!value) throw new Error(`Pancake ${field} is missing`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid Pancake ${field}`);
  return date;
}

function mapInterval(period?: string): {
  interval: PaymentInterval;
  intervalCount: number;
} {
  switch (period?.toLowerCase()) {
    case 'weekly':
      return { interval: PaymentInterval.WEEK, intervalCount: 1 };
    case 'quarterly':
      return { interval: PaymentInterval.MONTH, intervalCount: 3 };
    case 'yearly':
      return { interval: PaymentInterval.YEAR, intervalCount: 1 };
    case 'monthly':
    default:
      return { interval: PaymentInterval.MONTH, intervalCount: 1 };
  }
}

function mapPaymentStatus(status?: string): PaymentStatus {
  switch (status?.toLowerCase()) {
    case 'succeeded':
    case 'paid':
    case 'completed':
      return PaymentStatus.SUCCESS;
    case 'failed':
      return PaymentStatus.FAILED;
    case 'canceled':
    case 'cancelled':
      return PaymentStatus.CANCELED;
    case 'pending':
    case 'processing':
    default:
      return PaymentStatus.PROCESSING;
  }
}

function mapSubscriptionStatus(status?: string): SubscriptionStatus {
  switch (status?.toLowerCase()) {
    case 'canceling':
      return SubscriptionStatus.PENDING_CANCEL;
    case 'canceled':
    case 'cancelled':
      return SubscriptionStatus.CANCELED;
    case 'expired':
    case 'closed':
      return SubscriptionStatus.EXPIRED;
    case 'past_due':
      return SubscriptionStatus.PAUSED;
    case 'pending':
      return SubscriptionStatus.PAUSED;
    case 'trialing':
      return SubscriptionStatus.TRIALING;
    case 'active':
    default:
      return SubscriptionStatus.ACTIVE;
  }
}

function mapEventType(eventType: string): PaymentEventType {
  switch (eventType) {
    case 'order.completed':
    case 'subscription.activated':
      return PaymentEventType.CHECKOUT_SUCCESS;
    case 'subscription.payment_succeeded':
      return PaymentEventType.PAYMENT_SUCCESS;
    case 'subscription.canceling':
    case 'subscription.uncanceled':
    case 'subscription.updated':
    case 'subscription.past_due':
      return PaymentEventType.SUBSCRIBE_UPDATED;
    case 'subscription.canceled':
      return PaymentEventType.SUBSCRIBE_CANCELED;
    case 'refund.succeeded':
      return PaymentEventType.PAYMENT_REFUNDED;
    case 'refund.failed':
      return PaymentEventType.PAYMENT_FAILED;
    default:
      throw new Error(`Unknown Pancake event type: ${eventType}`);
  }
}

function eventSubscriptionStatus(eventType: string, orderStatus?: string) {
  switch (eventType) {
    case 'subscription.canceling':
      return SubscriptionStatus.PENDING_CANCEL;
    case 'subscription.uncanceled':
      return SubscriptionStatus.ACTIVE;
    case 'subscription.past_due':
      return SubscriptionStatus.PAUSED;
    case 'subscription.canceled':
      return SubscriptionStatus.CANCELED;
    case 'subscription.activated':
    case 'subscription.payment_succeeded':
    case 'subscription.updated':
      return mapSubscriptionStatus(orderStatus);
    default:
      return undefined;
  }
}

function buildSubscriptionInfo({
  order,
  amount,
  currency,
  eventType,
  orderStatus,
}: {
  order: PancakeOrderRecord;
  amount: number;
  currency: string;
  eventType?: string;
  orderStatus?: string;
}): SubscriptionInfo {
  const interval = mapInterval(order.billingPeriod);
  const status = eventType
    ? eventSubscriptionStatus(eventType, orderStatus)
    : mapSubscriptionStatus(order.status);

  return {
    subscriptionId: order.id,
    description: undefined,
    amount,
    currency,
    interval: interval.interval,
    intervalCount: interval.intervalCount,
    currentPeriodStart: asDate(
      order.currentPeriodStart,
      'current period start'
    ),
    currentPeriodEnd: asDate(order.currentPeriodEnd, 'current period end'),
    canceledAt: order.canceledAt ? new Date(order.canceledAt) : undefined,
    status,
  };
}

function sessionFromPaymentRecord(
  record: PancakePaymentRecord,
  orderNo: string
): PaymentSession {
  const subscriptionOrder = record.subscriptionOrder;
  const amountDetails = record.snapshotAmountDetails || {};
  const currency = (amountDetails.currency || 'USD').toUpperCase();
  const amount = amountToMinorUnits(
    amountDetails.subtotal || amountDetails.total,
    currency
  );
  const paymentAmount = amountToMinorUnits(
    amountDetails.total || amountDetails.subtotal,
    currency
  );
  const email =
    subscriptionOrder?.buyerEmail ||
    record.onetimeOrder?.buyerEmail ||
    undefined;
  const session: PaymentSession = {
    provider: 'pancake',
    paymentStatus: mapPaymentStatus(record.status),
    paymentInfo: {
      transactionId: record.id,
      amount,
      currency,
      paymentAmount,
      paymentCurrency: currency,
      paymentEmail: email,
      paymentUserName: email,
      paidAt: record.createdAt ? new Date(record.createdAt) : undefined,
      subscriptionCycleType: subscriptionOrder
        ? SubscriptionCycleType.CREATE
        : undefined,
    },
    paymentResult: record,
    metadata: { order_no: orderNo },
  };

  if (subscriptionOrder) {
    session.subscriptionId = subscriptionOrder.id;
    session.subscriptionInfo = buildSubscriptionInfo({
      order: subscriptionOrder,
      amount,
      currency,
    });
    session.subscriptionResult = subscriptionOrder;
  }

  return session;
}

/** Build the template payment event from a verified Waffo webhook. */
export function buildPancakePaymentEvent(
  event: WebhookEvent<WebhookEventData>
): PaymentEvent {
  const data = event.data;
  const eventType = mapEventType(event.eventType);
  const currency = (data.currency || 'USD').toUpperCase();
  const amount = amountToMinorUnits(data.subtotal || data.amount, currency);
  const paymentAmount = amountToMinorUnits(data.total || data.amount, currency);
  const metadata = {
    ...asMetadata(data.orderMetadata),
  };

  if (data.orderMerchantExternalId) {
    metadata.order_no = data.orderMerchantExternalId;
  }

  const session: PaymentSession = {
    provider: 'pancake',
    paymentStatus:
      event.eventType === 'refund.succeeded'
        ? PaymentStatus.SUCCESS
        : event.eventType === 'refund.failed' ||
            event.eventType === 'subscription.past_due'
          ? PaymentStatus.FAILED
          : event.eventType === 'subscription.canceling' ||
              event.eventType === 'subscription.canceled'
            ? PaymentStatus.PROCESSING
            : PaymentStatus.SUCCESS,
    paymentInfo: {
      description: data.productDescription || data.productName,
      transactionId: data.paymentId || event.eventId,
      amount,
      currency,
      paymentAmount,
      paymentCurrency: currency,
      paymentEmail: data.buyerEmail,
      paymentUserName: data.buyerEmail,
      paidAt: data.paymentDate
        ? new Date(data.paymentDate)
        : new Date(event.timestamp),
      subscriptionCycleType:
        event.eventType === 'subscription.payment_succeeded'
          ? SubscriptionCycleType.RENEWAL
          : event.eventType === 'subscription.activated'
            ? SubscriptionCycleType.CREATE
            : undefined,
    },
    paymentResult: event,
    metadata,
  };

  if (data.billingPeriod || event.eventType.startsWith('subscription.')) {
    const subscriptionOrder: PancakeOrderRecord = {
      id: data.orderId,
      buyerEmail: data.buyerEmail,
      status: data.orderStatus,
      billingPeriod: data.billingPeriod,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      canceledAt:
        data.canceledAt ||
        (event.eventType === 'subscription.canceled'
          ? event.timestamp
          : undefined),
    };

    session.subscriptionId = data.orderId;
    session.subscriptionInfo = buildSubscriptionInfo({
      order: subscriptionOrder,
      amount,
      currency,
      eventType: event.eventType,
      orderStatus: data.orderStatus,
    });
    session.subscriptionResult = data;
  }

  return { eventType, eventResult: event, paymentSession: session };
}

/**
 * Waffo Pancake implementation for ShipAny's payment provider interface.
 *
 * `sessionId` is the ShipAny order number. Pancake's checkout session ID is
 * retained in `checkoutResult`; querying by `orderMerchantExternalId` keeps
 * callback reconciliation stable even when the provider creates a new payment
 * record for a subscription renewal.
 */
export class PancakeProvider implements PaymentProvider {
  readonly name = 'pancake';
  configs: PancakeConfigs;

  private client: PancakeClient;

  constructor(configs: PancakeConfigs, client?: PancakeClient) {
    this.configs = configs;

    const environment = configs.environment === 'prod' ? 'prod' : 'test';
    if (!configs.merchantId || !configs.storeId || !configs.privateKey) {
      throw new Error(
        'Pancake requires merchantId, storeId, and privateKey configuration'
      );
    }

    this.client =
      client ||
      new WaffoPancake({
        merchantId: configs.merchantId,
        privateKey: normalizePem(configs.privateKey),
        environment: environment as `${Environment}`,
        baseUrl: configs.baseUrl || undefined,
        webhookPublicKey: configs.webhookPublicKey
          ? normalizePem(configs.webhookPublicKey)
          : undefined,
      });
  }

  async createPayment({
    order,
  }: {
    order: PaymentOrder;
  }): Promise<CheckoutSession> {
    if (!order.productId) throw new Error('productId is required for Pancake');
    if (!order.customer?.email)
      throw new Error('customer email is required for Pancake');

    const metadata = asMetadata(order.metadata);
    const orderNo = order.orderNo || metadata.order_no;
    const result = await this.client.checkout.authenticated.create({
      productId: order.productId,
      currency: (order.price?.currency || 'USD').toUpperCase(),
      buyerIdentity: String(order.customer.id || order.customer.email),
      buyerEmail: order.customer.email,
      successUrl: order.successUrl,
      metadata,
      orderMerchantExternalId: orderNo,
      withTrial:
        order.type === PaymentType.SUBSCRIPTION
          ? Boolean(
              order.plan?.trialPeriodDays && order.plan.trialPeriodDays > 0
            )
          : undefined,
    });

    return {
      provider: this.name,
      checkoutParams: {
        productId: order.productId,
        currency: (order.price?.currency || 'USD').toUpperCase(),
        buyerIdentity: String(order.customer.id || order.customer.email),
        buyerEmail: order.customer.email,
        successUrl: order.successUrl,
        metadata,
        orderMerchantExternalId: orderNo,
      },
      checkoutInfo: {
        // See the class comment: callbacks query Pancake by this reference.
        sessionId: orderNo || result.sessionId,
        checkoutUrl: result.checkoutUrl,
      },
      checkoutResult: result,
      metadata,
    };
  }

  async getPaymentSession({
    sessionId,
  }: {
    sessionId: string;
  }): Promise<PaymentSession> {
    if (!sessionId) throw new Error('Pancake order reference is required');

    const response: GraphQLResponse<PancakePaymentQuery> =
      await this.client.graphql.query<PancakePaymentQuery>({
        query: PAYMENT_QUERY,
        variables: { ref: sessionId },
      });

    if (response.errors?.length) {
      throw new Error(
        `Pancake payment lookup failed: ${response.errors[0].message}`
      );
    }

    const record = response.data?.payments?.find(
      (payment) => payment.orderMerchantExternalId === sessionId
    );

    if (!record) {
      return {
        provider: this.name,
        paymentStatus: PaymentStatus.PROCESSING,
        paymentResult: { orderMerchantExternalId: sessionId },
        metadata: { order_no: sessionId },
      };
    }

    return sessionFromPaymentRecord(record, sessionId);
  }

  async getPaymentEvent({ req }: { req: Request }): Promise<PaymentEvent> {
    const rawBody = await req.text();
    if (!rawBody) throw new Error('Invalid Pancake webhook request');

    const event = this.client.webhooks.verify<WebhookEventData>(
      rawBody,
      req.headers.get('x-waffo-signature'),
      { environment: this.configs.environment === 'prod' ? 'prod' : 'test' }
    );

    const expectedEnvironment =
      this.configs.environment === 'prod' ? 'prod' : 'test';
    if (
      event.storeId !== this.configs.storeId ||
      event.mode !== expectedEnvironment
    ) {
      throw new Error('Pancake webhook scope mismatch');
    }

    return buildPancakePaymentEvent(event);
  }

  async cancelSubscription({
    subscriptionId,
  }: {
    subscriptionId: string;
  }): Promise<PaymentSession> {
    if (!subscriptionId)
      throw new Error('subscriptionId is required for Pancake');

    const result = await this.client.orders.cancelSubscription({
      orderId: subscriptionId,
    });

    return {
      provider: this.name,
      paymentStatus: PaymentStatus.PROCESSING,
      subscriptionId,
      subscriptionInfo: {
        subscriptionId,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        status: mapSubscriptionStatus(result.status),
        canceledAt: result.status === 'canceled' ? new Date() : undefined,
      },
      subscriptionResult: result,
      metadata: {},
    };
  }
}

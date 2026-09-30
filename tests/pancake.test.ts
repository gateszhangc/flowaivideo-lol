import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync } from 'node:crypto';
import test from 'node:test';

import {
  amountToMinorUnits,
  buildPancakePaymentEvent,
  PancakeProvider,
} from '../src/extensions/payment/pancake';
import { PaymentType } from '../src/extensions/payment/types';

test('converts Pancake display amounts into template minor units', () => {
  assert.equal(amountToMinorUnits('19.99', 'USD'), 1999);
  assert.equal(amountToMinorUnits('1000', 'JPY'), 1000);
  assert.equal(amountToMinorUnits('1.2', 'EUR'), 120);
  assert.equal(amountToMinorUnits('1.234', 'KWD'), 1234);
  assert.equal(amountToMinorUnits('-0.50', 'USD'), -50);
});

test('maps a one-time order webhook to a checkout success event', () => {
  const result = buildPancakePaymentEvent({
    id: 'delivery-1',
    timestamp: '2026-08-13T12:00:00.000Z',
    eventType: 'order.completed',
    eventId: 'PAY_1',
    storeId: 'STO_test',
    storeName: 'Test Store',
    mode: 'test',
    data: {
      orderId: 'ORD_1',
      orderMerchantExternalId: 'shipany-order-1',
      orderMetadata: { product_id: 'starter' },
      buyerEmail: 'buyer@example.com',
      currency: 'USD',
      amount: '19.99',
      subtotal: '19.99',
      total: '21.99',
      taxAmount: '2.00',
      productName: 'Starter',
      paymentId: 'PAY_1',
      paymentStatus: 'succeeded',
      paymentDate: '2026-08-13',
    },
  });

  assert.equal(result.eventType, 'checkout.success');
  assert.equal(result.paymentSession?.paymentStatus, 'paid');
  assert.equal(result.paymentSession?.paymentInfo?.amount, 1999);
  assert.equal(result.paymentSession?.paymentInfo?.paymentAmount, 2199);
  assert.equal(result.paymentSession?.metadata.order_no, 'shipany-order-1');
  assert.equal(result.paymentSession?.subscriptionId, undefined);
});

test('maps subscription renewal and cancellation state', () => {
  const result = buildPancakePaymentEvent({
    id: 'delivery-2',
    timestamp: '2026-08-13T12:00:00.000Z',
    eventType: 'subscription.payment_succeeded',
    eventId: 'PAY_2',
    storeId: 'STO_test',
    storeName: 'Test Store',
    mode: 'test',
    data: {
      orderId: 'ORD_SUB_1',
      orderMerchantExternalId: 'shipany-sub-1',
      buyerEmail: 'buyer@example.com',
      currency: 'USD',
      amount: '29.00',
      taxAmount: '0',
      productName: 'Pro',
      paymentId: 'PAY_2',
      paymentStatus: 'succeeded',
      billingPeriod: 'monthly',
      currentPeriodStart: '2026-08-13T00:00:00.000Z',
      currentPeriodEnd: '2026-09-13T00:00:00.000Z',
      orderStatus: 'active',
    },
  });

  assert.equal(result.eventType, 'payment.success');
  assert.equal(
    result.paymentSession?.paymentInfo?.subscriptionCycleType,
    'renew'
  );
  assert.equal(result.paymentSession?.subscriptionInfo?.interval, 'month');
  assert.equal(result.paymentSession?.subscriptionInfo?.intervalCount, 1);
  assert.equal(
    result.paymentSession?.subscriptionInfo?.currentPeriodEnd.toISOString(),
    '2026-09-13T00:00:00.000Z'
  );

  const cancel = buildPancakePaymentEvent({
    id: 'delivery-3',
    timestamp: '2026-08-13T12:00:00.000Z',
    eventType: 'subscription.canceling',
    eventId: 'ORD_SUB_1',
    storeId: 'STO_test',
    storeName: 'Test Store',
    mode: 'test',
    data: {
      orderId: 'ORD_SUB_1',
      orderMerchantExternalId: 'shipany-sub-1',
      buyerEmail: 'buyer@example.com',
      currency: 'USD',
      amount: '29.00',
      taxAmount: '0',
      productName: 'Pro',
      billingPeriod: 'monthly',
      currentPeriodStart: '2026-08-13T00:00:00.000Z',
      currentPeriodEnd: '2026-09-13T00:00:00.000Z',
      orderStatus: 'canceling',
    },
  });

  assert.equal(cancel.eventType, 'subscribe.updated');
  assert.equal(
    cancel.paymentSession?.subscriptionInfo?.status,
    'pending_cancel'
  );
});

test('maps a successful refund without treating it as a new payment', () => {
  const result = buildPancakePaymentEvent({
    id: 'delivery-refund',
    timestamp: '2026-08-13T12:00:00.000Z',
    eventType: 'refund.succeeded',
    eventId: 'REFUND_1',
    storeId: 'STO_test',
    storeName: 'Test Store',
    mode: 'test',
    data: {
      orderId: 'ORD_REFUND_1',
      orderMerchantExternalId: 'shipany-refund-1',
      buyerEmail: 'buyer@example.com',
      currency: 'USD',
      amount: '19.99',
      taxAmount: '0',
      productName: 'Starter',
      paymentId: 'PAY_REFUND_1',
      refundStatus: 'succeeded',
    },
  });

  assert.equal(result.eventType, 'payment.refunded');
  assert.equal(result.paymentSession?.metadata.order_no, 'shipany-refund-1');
  assert.equal(
    result.paymentSession?.paymentInfo?.transactionId,
    'PAY_REFUND_1'
  );
});

test('verifies Pancake webhook signatures and rejects a store mismatch', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const provider = new PancakeProvider({
    merchantId: 'MER_0000000000000000000000',
    storeId: 'STO_test',
    privateKey,
    webhookPublicKey: publicKey,
    environment: 'test',
  });
  const event = {
    id: 'delivery-signed',
    timestamp: new Date().toISOString(),
    eventType: 'order.completed',
    eventId: 'PAY_signed',
    storeId: 'STO_wrong',
    storeName: 'Wrong Store',
    mode: 'test',
    data: {
      orderId: 'ORD_signed',
      orderMerchantExternalId: 'SHIPANY-signed',
      buyerEmail: 'buyer@example.com',
      currency: 'USD',
      amount: '9.99',
      taxAmount: '0',
      productName: 'Signed Product',
    },
  };
  const body = JSON.stringify(event);
  const timestamp = String(Date.now());
  const signature = createSign('RSA-SHA256')
    .update(`${timestamp}.${body}`)
    .sign(privateKey, 'base64');

  await assert.rejects(
    provider.getPaymentEvent({
      req: new Request('https://example.com/api/payment/notify/pancake', {
        method: 'POST',
        body,
        headers: { 'x-waffo-signature': `t=${timestamp},v1=${signature}` },
      }),
    }),
    /webhook scope mismatch/
  );

  await assert.rejects(
    provider.getPaymentEvent({
      req: new Request('https://example.com/api/payment/notify/pancake', {
        method: 'POST',
        body,
        headers: { 'x-waffo-signature': `t=${timestamp},v1=invalid` },
      }),
    }),
    /Invalid webhook signature/
  );
});

test('creates an authenticated Pancake checkout without embedding credentials', async () => {
  let checkoutParams: Record<string, unknown> | undefined;
  const provider = new PancakeProvider(
    {
      merchantId: 'MER_test',
      storeId: 'STO_test',
      privateKey: 'placeholder-only',
      environment: 'test',
    },
    {
      checkout: {
        authenticated: {
          create: async (params: Record<string, unknown>) => {
            checkoutParams = params;
            return {
              sessionId: 'CS_test',
              checkoutUrl: 'https://checkout.example/#token=test',
              expiresAt: '2026-08-13T13:00:00.000Z',
              token: 'token-not-a-secret',
              tokenExpiresAt: '2026-08-13T13:05:00.000Z',
            };
          },
        },
      },
    } as any
  );

  const result = await provider.createPayment({
    order: {
      orderNo: 'SHIPANY-1',
      type: PaymentType.SUBSCRIPTION,
      productId: 'PROD_test',
      customer: { id: 'user-1', email: 'buyer@example.com' },
      price: { amount: 2900, currency: 'usd' },
      successUrl: 'https://example.com/success',
      metadata: { order_no: 'SHIPANY-1' },
    },
  });

  assert.equal(checkoutParams?.productId, 'PROD_test');
  assert.equal(checkoutParams?.buyerIdentity, 'user-1');
  assert.equal(checkoutParams?.orderMerchantExternalId, 'SHIPANY-1');
  assert.equal(result.checkoutInfo.sessionId, 'SHIPANY-1');
  assert.match(result.checkoutInfo.checkoutUrl, /^https:\/\/checkout\.example/);
});

test('looks up a payment by the ShipAny order reference', async () => {
  const provider = new PancakeProvider(
    {
      merchantId: 'MER_test',
      storeId: 'STO_test',
      privateKey: 'placeholder-only',
      environment: 'test',
    },
    {
      graphql: {
        query: async () => ({
          data: {
            payments: [
              {
                id: 'PAY_test',
                orderMerchantExternalId: 'SHIPANY-2',
                status: 'succeeded',
                createdAt: '2026-08-13T12:00:00.000Z',
                snapshotAmountDetails: {
                  currency: 'USD',
                  total: '29.00',
                },
                onetimeOrder: {
                  id: 'ORD_test',
                  buyerEmail: 'buyer@example.com',
                },
              },
            ],
          },
        }),
      },
    } as any
  );

  const session = await provider.getPaymentSession({ sessionId: 'SHIPANY-2' });
  assert.equal(session.paymentStatus, 'paid');
  assert.equal(session.paymentInfo?.transactionId, 'PAY_test');
  assert.equal(session.paymentInfo?.paymentAmount, 2900);
});

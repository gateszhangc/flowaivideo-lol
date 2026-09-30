import { respData, respErr } from '@/shared/lib/resp';
import { getCurrentSubscription } from '@/shared/models/subscription';
import { getUserInfo } from '@/shared/models/user';

/**
 * Read-only view of the signed-in account's subscription.
 *
 * The landing page gate calls this to decide between the home page and
 * /pricing. Billing itself is untouched by this route.
 */
export async function POST() {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const subscription = await getCurrentSubscription(user.id);

    return respData({
      subscribed: Boolean(subscription),
      status: subscription?.status || null,
      planName: subscription?.planName || null,
      interval: subscription?.interval || null,
      currentPeriodEnd: subscription?.currentPeriodEnd || null,
    });
  } catch (e) {
    console.log('get user subscription failed:', e);
    return respErr('get user subscription failed');
  }
}

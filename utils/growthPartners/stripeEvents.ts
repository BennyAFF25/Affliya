import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createCreatorCommissionFromPaidInvoice, getSubscriptionIdFromInvoiceForCommissions, reverseCreatorCommissionByInvoiceId } from '../creatorReferrals';
import { referralEvent } from './events';
const refId = (ref: unknown): string | null => typeof ref === 'string' ? ref : ref && typeof ref === 'object' && 'id' in ref ? String(ref.id) : null;
// Reporting must never change entitlement handling or its webhook response.
export async function trackGrowthPartnerStripeEvent(db: SupabaseClient, stripe: Stripe, event: Stripe.Event, subscription?: Stripe.Subscription) {
  try {
    if (event.type === 'invoice.voided') {
      await reverseCreatorCommissionByInvoiceId({ supabase: db, stripeInvoiceId: (event.data.object as Stripe.Invoice).id || null, reason: 'stripe_invoice_voided' });
      return;
    }
    if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
      const dispute = event.type === 'charge.dispute.created' ? event.data.object as Stripe.Dispute : null;
      const charge = dispute ? await stripe.charges.retrieve(refId(dispute.charge)!) : event.data.object as Stripe.Charge;
      const invoiceId = refId((charge as Stripe.Charge & { invoice?: unknown }).invoice);
      if (!invoiceId) return;
      // A dispute is treated as a full refund. Charge refunds are cumulative, including paginated refunds.
      const key = dispute ? `dispute:${dispute.id}` : `${charge.refunds?.data[0]?.id || charge.id}:${charge.amount_refunded}`;
      const { error } = await db.rpc('refund_creator_subscription_commission', {
        p_invoice_id: invoiceId, p_refund_key: key,
        p_cumulative_amount: dispute ? null : charge.amount_refunded,
        p_reason: dispute ? 'stripe_charge_disputed' : 'stripe_charge_refunded',
      });
      if (error) throw new Error('Refund recording failed');
      return;
    }
    if (!subscription) return;
    const { data: entitlement, error } = await db.from('business_entitlements').select('business_id').eq('stripe_subscription_id', subscription.id).maybeSingle();
    if (error) throw new Error('Entitlement lookup failed');
    if (!entitlement?.business_id) return;
    const { data: attribution, error: attributionError } = await db.from('business_creator_attributions').select('id,creator_partner_id,first_trial_started_at,cancelled_at').eq('business_id', entitlement.business_id).maybeSingle();
    if (attributionError) throw new Error('Attribution lookup failed');
    if (!attribution) return;
    const audit = (type: string) => referralEvent(db, attribution.creator_partner_id, type, event.id, { subscription_id: subscription.id }, entitlement.business_id);
    for (const [column, value] of Object.entries({ stripe_customer_id: refId(subscription.customer), first_subscription_id: subscription.id })) {
      const { error: updateError } = await db.from('business_creator_attributions').update({ [column]: value }).eq('id', attribution.id).is(column, null);
      if (updateError) throw new Error('Attribution link update failed');
    }
    if (event.type.startsWith('customer.subscription.')) {
      if (subscription.status === 'trialing' && !attribution.first_trial_started_at) {
        const { error: updateError } = await db.from('business_creator_attributions').update({ first_trial_started_at: new Date((subscription.trial_start || event.created) * 1000).toISOString() }).eq('id', attribution.id).is('first_trial_started_at', null);
        if (updateError) throw new Error('Trial update failed');
        await audit('trial_started');
      }
      const previous = event.data.previous_attributes as { cancel_at_period_end?: boolean } | undefined;
      if (event.type === 'customer.subscription.deleted' || (subscription.cancel_at_period_end && previous?.cancel_at_period_end === false)) {
        const { error: updateError } = await db.from('business_creator_attributions').update({ cancelled_at: new Date(event.created * 1000).toISOString() }).eq('id', attribution.id);
        if (updateError) throw new Error('Cancellation update failed');
        await audit('subscription_cancelled');
      }
    }
    if (event.type === 'invoice.payment_failed') await audit('payment_failed');
    if (event.type === 'invoice.paid') {
      let invoice = event.data.object as Stripe.Invoice;
      // Fetch all lines when webhook payload is truncated; the pure calculator otherwise fails closed.
      if (invoice.lines.has_more) {
        const lines = await stripe.invoices.listLineItems(invoice.id!).autoPagingToArray({ limit: 10000 });
        invoice = { ...invoice, lines: { ...invoice.lines, data: lines, has_more: false } };
      }
      if (getSubscriptionIdFromInvoiceForCommissions(invoice) === subscription.id) await createCreatorCommissionFromPaidInvoice({ supabase: db, invoice, subscription });
    }
  } catch { console.warn('[growth-partners] Stripe reporting failed; reconcile required', { eventId: event.id }); }
}

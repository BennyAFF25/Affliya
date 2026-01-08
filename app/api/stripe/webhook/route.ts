export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: false,
  },
};

if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
  console.error("[❌ Missing Stripe environment keys]");
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

let POST: any;
if (!stripeSecretKey || !endpointSecret) {
  POST = async function POST() {
    return NextResponse.json(
      { error: "Missing Stripe environment keys" },
      { status: 500 }
    );
  };
} else {
  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2025-08-27.basil",
  });

  // Debug log to confirm which Stripe account is active with try/catch
  (async () => {
    try {
      const acct = await stripe.accounts.retrieve();
      console.log(
        "[Stripe Webhook Account]",
        acct.id,
        acct.email ? acct.email : "(email not available)"
      );
    } catch (err: any) {
      console.error("[❌ Stripe account retrieve error]", err.message);
    }
  })();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  POST = async function POST(req: Request) {
    const buf = await req.arrayBuffer();
    const rawBody = Buffer.from(buf);
    const sig = req.headers.get("stripe-signature")!;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    } catch (err: any) {
      console.error("[❌ Webhook signature error]", err.message);
      return NextResponse.json(
        { error: `Webhook Error: ${err.message}` },
        { status: 400 }
      );
    }

    console.log("[🔔 Webhook event]", event.type);
    let platformAcctId = "unknown";
    try {
      const platformAccount = await stripe.accounts.retrieve();
      platformAcctId = platformAccount.id;
    } catch (err: any) {
      console.error("[❌ Stripe platform account retrieve error]", err.message);
    }

    try {
      switch (event.type) {
        case "account.updated": {
          const account = event.data.object as Stripe.Account;

          const isComplete =
            account.details_submitted === true &&
            account.charges_enabled === true &&
            account.payouts_enabled === true;

          console.log("[✅ account.updated]", {
            accountId: account.id,
            isComplete,
          });

          if (isComplete) {
            const { error } = await supabase
              .from("affiliate_profiles")
              .update({
                stripe_account_id: account.id,
                stripe_onboarding_complete: true,
              })
              .eq("stripe_account_id", account.id);

            if (error) {
              console.error("[❌ affiliate_profiles update failed]", error);
            } else {
              console.log("[✅ affiliate_profiles onboarding marked complete]");
            }
          }

          break;
        }
        case "checkout.session.completed": {
          console.log(
            `[✅ Handling checkout.session.completed] platformAcctId: ${platformAcctId}`
          );
          const session = event.data.object as Stripe.Checkout.Session;
          const paymentIntentId = session.payment_intent as string | null;

          if (!paymentIntentId) {
            console.warn(
              "[⚠️ checkout.session.completed: No payment_intent on session]",
              session.id
            );
            break;
          }

          const pi = (await stripe.paymentIntents.retrieve(paymentIntentId as string, {
            expand: ["charges"],
          })) as Stripe.Response<Stripe.PaymentIntent>;
          const charge = pi.charges?.data?.[0] as Stripe.Charge | undefined;

          if (!charge || !charge.balance_transaction) {
            console.warn(
              "[⚠️ checkout.session.completed: No charge/balance_transaction yet]",
              paymentIntentId
            );
            break;
          }

          const balanceTx = await stripe.balanceTransactions.retrieve(
            charge.balance_transaction as string
          );

          const gross_amount = +(balanceTx.amount / 100).toFixed(2);
          const fees = +(balanceTx.fee / 100).toFixed(2);
          const net_amount = +(balanceTx.net / 100).toFixed(2);
          const email = charge.billing_details?.email ?? "unknown@example.com";

          console.log(
            "[✅ Stripe Top-up Details (from session)]",
            { email, gross_amount, fees, net_amount },
            `platformAcctId: ${platformAcctId}`
          );

          const { error } = await supabase.from("wallet_topups").insert({
            affiliate_email: email,
            amount_gross: gross_amount,
            stripe_fees: fees,
            amount_net: net_amount,
            stripe_id: paymentIntentId,
            status: "succeeded",
            platform_acct_id: platformAcctId,
          });

          if (error) {
            console.error("[❌ Supabase Insert Error]", error);
          } else {
            console.log("[✅ Wallet Top-up Recorded (from session)]");
            // Upsert wallet balance
            const { error: upsertError } = await supabase
              .from("wallets")
              .upsert(
                {
                  email: email,
                  role: "affiliate",
                  last_transaction_id: paymentIntentId,
                  last_transaction_status: "succeeded",
                  last_topup_amount: gross_amount,
                  last_fee_amount: fees,
                  last_net_amount: net_amount,
                },
                { onConflict: "email, role" }
              )
              .select();

            if (upsertError) {
              console.error("[❌ Wallet balance upsert error]", upsertError);
            } else {
              // Increment balance separately to add net_amount
              const { error: updateError } = await supabase
                .from("wallets")
                .update({
                  balance: supabase.rpc("increment_balance", { email_arg: email, role_arg: "affiliate", amount_arg: net_amount }),
                })
                .eq("email", email)
                .eq("role", "affiliate");

              // If no RPC function, fallback to increment using raw SQL or read-modify-write. 
              // However, here we assume supabase.rpc exists or use a direct increment.

              if (updateError) {
                console.error("[❌ Wallet balance increment error]", updateError);
              } else {
                console.log("[✅ Wallet balance upserted]");
              }
            }
          }

          break;
        }
        case "charge.succeeded":
        case "charge.updated": {
          console.log(
            `[✅ Handling ${event.type} event] platformAcctId: ${platformAcctId}`
          );

          const charge = event.data.object as Stripe.Charge;
          const balanceTxId = charge.balance_transaction as string | undefined;

          if (!balanceTxId) {
            console.warn(
              `[⚠️ ${event.type}: No balance_transaction yet]`,
              charge.id
            );
            break;
          }

          const balanceTx = await stripe.balanceTransactions.retrieve(balanceTxId);

          const gross_amount = +(balanceTx.amount / 100).toFixed(2);
          const fees = +(balanceTx.fee / 100).toFixed(2);
          const net_amount = +(balanceTx.net / 100).toFixed(2);
          const email = charge.billing_details?.email ?? "unknown@example.com";

          console.log(
            "[✅ Stripe Top-up Details]",
            {
              email,
              gross_amount,
              fees,
              net_amount,
            },
            `platformAcctId: ${platformAcctId}`
          );

          const { error } = await supabase.from("wallet_topups").insert({
            affiliate_email: email,
            amount_gross: gross_amount,
            stripe_fees: fees,
            amount_net: net_amount,
            stripe_id: charge.payment_intent,
            status: "succeeded",
            platform_acct_id: platformAcctId, // track origin account id
          });

          if (error) {
            console.error("[❌ Supabase Insert Error]", error);
          } else {
            console.log("[✅ Wallet Top-up Recorded]");
            // Upsert wallet balance
            const { error: upsertError } = await supabase
              .from("wallets")
              .upsert(
                {
                  email: email,
                  role: "affiliate",
                  last_transaction_id: charge.id,
                  last_transaction_status: "succeeded",
                  last_topup_amount: gross_amount,
                  last_fee_amount: fees,
                  last_net_amount: net_amount,
                },
                { onConflict: "email, role" }
              )
              .select();

            if (upsertError) {
              console.error("[❌ Wallet balance upsert error]", upsertError);
            } else {
              // Increment balance separately to add net_amount
              const { error: updateError } = await supabase
                .from("wallets")
                .update({
                  balance: supabase.rpc("increment_balance", { email_arg: email, role_arg: "affiliate", amount_arg: net_amount }),
                })
                .eq("email", email)
                .eq("role", "affiliate");

              if (updateError) {
                console.error("[❌ Wallet balance increment error]", updateError);
              } else {
                console.log("[✅ Wallet balance upserted]");
              }
            }
          }

          break;
        }

        default:
          console.log(`[ℹ️ Unhandled event type]: ${event.type}`);
          console.log("[platform acct]", platformAcctId);
      }
    } catch (err: any) {
      console.error("[❌ Webhook handler error]", err.message);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  };
}

export { POST };
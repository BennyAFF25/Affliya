import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { businessEmail } = await req.json();

    if (!businessEmail) {
      return NextResponse.json(
        { error: "Missing business email." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error:
          "Business Connect onboarding is disabled. Use /api/stripe/create-customer instead.",
      },
      { status: 410 }
    );
  } catch (err: unknown) {
    console.error("[❌ Stripe Error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

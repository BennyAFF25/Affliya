import LegalPolicyContent from "@/components/legal/LegalPolicyContent";
import LegalPolicyNavigation from "@/components/legal/LegalPolicyNavigation";

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-[#0b0f10] text-gray-200">
      <div className="mx-auto max-w-4xl px-6 py-10 sm:py-16">
        <LegalPolicyNavigation />
        <LegalPolicyContent policy="terms" />
      </div>
    </main>
  );
}

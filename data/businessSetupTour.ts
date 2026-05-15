import type { TourStep } from "@/components/onboarding/InteractiveTour";

export const businessSetupTourSteps: TourStep[] = [
  {
    id: "open-shopify-settings",
    title: "Open Shopify settings",
    body: "Start in Shopify and open Settings in the bottom-left corner.",
    image: "/tours/business-setup/step-1.png",
    hotspot: { x: 12, y: 88 },
    cursorStart: { x: 26, y: 80 },
    accentLabel: "Shopify",
  },
  {
    id: "open-customer-events",
    title: "Open Customer Events",
    body: "Inside settings, go to Customer Events. This is where the Nettmark pixel gets added.",
    image: "/tours/business-setup/step-2.png",
    hotspot: { x: 33, y: 38 },
    cursorStart: { x: 20, y: 20 },
    accentLabel: "Shopify",
  },
  {
    id: "create-custom-pixel",
    title: "Create the Nettmark custom pixel",
    body: "Create a custom pixel, give it a clear name, and open the code editor.",
    image: "/tours/business-setup/step-3.png",
    hotspot: { x: 84, y: 18 },
    cursorStart: { x: 70, y: 12 },
    accentLabel: "Shopify",
  },
  {
    id: "paste-n-save",
    title: "Paste the code and save",
    body: "Paste the Nettmark pixel, connect it, then save. After that, return to Nettmark and run the tracking test.",
    image: "/tours/business-setup/step-4.png",
    hotspot: { x: 84, y: 11 },
    cursorStart: { x: 67, y: 24 },
    accentLabel: "Finish",
  },
];

import type { ReactNode } from "react";
import GrowthMetaSetupPrompt from "./GrowthMetaSetupPrompt";

export default function MyBusinessLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <GrowthMetaSetupPrompt />
      {children}
    </>
  );
}

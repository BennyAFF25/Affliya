import type { SVGProps } from "react";

/** Blue Meta infinity icon, shared by campaign views and dashboard. */
export default function MetaMark({
  className = "h-5 w-7",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 24" className={className} fill="none" aria-label="Meta" role="img" {...props}>
      <path
        d="M3 15.5C3 11.1 5.2 5.8 9 5.8c2.5 0 4.6 2 7.5 6.6l3.5 5.5C22.5 9.3 25.2 5.8 29 5.8c4.9 0 8 5.7 8 10 0 3.5-1.8 5.9-4.8 5.9-3.2 0-5.4-3-9-8.8l-3-4.8C17 13 13.5 20.7 9 20.7c-3.8 0-6-2.1-6-5.2Z"
        stroke="#1688FA"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

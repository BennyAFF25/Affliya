import React from "react";
import Script from "next/script";

type StorylaneEmbedProps = {
  desktopHref: string;
  desktopPadding: string;
  title: string;
  mobileHref?: string;
  mobilePadding?: string;
  mobileTitle?: string;
  className?: string;
};

function EmbedFrame({
  href,
  padding,
  title,
  name,
}: {
  href: string;
  padding: string;
  title: string;
  name: string;
}) {
  return (
    <div
      className="sl-embed relative w-full overflow-hidden rounded-[1.2rem] bg-black"
      style={{
        paddingBottom: padding,
        height: 0,
        transform: "scale(1)",
      }}
    >
      <iframe
        title={title}
        loading="lazy"
        className="sl-demo absolute left-0 top-0 h-full w-full"
        src={href}
        name={name}
        allow="fullscreen"
        allowFullScreen
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          border: "1px solid rgba(63,95,172,0.35)",
          boxShadow: "0px 0px 18px rgba(26, 19, 72, 0.15)",
          borderRadius: "10px",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

export default function StorylaneEmbed({
  desktopHref,
  desktopPadding,
  title,
  mobileHref,
  mobilePadding,
  mobileTitle,
  className,
}: StorylaneEmbedProps) {
  const hasMobileEmbed = Boolean(mobileHref);
  const resolvedMobilePadding = mobilePadding || "calc(177.78% + 25px)";

  return (
    <div className={className}>
      <Script
        src="https://js.storylane.io/js/v2/storylane.js"
        strategy="afterInteractive"
        data-verify-origin=""
      />

      {hasMobileEmbed ? (
        <>
          <div className="md:hidden">
            <EmbedFrame
              href={mobileHref || desktopHref}
              padding={resolvedMobilePadding}
              title={mobileTitle || title}
              name="sl-embed-mobile"
            />
          </div>
          <div className="hidden md:block">
            <EmbedFrame
              href={desktopHref}
              padding={desktopPadding}
              title={title}
              name="sl-embed-desktop"
            />
          </div>
        </>
      ) : (
        <EmbedFrame
          href={desktopHref}
          padding={desktopPadding}
          title={title}
          name="sl-embed"
        />
      )}
    </div>
  );
}

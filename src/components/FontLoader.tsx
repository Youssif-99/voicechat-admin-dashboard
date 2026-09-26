"use client";
/**
 * FontLoader — loads Google Fonts asynchronously without blocking rendering.
 *
 * This component runs only on the client, so React event handlers are valid
 * here. The `onLoad` callback switches the link's media from "print" to "all"
 * once the stylesheet has downloaded, avoiding render-blocking behaviour.
 *
 * Why a Client Component:
 *   - The root layout.tsx is a Server Component.
 *   - Server Components cannot attach DOM event handlers.
 *   - Passing onLoad="string" in a Server Component causes the React warning:
 *     "Expected `onLoad` listener to be a function, instead got `string`."
 *   - Moving the <link> here makes `onLoad={() => ...}` legal.
 */

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Almarai:wght@400;700;800" +
  "&family=Tajawal:wght@300;400;500;700" +
  "&family=IBM+Plex+Mono:wght@400;500;600&display=swap";

export function FontLoader() {
  return (
    <>
      {/* Warm up the DNS + TLS connection before the stylesheet request */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />

      {/*
        Async font loading via the media="print" trick:
          1. Browser fetches the stylesheet in the background (print = low priority).
          2. onLoad fires once download completes.
          3. We switch media to "all" so the fonts apply — zero render-blocking.
      */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href={FONTS_URL}
        media="print"
        onLoad={(e) => {
          (e.currentTarget as HTMLLinkElement).media = "all";
        }}
      />

      {/* Fallback for no-JS environments */}
      <noscript>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={FONTS_URL} />
      </noscript>
    </>
  );
}

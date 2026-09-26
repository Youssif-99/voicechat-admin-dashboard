"use client";

/**
 * BannerImage — client component for banner image preview.
 *
 * Isolated here so banners/page.tsx stays a server component while
 * still getting the onError fallback behaviour (hides broken images).
 */
export function BannerImage({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

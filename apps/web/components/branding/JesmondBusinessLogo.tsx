"use client";

import Image from "next/image";

interface JesmondBusinessLogoProps {
  size?: "sm" | "md";
  className?: string;
}

/**
 * Shared Jesmond Business logo lockup using the existing /assets/icon.png asset.
 * Structure:
 *   [ ICON ]  Jesmond
 *             BUSINESS
 */
export function JesmondBusinessLogo({
  size = "md",
  className = "",
}: JesmondBusinessLogoProps) {
  const iconClass =
    size === "sm"
      ? "h-8 w-auto object-contain shrink-0"
      : "h-9 sm:h-10 w-auto object-contain shrink-0";
  const wordmarkClass =
    size === "sm"
      ? "font-outfit font-extrabold text-base text-[#FFF9EF] tracking-tight leading-none"
      : "font-outfit font-extrabold text-lg sm:text-[19px] text-[#FFF9EF] tracking-tight leading-none";
  const subtitleClass =
    size === "sm"
      ? "font-outfit font-bold text-[8.5px] uppercase tracking-[0.22em] text-[#D6A64F] leading-none mt-[2px]"
      : "font-outfit font-bold text-[9px] sm:text-[9.5px] uppercase tracking-[0.22em] text-[#D6A64F] leading-none mt-[2px]";

  return (
    <span className={`inline-flex items-center gap-2.5 min-w-0 select-none ${className}`}>
      <Image
        src="/assets/icon.png"
        alt="Jesmond"
        width={64}
        height={44}
        className={`${iconClass} group-hover:scale-105 transition-transform`}
        priority
      />
      <span className="inline-flex flex-col justify-center min-w-0">
        <span className={wordmarkClass}>Jesmond</span>
        <span className={subtitleClass}>BUSINESS</span>
      </span>
    </span>
  );
}

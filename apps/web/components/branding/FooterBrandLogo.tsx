"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { isBusinessHost } from "@/utils/auth";
import { JesmondBusinessLogo } from "./JesmondBusinessLogo";

export function FooterBrandLogo() {
  const pathname = usePathname();
  const [isBizHost, setIsBizHost] = useState(false);

  useEffect(() => {
    setIsBizHost(isBusinessHost());
  }, []);

  if (isBizHost || pathname === "/pricing") {
    return (
      <div className="lg:mb-4">
        <JesmondBusinessLogo size="sm" className="lg:hidden" />
        <JesmondBusinessLogo className="hidden lg:inline-flex" />
      </div>
    );
  }

  return (
    <Image
      src="/assets/logo_footer.png"
      alt="Jesmond"
      width={512}
      height={396}
      className="w-[136px] sm:w-[160px] lg:w-[190px] h-auto object-contain"
    />
  );
}

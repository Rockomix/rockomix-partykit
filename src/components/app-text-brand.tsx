import Image from "next/image";
import { cn } from "~/lib/utils";
import { APP_TEXT_BRAND } from "~/constants/app";

type Props = {
  className?: string;
};

export function AppTextBrand({ className }: Props) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src="/android-chrome-192x192.png"
        alt={APP_TEXT_BRAND.name}
        width={192}
        height={192}
        priority
        className="h-auto w-[56px] shrink-0 object-contain sm:w-[56px]"
      />
      <span className="flex flex-col items-start justify-center">
        <span className="text-[18px] font-semibold leading-tight text-white">
          {APP_TEXT_BRAND.name}
        </span>
        <span className="text-[15px] italic font-medium leading-none text-white/75">
          {APP_TEXT_BRAND.subtitle}
        </span>
      </span>
    </div>
  );
}

import Image from "next/image";
import { cn } from "~/lib/utils";
import logo from "~/assets/my-karaoke-party-logo.png";
import { APP_TEXT_BRAND } from "~/constants/app";

type LogoBrandSize = "lg" | "md" | "sm" | "xs";

type Props = {
  className?: string;
  size?: LogoBrandSize;
};

const sizeStyles: Record<
  LogoBrandSize,
  {
    imageClass: string;
    width: number;
    height: number;
    labelClass: string;
    gapClass: string;
    layoutClass: string;
  }
> = {
  lg: {
    imageClass: "max-w-[200px] sm:max-w-[200px]",
    width: 200,
    height: 113,
    labelClass: "text-[18px] sm:text-[20px]",
    gapClass: "gap-2",
    layoutClass: "flex-col items-center",
  },

  md: {
    imageClass: "max-w-[180px] sm:max-w-[180px]",
    width: 180,
    height: 102,
    labelClass: "text-[15px] sm:text-[16px]",
    gapClass: "gap-1.5",
    layoutClass: "flex-col items-center",
  },

  sm: {
    imageClass: "max-w-[160px] sm:max-w-[160px]",
    width: 160,
    height: 90,
    labelClass: "text-[12px] sm:text-[13px]",
    gapClass: "gap-1",
    layoutClass: "flex-col items-center",
  },
  xs: {
    imageClass: "max-w-[120px] sm:max-w-[140px]",
    width: 100,
    height: 60,
    labelClass: "text-[10px]",
    gapClass: "gap-1",
    layoutClass: "flex-col items-center",
  },
};

export function LogoBrand({ size = "md", className }: Props) {
  const styles = sizeStyles[size];

  return (
    <div className={cn("flex", styles.layoutClass, styles.gapClass, className)}>
      <Image
        src={logo}
        width={styles.width}
        height={styles.height}
        className={cn("h-auto w-full object-contain", styles.imageClass)}
        alt="My Karaoke Party logo"
        priority
        placeholder="blur"
      />

      <span
        className={cn(
          "self-end pr-1 font-bold tracking-wide text-white/75",
          styles.labelClass,
        )}
      >
        {APP_TEXT_BRAND.subtitle}
      </span>
    </div>
  );
}

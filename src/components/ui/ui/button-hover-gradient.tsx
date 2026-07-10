import { cn } from "~/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function ButtonHoverGradient(props: ButtonProps) {
  return (
    <button
      className={cn(
        "group relative inline-flex items-center justify-center overflow-hidden rounded-md p-0.5 font-bold shadow-lg active:inset-y-px",
        props.className,
      )}
    >
      <span className="absolute h-full w-full bg-gradient-to-br from-[#ff8a05] via-[#ff5478] to-[#ff00c6] group-hover:from-[#ff00c6] group-hover:via-[#ff5478] group-hover:to-[#ff8a05]"></span>
      <span className="duration-400 relative rounded-md bg-white px-6 py-3 w-full transition-all ease-out group-hover:bg-opacity-0">
        <span className="relative bg-gradient-to-br from-[#ff8a05] via-[#ff5478] to-[#ff00c6] bg-clip-text text-transparent group-hover:text-white">
          {props.children}
        </span>
      </span>
    </button>
  );
}

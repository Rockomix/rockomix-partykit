type Props = {
  fire: () => void;
  text: string;
};

export function ButtonCta({ fire, text }: Props) {
  return (
    <button
      onClick={fire}
      className="text-md mt-10 cursor-pointer rounded-sm border-2 border-black bg-white px-4 py-2 text-black transition-all duration-500 hover:translate-x-[-2px] hover:translate-y-[0px] hover:rounded-sm hover:shadow-[10px_10px_0px_black] active:translate-x-[0px] active:translate-y-[6px] active:rounded-sm active:shadow-none md:px-8 md:py-4"
    >
      {text}
    </button>
  );
}

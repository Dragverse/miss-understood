import Image from "next/image";

interface SponsoredImageProps {
  href: string;
  imageSrc: string;
  imageAlt: string;
}

export function SponsoredImage({ href, imageSrc, imageAlt }: SponsoredImageProps) {
  return (
    <div className="rounded-[24px] overflow-hidden border-2 border-[#2f2942]/60 hover:border-[#2f2942] transition-all group shadow-lg">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative"
      >
        <div className="absolute top-4 left-4 z-10 px-3 py-1.5 bg-black/70 backdrop-blur-sm rounded-full border border-white/10">
          <span className="text-[10px] text-gray-300 uppercase tracking-[0.15em] font-bold">
            Sponsored
          </span>
        </div>
        <div className="relative aspect-square overflow-hidden bg-[#0f071a]">
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      </a>
    </div>
  );
}

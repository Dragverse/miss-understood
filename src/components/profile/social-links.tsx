import { FiLink2, FiGlobe } from "react-icons/fi";
import { FaInstagram, FaTiktok } from "react-icons/fa";
import { SiBluesky } from "react-icons/si";
import { Creator } from "@/types";
import { FarcasterIcon } from "@/components/profile/farcaster-badge";

interface SocialLinksProps {
  creator: Creator;
}

export function SocialLinks({ creator }: SocialLinksProps) {
  const socialAccounts = [
    {
      name: "Instagram",
      handle: creator.instagramHandle,
      url: creator.instagramHandle ? `https://instagram.com/${creator.instagramHandle}` : null,
      icon: <FaInstagram className="w-5 h-5" />,
      color: "text-pink-500",
    },
    {
      name: "TikTok",
      handle: creator.tiktokHandle,
      url: creator.tiktokHandle ? `https://tiktok.com/@${creator.tiktokHandle}` : null,
      icon: <FaTiktok className="w-5 h-5" />,
      color: "text-black dark:text-white",
    },
    {
      name: "Farcaster",
      handle: creator.farcasterHandle,
      url: creator.farcasterHandle ? `https://warpcast.com/${creator.farcasterHandle}` : null,
      icon: <FarcasterIcon className="w-5 h-5" />,
      color: "text-purple-500",
    },
    {
      name: "Bluesky",
      handle: creator.handle ? `${creator.handle}.bsky.social` : null,
      url: creator.handle ? `https://bsky.app/profile/${creator.handle}.bsky.social` : null,
      icon: <SiBluesky className="w-5 h-5" />,
      color: "text-blue-500",
    },
  ];

  const hasWebsite = creator.website && creator.website.trim().length > 0;
  const hasSocialAccounts = socialAccounts.some(account => account.handle);

  if (!hasWebsite && !hasSocialAccounts) {
    return null;
  }

  return (
    <div className="border-t border-[#2f2942] pt-4">
      <h3 className="font-semibold mb-3 text-[#FCF1FC] flex items-center gap-2">
        <FiLink2 className="w-4 h-4" />
        Links
      </h3>
      <div className="space-y-2">
        {/* Website */}
        {hasWebsite && (
          <a
            href={creator.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[#EB83EA] hover:text-[#E748E6] transition"
          >
            <FiGlobe className="w-4 h-4" />
            <span className="text-sm">{creator.website && new URL(creator.website).hostname}</span>
          </a>
        )}

        {/* Social Accounts */}
        {socialAccounts.map((account) => {
          if (!account.handle || !account.url) return null;

          return (
            <a
              key={account.name}
              href={account.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 ${account.color} hover:opacity-80 transition`}
            >
              {account.icon}
              <span className="text-sm">
                {account.name === "Bluesky" ? account.handle : `@${account.handle}`}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

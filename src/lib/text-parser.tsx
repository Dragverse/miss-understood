import Link from "next/link";
import React from "react";

export function parseTextWithLinks(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];

  // Regex patterns
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const hashtagPattern = /(^|\s)(#[a-zA-Z0-9_]+)/g;

  // Split text into segments
  let lastIndex = 0;
  const segments: Array<{ type: 'text' | 'url' | 'hashtag', content: string, index: number }> = [];

  // Find all URLs
  let match;
  while ((match = urlPattern.exec(text)) !== null) {
    segments.push({ type: 'url', content: match[0], index: match.index });
  }

  // Find all hashtags
  const hashtagMatches = text.matchAll(hashtagPattern);
  for (const hashMatch of hashtagMatches) {
    const hashtag = hashMatch[2]; // Get the hashtag without leading space
    const index = hashMatch.index! + (hashMatch[1]?.length || 0); // Adjust for whitespace
    segments.push({ type: 'hashtag', content: hashtag, index });
  }

  // Sort segments by index
  segments.sort((a, b) => a.index - b.index);

  // Build the result
  segments.forEach((segment, i) => {
    // Add text before this segment
    if (segment.index > lastIndex) {
      elements.push(
        <span key={`text-${i}`}>{text.slice(lastIndex, segment.index)}</span>
      );
    }

    // Add the segment
    if (segment.type === 'url') {
      elements.push(
        <a
          key={`url-${i}`}
          href={segment.content}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#EB83EA] hover:text-[#E748E6] underline transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {segment.content}
        </a>
      );
      lastIndex = segment.index + segment.content.length;
    } else if (segment.type === 'hashtag') {
      elements.push(
        <Link
          key={`hashtag-${i}`}
          href={`/feed?hashtag=${encodeURIComponent(segment.content)}`}
          className="text-[#E748E6] hover:text-[#EB83EA] font-medium transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {segment.content}
        </Link>
      );
      lastIndex = segment.index + segment.content.length;
    }
  });

  // Add any remaining text
  if (lastIndex < text.length) {
    elements.push(
      <span key="text-final">{text.slice(lastIndex)}</span>
    );
  }

  return elements;
}

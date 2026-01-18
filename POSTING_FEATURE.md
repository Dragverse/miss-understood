# Native Photo & Thought Posting Feature

## ✨ Overview

Dragverse now has a beautiful, girly native posting system for sharing photos, GIFs, and thoughts with storytelling-focused UX. The feature is **fully deployed and functional** after running the SQL schema.

## 🎨 Features

### Post Composer
- **Welcoming UI**: "What's your story, babe?" - inclusive, warm messaging
- **Mood Picker**: 8 vibes to express yourself
  - ✨ Sparkling
  - 💖 Soft
  - 🔥 Fierce
  - 🎭 Dramatic
  - 🌈 Playful
  - 👑 Regal
  - 💅 Slay
  - 🦄 Magical
- **Media Upload**: Up to 4 photos or GIFs per post
- **Character Limit**: 500 characters for thoughtful storytelling
- **Beautiful Design**: Gradient backgrounds, sparkle effects, smooth animations

### Post Display
- **Mood-Based Styling**: Each post reflects its vibe with gradient backgrounds
- **Image Grids**: Smart layouts for 1-4 photos
- **Hover Effects**: Sparkle overlays and zoom on images
- **Engagement**: Like, comment, and share buttons
- **Creator Linking**: Click avatar/name to visit profile

### Privacy & Features
- ✅ Public, unlisted, private, and followers-only visibility
- ✅ Hashtag support (schema ready)
- ✅ Location tagging (schema ready)
- ✅ Scheduled posts (schema ready)
- ✅ Threaded comments (schema ready)
- ✅ Likes and reposts tracking
- ✅ Row Level Security (RLS) policies

## 📍 Where to Find It

### Feed Page (`/feed`)
- Click "Share Your Story" button to open composer
- See native Dragverse posts mixed with Bluesky content
- Posts appear immediately after creation

### Components
- **Post Composer**: `src/components/posts/post-composer.tsx`
- **Post Card**: `src/components/posts/post-card.tsx`

### API Endpoints
- `POST /api/posts/create` - Create new post
- `GET /api/posts/feed` - Fetch posts feed

## 🎯 Design Philosophy

**Girly but Inclusive**
- Explicitly welcomes all drag performers (Queens, Kings, everyone)
- Warm, encouraging copy
- Beautiful purple/pink gradients
- Sparkle effects throughout
- Professional yet playful

**Storytelling First**
- Focus on sharing moments, feelings, and stories
- Not just "post" - it's "share your story"
- Mood system helps express the vibe
- Character limit encourages thoughtful content

## 🗄️ Database Tables

All tables created successfully:
- ✅ `posts` - Main posts table with media support
- ✅ `post_comments` - Comments with threading
- ✅ `post_likes` - Like tracking
- ✅ `post_reposts` - Repost/share tracking

## 🚀 Usage

### Creating a Post

1. Go to `/feed`
2. Click "Share Your Story" (must be authenticated)
3. Write your story (optional)
4. Add photos/GIFs (optional, up to 4)
5. Pick a mood (optional)
6. Click "Post Your Story"

### Viewing Posts

- Native Dragverse posts appear in the feed
- Mixed seamlessly with Bluesky content
- Click on creator to see their profile
- Like, comment, or share any post

## 🎨 Mood System

Each mood has a unique gradient and emoji:

| Mood | Emoji | Use Case |
|------|-------|----------|
| Sparkling | ✨ | Exciting moments, achievements |
| Soft | 💖 | Tender, sweet, loving |
| Fierce | 🔥 | Confident, powerful, bold |
| Dramatic | 🎭 | Theatrical, big energy |
| Playful | 🌈 | Fun, lighthearted, silly |
| Regal | 👑 | Elegant, sophisticated |
| Slay | 💅 | Serving looks, confidence |
| Magical | 🦄 | Dreamy, fantastical |

## 📱 Mobile Responsive

- Composer works beautifully on mobile
- Image grid adapts to screen size
- Touch-friendly interactions
- Optimized for all devices

## 🔒 Security

- JWT authentication via Privy
- Row Level Security (RLS) policies
- Users can only edit/delete their own posts
- Media upload requires authentication
- Public posts viewable by all

## 🎉 Status

**✅ LIVE AND FUNCTIONAL**

All components deployed, database schema applied, and feature is ready for users to start sharing their stories!

---

Built with love for the Dragverse community 💖✨

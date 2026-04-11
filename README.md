# 🎭 Dragverse

**Where Drag Comes to Play** - A decentralized video streaming platform built for drag artists and their communities.

## ✨ Features

### 🎥 Video Streaming
- **Snapshots (Dragverse TV)**: Auto-playing broadcast of vertical (9:16) and 4:5 short-form content
- **Long-form content**: Horizontal videos from 1 to 60 minutes
- **Livepeer-powered**: High-quality video transcoding and HLS streaming
- **Audio uploads**: Podcasts and music via Supabase Storage
- **Multi-bitrate support**: Adaptive streaming for all devices (720p, 480p, 360p)

### 📡 Livestreaming
- **Creator livestreams**: Any creator can start their own stream with OBS/Streamyard
- **Official Dragverse stream**: Featured on homepage with real-time status detection
- **RTMP ingest**: Professional streaming setup with stream keys
- **Live status detection**: Backend API checks stream status every 30 seconds

### 💰 Monetization
- **Crypto tipping**: ETH and USDC tips on Base Network
- **Fiat payments**: Stripe integration (coming soon)
- **Creator dashboard**: Track earnings, views, likes, and engagement
- **Direct transfers**: No middleman - tips go directly to creators

### 🔐 Authentication
- **Privy Auth**: Email, Google, and Farcaster login
- **Web3 wallets**: MetaMask, WalletConnect, Coinbase Wallet
- **Decentralized identity**: DID-based user profiles

### 📊 Creator Tools
- **Dashboard**: Analytics, earnings, and content management
- **Upload validation**: Automatic duration and file size checks
- **Video management**: Edit metadata, view stats, delete content
- **Earnings tracking**: Combined crypto + fiat revenue display

### 🌐 Social Features
- **Hall of Fame**: Top creators leaderboard
- **Notifications**: Real-time alerts for tips, likes, comments, follows
- **Follow system**: Build your audience
- **Comments & likes**: Engage with content
- **Profile sharing**: Share profiles to Threads, Bluesky, Farcaster, Lens, Twitter/X, WhatsApp
- **Feed**: Aggregated content from Dragverse creators, YouTube, and Bluesky

### 🎨 UI/UX
- **Dark theme**: Purple gradient brand colors (#EB83EA, #7c3aed)
- **Responsive design**: Mobile-first, works on all devices
- **Smooth animations**: Polished transitions and interactions
- **Hero slider**: Featured content carousel on homepage

## 🏗️ Tech Stack

### Frontend
- **Next.js 16.1.2**: App Router, React Server Components, Turbopack
- **React 19**: Latest features and performance improvements
- **TypeScript**: Full type safety
- **Tailwind CSS**: Utility-first styling
- **React Hot Toast**: Beautiful notifications

### Video & Media Infrastructure
- **Livepeer Studio**: Video transcoding, streaming, and livestream management
- **Supabase Storage**: Audio file hosting (podcasts, music)
- **HLS streaming**: HTTP Live Streaming protocol
- **TUS protocol**: Resumable video uploads

### Authentication & Identity
- **Privy**: Authentication provider (email, social, wallet)
- **Ceramic Network**: Decentralized data storage (configured but not yet deployed)
- **ComposeDB**: GraphQL schemas for user data

### Blockchain
- **Base Network**: Layer 2 Ethereum (low fees, fast transactions)
- **Wagmi**: React hooks for Ethereum (integration ready)
- **Viem**: TypeScript Ethereum library

### Database & Backend
- **Supabase**: PostgreSQL database with Row Level Security
- **YouTube RSS**: Curated drag content aggregation (music playlists)

### Future Integrations
- **Stripe**: Fiat payment processing
- **Lens Protocol**: Social media cross-posting
- **Ghost/Substack**: Creator blogging

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- A Livepeer Studio API key ([get one here](https://livepeer.studio))
- A Privy App ID ([sign up here](https://privy.io))

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/dragverse-salti.git
cd dragverse-salti
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API keys:
```env
# Authentication (PUBLIC)
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id

# Livepeer (PRIVATE - server-only)
LIVEPEER_API_KEY=your_livepeer_api_key

# Ceramic (PRIVATE - optional for now)
CERAMIC_URL=https://ceramic-clay.3boxlabs.com
CERAMIC_ADMIN_SEED=your_ceramic_seed
```

4. **Run the development server**
```bash
npm run dev
```

5. **Open your browser**
Navigate to [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
dragverse-salti/
├── src/
│   ├── app/
│   │   ├── (platform)/          # Authenticated routes
│   │   │   ├── dashboard/       # Creator dashboard
│   │   │   ├── live/            # Livestream creation
│   │   │   ├── notifications/   # Notification center
│   │   │   ├── upload/          # Video upload
│   │   │   ├── watch/[id]/      # Video player
│   │   │   └── ...
│   │   └── api/                 # Backend API routes
│   │       ├── stream/          # Livestream APIs
│   │       ├── tips/            # Tipping APIs
│   │       ├── upload/          # Upload APIs
│   │       └── video/           # Video metadata APIs
│   ├── components/
│   │   ├── home/                # Homepage components
│   │   ├── layout/              # Navigation, sidebar
│   │   ├── video/               # Video player, tip modal
│   │   └── dashboard/           # Dashboard components
│   ├── lib/
│   │   ├── ceramic/             # Ceramic/ComposeDB schemas
│   │   ├── livepeer/            # Livepeer utilities
│   │   ├── privy/               # Auth hooks
│   │   └── store/               # State management
│   └── styles/
│       └── globals.css          # Global styles
├── composites/                  # Ceramic GraphQL schemas
├── public/                      # Static assets
└── scripts/
    └── setup-ceramic.sh         # Ceramic deployment script
```

## 🔑 Environment Variables

### Public Variables (Client-side)
These are prefixed with `NEXT_PUBLIC_` and are visible to the browser:

- `NEXT_PUBLIC_PRIVY_APP_ID`: Your Privy application ID

### Private Variables (Server-only)
These are NOT prefixed and only available server-side:

- `LIVEPEER_API_KEY`: Livepeer Studio API key
- `CERAMIC_URL`: Ceramic network endpoint (optional)
- `CERAMIC_ADMIN_SEED`: Ceramic admin seed (optional)

**⚠️ Security Note**: Never add `NEXT_PUBLIC_` prefix to sensitive API keys!

## 📝 Development Commands

```bash
# Development
npm run dev              # Start dev server with Turbopack
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint

# Ceramic (when ready)
npm run ceramic:setup    # Deploy Ceramic schemas
```

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License

## 🙏 Acknowledgments

- **Livepeer**: Video infrastructure and livestreaming
- **Privy**: Authentication and wallet management
- **Ceramic Network**: Decentralized data storage
- **Next.js**: Framework and tooling

---

**Built with ❤️ by the Dragverse team**

*Where Drag Comes to Play* 🎭✨

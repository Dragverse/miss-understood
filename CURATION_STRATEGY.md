# Dragverse Content Curation Strategy
## Becoming the Best Drag Content Curator on the Internet

**Goal**: Make Dragverse the go-to destination for discovering the best drag content across all platforms.

---

## Current Strengths

1. **Multi-Platform Aggregation**
   - Dragverse native uploads
   - Bluesky posts (24 curated accounts)
   - YouTube videos (search-based discovery)

2. **Smart Filtering**
   - Video vs. photo post separation
   - Shorts vs. long-form categorization
   - Engagement-based sorting

3. **Real-time Updates**
   - Live feed updates
   - Parallel content fetching

---

## Key Improvements Needed

### 1. Content Quality Scoring System

**Problem**: Currently showing all content equally, regardless of quality or relevance.

**Solution**: Implement a multi-factor quality score:

```typescript
interface ContentQualityScore {
  engagement: number;      // 0-100 (likes, comments, shares)
  recency: number;         // 0-100 (time decay)
  creatorReputation: number; // 0-100 (follower count, verified status)
  contentRelevance: number;  // 0-100 (drag-related keywords, hashtags)
  overallScore: number;    // weighted average
}
```

**Weights**:
- Engagement: 40%
- Recency: 25%
- Creator Reputation: 20%
- Content Relevance: 15%

### 2. Advanced Content Filtering

**Current Issues**:
- User mentioned "Queer art brings too much nudity"
- No age-appropriate filtering
- No content type preferences

**Solutions**:
- **Safe Mode Toggle**: Filter mature content
- **Content Type Preferences**: Performance, Tutorial, Comedy, Fashion, etc.
- **Creator Preferences**: Follow/mute specific creators
- **Language Filtering**: Detect and filter by language

### 3. Personalized Recommendations

**Current**: Everyone sees the same content
**Needed**: Personalized feed based on:

- Watch history
- Liked content
- Followed creators
- Interaction patterns
- Time of day preferences

### 4. Trending Topics Detection

**Why**: Surface what's hot in the drag community right now

**Implementation**:
- Track hashtag frequency over time
- Identify viral moments (sudden engagement spikes)
- Cross-reference across platforms
- Show "Trending Now" section

### 5. Content Diversity Algorithm

**Goal**: Show variety in the feed

**Rules**:
- No more than 2 videos from same creator in top 20
- Mix content types (shorts, long-form, photos)
- Mix platforms (Dragverse, Bluesky, YouTube)
- Mix categories (performance, tutorial, comedy, etc.)

### 6. Smart Deduplication

**Problem**: Same content appears across platforms

**Solution**:
- Video title similarity detection (>80% match)
- Thumbnail comparison (perceptual hashing)
- Cross-platform video ID tracking
- Prefer native Dragverse uploads over external

---

## Implementation Plan

### Phase 1: Content Quality Scoring (Priority: HIGH)

**Files to Create**:
```
src/lib/curation/quality-score.ts
src/lib/curation/engagement-metrics.ts
src/lib/curation/content-relevance.ts
```

**Key Functions**:
```typescript
calculateQualityScore(content: Video | Post): ContentQualityScore
rankContentByQuality(items: (Video | Post)[]): (Video | Post)[]
```

### Phase 2: Content Filtering System (Priority: HIGH)

**Files to Create**:
```
src/lib/curation/content-filter.ts
src/lib/curation/safe-mode.ts
```

**Features**:
- Mature content detection (keywords, age ratings)
- YouTube SafeSearch integration
- Bluesky content warnings support
- User preference storage

### Phase 3: Trending Detection (Priority: MEDIUM)

**Files to Create**:
```
src/lib/curation/trending.ts
src/lib/curation/hashtag-tracker.ts
```

**Database Tables Needed**:
```sql
CREATE TABLE trending_topics (
  id UUID PRIMARY KEY,
  hashtag TEXT NOT NULL,
  mention_count INTEGER DEFAULT 0,
  engagement_score FLOAT DEFAULT 0,
  time_bucket TIMESTAMPTZ NOT NULL,
  platforms TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trending_topics_time ON trending_topics(time_bucket DESC, engagement_score DESC);
```

### Phase 4: Personalization Engine (Priority: MEDIUM)

**Files to Create**:
```
src/lib/curation/personalization.ts
src/lib/curation/user-preferences.ts
src/lib/curation/recommendation-engine.ts
```

**Database Tables Needed**:
```sql
CREATE TABLE user_interactions (
  id UUID PRIMARY KEY,
  user_did TEXT NOT NULL,
  content_id TEXT NOT NULL,
  interaction_type TEXT NOT NULL, -- 'view', 'like', 'share', 'comment'
  duration_seconds INTEGER, -- for video views
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_interactions_user ON user_interactions(user_did, created_at DESC);
CREATE INDEX idx_user_interactions_content ON user_interactions(content_id);
```

### Phase 5: Diversity Algorithm (Priority: LOW)

**Files to Create**:
```
src/lib/curation/diversity.ts
```

**Key Function**:
```typescript
diversifyFeed(content: (Video | Post)[], rules: DiversityRules): (Video | Post)[]
```

---

## Content Sources Optimization

### Bluesky Expansion

**Current**: 24 accounts
**Needed**: More comprehensive coverage

**Add**:
- International drag performers
- Regional drag scenes (NYC, LA, London, etc.)
- Emerging performers
- Drag adjacent content (makeup artists, fashion designers)

**Potential Accounts to Add**:
```typescript
// International Stars
"pangina.bsky.social", // Pangina Heals (Thailand)
"nicky.doll.bsky.social", // Nicky Doll (France)
"carmen.farala.bsky.social", // Carmen Farala (Spain)
"envy.peru.bsky.social", // Envy Peru (Netherlands)

// Makeup Artists & Fashion
"kimchi.bsky.social", // Kim Chi (already added)
"aquaria.bsky.social", // Aquaria (already added)
"sasha.velour.bsky.social", // Sasha Velour

// Drag Kings
"landonlegit.bsky.social", // Already added
"adam.all.bsky.social", // Need to verify handle

// Comedy & Performance
"biancadelrio.bsky.social", // Bianca Del Rio
"katya.bsky.social", // Already added
"trixie.bsky.social", // Already added
```

### YouTube Search Optimization

**Current Queries**:
```typescript
"drag queen performance"
"drag race"
"drag makeup tutorial"
"drag show"
"rupaul drag race"
"drag transformation"
"drag lip sync"
"drag artist"
```

**Add More Specific Queries**:
```typescript
// Event-specific
"drag brunch"
"drag bingo"
"drag story time"

// Style-specific
"camp drag"
"pageant drag"
"club kid drag"
"alternative drag"

// Educational
"drag history"
"drag culture"
"drag documentary"

// Competitions
"dragula"
"drag race all stars"
"drag race uk"
"drag race philippines"
```

### Content Quality Filters for YouTube

**Add to YouTube client**:
```typescript
// Filter out low-quality content
const MIN_VIDEO_QUALITY = {
  minViews: 1000,        // Minimum view count
  minLikes: 50,          // Minimum likes
  minDuration: 30,       // Minimum 30 seconds
  maxDuration: 3600,     // Maximum 1 hour (for shorts/performances)
  channelMinSubscribers: 100, // Verified channels only
};
```

---

## User Experience Enhancements

### 1. Smart Feed Tabs

**Homepage should have**:
- **For You**: Personalized recommendations
- **Following**: Content from followed creators only
- **Trending**: Hot content right now
- **Fresh**: Newest uploads first
- **Top**: Best content this week/month

### 2. Content Discovery Features

- **Similar Videos**: "More like this" recommendation
- **Creator Spotlight**: Rotating featured creator section
- **Weekly Picks**: Curated by Dragverse team
- **Community Favorites**: Most saved/shared content

### 3. Advanced Search

**Current**: Basic keyword search
**Needed**:
- Filter by content type (shorts, long, podcast)
- Filter by category (performance, tutorial, comedy)
- Filter by platform (Dragverse, Bluesky, YouTube)
- Filter by date range
- Sort options (relevance, views, recent, trending)

### 4. Collections & Playlists

- User-created playlists
- Official Dragverse collections ("Best Lip Syncs", "Makeup Masterclasses")
- Auto-generated collections ("Trending This Week", "New Creators")

---

## Performance Optimizations

### 1. Caching Strategy

**Current**: No caching
**Needed**:

```typescript
// Cache YouTube results (5 min TTL)
const YOUTUBE_CACHE_TTL = 5 * 60 * 1000;

// Cache Bluesky results (2 min TTL - more dynamic)
const BLUESKY_CACHE_TTL = 2 * 60 * 1000;

// Cache trending topics (10 min TTL)
const TRENDING_CACHE_TTL = 10 * 60 * 1000;
```

**Implementation**:
- Use Redis for server-side caching
- Use localStorage for client-side caching
- Implement stale-while-revalidate pattern

### 2. Lazy Loading

**Current**: Loads all content upfront
**Needed**:
- Infinite scroll with pagination
- Load 20 items initially
- Fetch more as user scrolls
- Preload next batch in background

### 3. Image Optimization

**Issues**:
- Large thumbnail sizes
- No progressive loading
- No WebP format

**Solutions**:
- Use Next.js Image component everywhere
- Convert to WebP with fallback
- Implement blur placeholders
- Lazy load offscreen images

---

## Content Moderation

### Automated Moderation

**Implement**:
1. **Text Moderation**: Filter harmful content in titles/descriptions
2. **Image Moderation**: Detect inappropriate thumbnails
3. **Spam Detection**: Identify low-quality spam content
4. **Copyright Detection**: YouTube Content ID integration

### User-Driven Moderation

**Add**:
- Report content button
- Block creator option
- Flag inappropriate content
- Community voting (upvote/downvote)

### Manual Review Queue

**For Dragverse Team**:
- Flagged content review dashboard
- Approve/reject new creators
- Curate featured content
- Verify creator accounts

---

## Analytics & Insights

### Track Key Metrics

```typescript
interface CurationMetrics {
  // Content Performance
  avgEngagementRate: number;
  topPerformingContentTypes: string[];
  contentSourceDistribution: { dragverse: number; bluesky: number; youtube: number };

  // User Engagement
  avgSessionDuration: number;
  contentDiscoveryRate: number; // % of users finding new creators
  returnUserRate: number;

  // Quality Indicators
  avgQualityScore: number;
  contentDiversityScore: number;
  trendingTopicsCoverage: number;
}
```

### Creator Insights

**Provide to creators**:
- Views over time
- Audience demographics
- Top performing content
- Engagement rates
- Follower growth

---

## Success Metrics

### How We'll Measure "Best Curator"

1. **Content Quality**: Average quality score > 75/100
2. **Content Diversity**:
   - At least 3 different platforms in top 20
   - At least 4 content types in top 20
   - Max 2 videos per creator in top 20
3. **User Engagement**:
   - Average session > 10 minutes
   - Scroll depth > 50% of feed
   - Return rate > 60% within 7 days
4. **Discovery**:
   - Users discover 5+ new creators per session
   - Click-through rate > 15% on recommendations
5. **Content Freshness**:
   - 50% of homepage content < 24 hours old
   - 25% of content < 6 hours old

---

## Competitive Analysis

### What Others Do Well

**TikTok**:
- Excellent recommendation algorithm
- Quick content consumption
- Seamless vertical scrolling

**YouTube**:
- Deep content library
- Creator monetization
- Sophisticated search

**Instagram**:
- Visual-first discovery
- Stories & Reels integration
- Creator tools

### Dragverse Unique Value

**What Makes Us Different**:
1. **Drag-First**: Everything optimized for drag content
2. **Multi-Platform**: Aggregate the entire drag internet
3. **Creator-Owned**: Web3 ownership for creators
4. **Community-Driven**: By drag fans, for drag fans
5. **Quality Over Quantity**: Curated, not just aggregated

---

## Implementation Timeline

### Week 1: Foundation
- ✅ YouTube search-based discovery (DONE)
- ✅ Expanded Bluesky accounts (DONE)
- ⏳ Content quality scoring system
- ⏳ Basic content filtering

### Week 2: Discovery
- Trending topics detection
- Smart deduplication
- Content diversity algorithm
- "For You" feed tab

### Week 3: Personalization
- User interaction tracking
- Basic recommendation engine
- Follow/mute creators
- Content preferences

### Week 4: Polish
- Performance optimizations
- Caching layer
- Lazy loading
- Image optimization

---

## Next Immediate Actions

1. **Create quality scoring system** - Rank content by engagement, recency, relevance
2. **Implement content filtering** - Safe mode, content type preferences
3. **Add trending detection** - Show what's hot right now
4. **Optimize Bluesky/YouTube queries** - More comprehensive coverage
5. **Build "For You" feed** - Personalized recommendations

**Priority Focus**: Quality scoring + content filtering (addresses user's nudity concern while improving overall curation)

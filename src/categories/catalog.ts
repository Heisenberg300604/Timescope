/**
 * Default categories and the seed domain -> category mapping.
 *
 * These are ORGANIZATIONAL LABELS ONLY. TimeScope never ranks a category as
 * productive, wasteful, good or bad; the product shows data and lets the user
 * draw their own conclusions.
 *
 * The catalog is a plain data table so a future version can let users add,
 * rename and reassign categories without touching tracking logic. User edits
 * live in `Settings.categories` / `Settings.domainCategories` and take
 * precedence over everything here (see `resolver.ts`).
 */

import type { Category, CategoryId } from '../types';
import { NEUTRAL_SLOT } from './palette';

/** Category assigned to any domain with no mapping. Cannot be deleted. */
export const FALLBACK_CATEGORY_ID: CategoryId = 'other';

/**
 * `colorIndex` points into the category palette. Order here is the default
 * display order for legends and lists.
 */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'development', label: 'Development', colorIndex: 0 },
  { id: 'work', label: 'Work', colorIndex: 1 },
  { id: 'learning', label: 'Learning', colorIndex: 2 },
  { id: 'ai', label: 'AI', colorIndex: 3 },
  { id: 'news', label: 'News', colorIndex: 4 },
  { id: 'social', label: 'Social', colorIndex: 5 },
  { id: 'entertainment', label: 'Entertainment', colorIndex: 6 },
  { id: 'shopping', label: 'Shopping', colorIndex: 7 },
  { id: FALLBACK_CATEGORY_ID, label: 'Other', colorIndex: NEUTRAL_SLOT, isFallback: true },
];

/**
 * Seed mappings. Intentionally a modest, high-confidence list: a wrong guess is
 * worse than an honest `Other`, and users can reassign any domain in Settings.
 */
export const DEFAULT_DOMAIN_CATEGORIES: Record<string, CategoryId> = {
  // Development
  'github.com': 'development',
  'gitlab.com': 'development',
  'bitbucket.org': 'development',
  'stackoverflow.com': 'development',
  'npmjs.com': 'development',
  'developer.mozilla.org': 'development',
  'codepen.io': 'development',
  'codesandbox.io': 'development',
  'vercel.com': 'development',
  'netlify.com': 'development',
  'console.aws.amazon.com': 'development',
  'pypi.org': 'development',
  'crates.io': 'development',
  'huggingface.co': 'development',

  // Work
  'mail.google.com': 'work',
  'calendar.google.com': 'work',
  'drive.google.com': 'work',
  'docs.google.com': 'work',
  'sheets.google.com': 'work',
  'slack.com': 'work',
  'app.slack.com': 'work',
  'zoom.us': 'work',
  'teams.microsoft.com': 'work',
  'outlook.office.com': 'work',
  'outlook.live.com': 'work',
  'atlassian.net': 'work',
  'jira.com': 'work',
  'meet.google.com': 'work',

  // Learning
  'medium.com': 'learning',
  'coursera.org': 'learning',
  'udemy.com': 'learning',
  'freecodecamp.org': 'learning',
  'leetcode.com': 'learning',
  'khanacademy.org': 'learning',
  'edx.org': 'learning',
  'arxiv.org': 'learning',
  'wikipedia.org': 'learning',
  'en.wikipedia.org': 'learning',
  'substack.com': 'learning',

  // AI
  'chatgpt.com': 'ai',
  'chat.openai.com': 'ai',
  'claude.ai': 'ai',
  'gemini.google.com': 'ai',
  'perplexity.ai': 'ai',
  'copilot.microsoft.com': 'ai',
  'midjourney.com': 'ai',

  // Tools that support work rather than a category of their own
  'notion.so': 'work',
  'www.notion.so': 'work',
  'linear.app': 'work',
  'todoist.com': 'work',
  'trello.com': 'work',
  'asana.com': 'work',
  'figma.com': 'work',
  'obsidian.md': 'work',

  // News
  'news.ycombinator.com': 'news',
  'bbc.com': 'news',
  'nytimes.com': 'news',
  'theguardian.com': 'news',
  'techcrunch.com': 'news',
  'theverge.com': 'news',
  'arstechnica.com': 'news',
  'bloomberg.com': 'news',

  // Social
  'reddit.com': 'social',
  'x.com': 'social',
  'twitter.com': 'social',
  'instagram.com': 'social',
  'facebook.com': 'social',
  'linkedin.com': 'social',
  'threads.net': 'social',
  'bsky.app': 'social',
  'discord.com': 'social',
  'whatsapp.com': 'social',
  'web.whatsapp.com': 'social',
  'tiktok.com': 'social',

  // Entertainment
  'youtube.com': 'entertainment',
  'netflix.com': 'entertainment',
  'twitch.tv': 'entertainment',
  'spotify.com': 'entertainment',
  'open.spotify.com': 'entertainment',
  'primevideo.com': 'entertainment',
  'hulu.com': 'entertainment',
  'disneyplus.com': 'entertainment',
  'soundcloud.com': 'entertainment',
  'imdb.com': 'entertainment',

  // Shopping
  'amazon.com': 'shopping',
  'ebay.com': 'shopping',
  'etsy.com': 'shopping',
  'aliexpress.com': 'shopping',
  'flipkart.com': 'shopping',
  'walmart.com': 'shopping',
};

/**
 * Correct brand casing for well-known sites. Purely cosmetic - anything not
 * listed falls back to `fallbackDisplayName()`.
 */
export const BRAND_NAMES: Record<string, string> = {
  'github.com': 'GitHub',
  'gitlab.com': 'GitLab',
  'youtube.com': 'YouTube',
  'chatgpt.com': 'ChatGPT',
  'chat.openai.com': 'ChatGPT',
  'claude.ai': 'Claude',
  'stackoverflow.com': 'Stack Overflow',
  'news.ycombinator.com': 'Hacker News',
  'linkedin.com': 'LinkedIn',
  'x.com': 'X',
  'tiktok.com': 'TikTok',
  'npmjs.com': 'npm',
  'developer.mozilla.org': 'MDN',
  'freecodecamp.org': 'freeCodeCamp',
  'leetcode.com': 'LeetCode',
  'codepen.io': 'CodePen',
  'codesandbox.io': 'CodeSandbox',
  'nytimes.com': 'The New York Times',
  'theguardian.com': 'The Guardian',
  'techcrunch.com': 'TechCrunch',
  'theverge.com': 'The Verge',
  'arstechnica.com': 'Ars Technica',
  'bbc.com': 'BBC',
  'imdb.com': 'IMDb',
  'ebay.com': 'eBay',
  'aliexpress.com': 'AliExpress',
  'mail.google.com': 'Gmail',
  'calendar.google.com': 'Google Calendar',
  'drive.google.com': 'Google Drive',
  'docs.google.com': 'Google Docs',
  'meet.google.com': 'Google Meet',
  'gemini.google.com': 'Gemini',
  'en.wikipedia.org': 'Wikipedia',
  'wikipedia.org': 'Wikipedia',
  'web.whatsapp.com': 'WhatsApp',
  'open.spotify.com': 'Spotify',
  'app.slack.com': 'Slack',
  'teams.microsoft.com': 'Microsoft Teams',
  'copilot.microsoft.com': 'Copilot',
  'bsky.app': 'Bluesky',
};

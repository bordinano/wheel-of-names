# Spin Studio

A modern, minimalist Wheel of Names-inspired app built with Next.js, React, TypeScript, Tailwind CSS, and Lucide icons.

## Features
- Animated spinning wheel
- Add and remove entries, plus bulk add by lines or commas
- Schedule a predetermined entry for a specific spin number
- Random results for all non-scheduled spins
- Spin history with CSV export
- Optional remove-winner-after-spin behavior
- Optional sound cue
- Responsive layout

## Run locally
Requirements: Node.js 20.9+ and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Important behavior
The prize scheduler is intentionally an author-controlled feature: a scheduled spin picks the configured entry; other spins are random. If used in a public contest, disclose scheduled outcomes to participants. This starter stores data in React state only; refreshing the page resets the session. Persistence, shareable wheel URLs, and server-side access control are not included yet.

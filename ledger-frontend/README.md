This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# blacklane ledger — sign-in design reference

## Color palette

| Token | Hex | Used for |
|---|---|---|
| Background | `#0B120D` | Page background (near-black, green-tinted) |
| Surface | `#161F19` | Input field fill |
| Surface border | `#232E27` | Input field border |
| Text primary | `#F4F2EC` | Headings, body text, input text |
| Text muted | `#8B958C` | Labels, subtext, icons |
| Text faint | `#5C665F` | Placeholder text, footer credit |
| Accent (gold) | `#D9A441` | CTA button fill, logo full stop |
| Error text | `#E08A6E` | Error message text |
| Error background | `rgba(166, 71, 46, 0.12)` | Error message background |

CTA button text sits on the gold accent using the background color (`#0B120D`), not white — keeps contrast high without introducing a new tone.

## Logo

Wordmark-only, no icon mark, no header bar.

- **Primary line:** `blacklane` — lowercase, semibold, tight tracking, color `#F4F2EC`, followed by a full stop in the accent gold (`#D9A441`). The full stop stands in for a decimal point, tying the mark to a ledger/accounting context.
- **Subline:** `ledger` — small (12px), muted (`#8B958C`), sits directly under the wordmark.
- **Placement:** centered, standalone, above the "Sign in" heading — not inside a header/nav row.
- **Footer credit:** `Powered by blacklane` — centered, faint (`#5C665F`), at the bottom of the form.

```
blacklane.
  ledger
```
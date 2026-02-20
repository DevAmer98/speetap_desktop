# TapDeck Desktop

## Environment
Create `renderer/.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_API_BASE_URL=https://your-speetab-vercel-domain
```

`NEXT_PUBLIC_API_BASE_URL` should point to the Vercel project that hosts the `/api/trial` and `/api/users` endpoints.

## Development
```
npm install
npm run dev
```
# speetap_desktop

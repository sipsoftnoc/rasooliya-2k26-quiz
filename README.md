# റസൂലിയ 2K26 — Online Live Quiz

**നൂറുൽ ഇസ്ലാം മദ്രസ്സ, പാലപ്പള്ളി**

Netlify-ൽ deploy ചെയ്യാൻ തയ്യാറാക്കിയ web application ആണ് ഇത്.

## Pages

- `index.html` — Participant registration + live question/answer page
- `admin.html` — Admin control panel
- `screen.html` — Projector / live screen / scoreboard

## പ്രധാന Features

- പേര് + മൊബൈൽ നമ്പർ ഉപയോഗിച്ച് participant registration
- Admin-ന് questions add/delete ചെയ്യാം
- Question-ന് image ചേർക്കാം
- Options ഇല്ല; participant type ചെയ്ത് answer submit ചെയ്യും
- ഓരോ question-നും 3 minutes
- Screen-ൽ seconds countdown
- First submitted answer-ന് priority (server timestamp)
- Admin manually answer confirm ചെയ്യാം
- Correct / wrong marking + points
- Live scoreboard
- Top 5 scores വലിയ card-ുകളായി വ്യത്യസ്ത നിറങ്ങളിൽ
- Background ആയി നൽകിയ Rasooliya 2K26 poster image
- Netlify Blobs ഉപയോഗിച്ച് persistent data — വേറെ database setup ആവശ്യമില്ല

## Netlify Setup

1. ഈ ZIP extract ചെയ്യുക.
2. Netlify-ൽ **Add new project → Deploy manually** ഉപയോഗിച്ച് folder/ZIP upload ചെയ്യുക.
3. Site deploy ചെയ്ത ശേഷം **Project configuration → Environment variables** ൽ:
   - `ADMIN_PASSWORD` = നിങ്ങളുടെ admin password
4. Site-ൽ `/admin.html` തുറന്ന് admin login ചെയ്യുക.
5. Participant page: `/`
6. Live screen: `/screen.html`

> Netlify Blobs site-wide store ഉപയോഗിക്കുന്നതിനാൽ production deploy-ൽ data persistent ആയിരിക്കും.

## Local testing

```bash
npm install
npx netlify dev
```

അപ്പോൾ സാധാരണയായി:
- Participant: `http://localhost:8888/`
- Admin: `http://localhost:8888/admin.html`
- Screen: `http://localhost:8888/screen.html`

## ശ്രദ്ധിക്കുക

ഈ version-ൽ question images ചെറിയ/മിതമായ വലുപ്പത്തിൽ upload ചെയ്യുന്നതാണ് നല്ലത്. Admin panel upload ചെയ്യുന്ന image server-side Blob storage-ൽ question data-യോടൊപ്പം സൂക്ഷിക്കും.

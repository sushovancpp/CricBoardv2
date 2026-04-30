# 🏏 Live Cricket Scoreboard

A real-time college cricket scoreboard web app built with **Next.js 14** + **Tailwind CSS** + **Server-Sent Events** + **Redis**.

🎯 **Features:** Ball-by-ball scoring, real-time updates, admin dashboard, match history, mobile-friendly

---

## 🚀 Quick Start (5 minutes)

### Prerequisites
- Node.js 18+ ([download](https://nodejs.org))
- Free Upstash Redis account ([sign up](https://upstash.com))

### Local Development

```bash
# 1. Clone or download the project
git clone https://github.com/YOUR_USERNAME/cricket-scoreboard.git
cd cricket-score

# 2. Install dependencies
npm install

# 3. Get Redis credentials
#    → Go to https://upstash.com → Create database
#    → Copy REST API URL and Token

# 4. Create .env.local
cp .env.example .env.local

# 5. Edit .env.local and add your Redis credentials:
#    UPSTASH_REDIS_REST_URL=https://eu2-xxx.upstash.io
#    UPSTASH_REDIS_REST_TOKEN=AXc...

# 6. Start dev server
npm run dev

# 7. Open in browser
#    http://localhost:3000         ← Public scoreboard
#    http://localhost:3000/admin   ← Admin panel
#    Password: cricket@123 (or set ADMIN_PASSWORD in .env.local)
```

---

## 📱 Usage Guide

### Public Scoreboard (`/`)
- 📊 Live score display
- ⚡ Real-time updates (via SSE)
- 🏃 Current batsmen stats
- 🎯 Bowler figures
- 👤 **Admin button** in header for quick access

### Admin Dashboard (`/admin`)
1. **Login** with password
2. **Create Match** → Enter team names, overs, toss info
3. **Ball-by-ball scoring:**
   - Click `0 1 2 3 4 6` for runs
   - Click `W` for wicket (modal opens for new batsman)
   - Click `Wd/NB/B/LB` for extras
4. **Edit players** → Tap batsman/bowler cards to rename or adjust stats
5. **Swap strike** → Manual strike rotation
6. **Undo** → Revert last 5 balls
7. **Start 2nd Innings** → After 1st innings completes
8. **End Match** → Calculate and display result

---

## 🏗️ Project Structure

```
cricket-score/
├── app/
│   ├── page.jsx                ← Public scoreboard (live SSE)
│   ├── admin/page.jsx          ← Login page
│   ├── admin/dashboard/page.jsx ← Scorer control panel
│   └── api/
│       ├── score/route.js      ← GET current match
│       ├── stream/route.js     ← SSE endpoint (real-time)
│       ├── auth/route.js       ← Login verification
│       ├── match/route.js      ← Create/status match
│       ├── ball/route.js       ← Score a ball
│       ├── swap/route.js       ← Swap batsmen
│       ├── players/route.js    ← Edit names/stats
│       └── undo/route.js       ← Revert last ball
├── lib/
│   └── store.js                ← Redis operations + ball engine
├── .env.example                ← Environment variables template
├── .gitignore                  ← Git ignore rules
├── DEPLOYMENT.md               ← Troubleshooting guide ⭐
├── GIT_WORKFLOW.md            ← Git commit guide
└── README.md                   ← This file
```

**Storage:** Redis (Upstash) for persistence. Data survives server restarts.

---

## 🔐 Configuration

### Environment Variables

Create `.env.local` (copy from `.env.example`):

```
# Admin password for dashboard
ADMIN_PASSWORD=your_secure_password

# Redis credentials (from Upstash)
UPSTASH_REDIS_REST_URL=https://eu2-xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXc...
```

**Never commit `.env.local`** — it's in `.gitignore` ✓

---

## ⚠️ Troubleshooting

### Getting "Server Error" on deployment?

→ **See [DEPLOYMENT.md](./DEPLOYMENT.md)** for detailed fixes

### Common Issues:

| Issue | Solution |
|-------|----------|
| "UPSTASH_REDIS_REST_URL not set" | Add env vars to your host (Vercel/Railway/etc) |
| Data disappearing | Check Redis credentials are correct |
| Admin button not showing | Refresh page (F5), clear cache (Ctrl+Shift+Del) |
| Real-time not working | Check DevTools → Network → `/api/stream` (should say "event-stream") |
| Can't login | Default password is `cricket@123`. Check if you set custom `ADMIN_PASSWORD` |

**More help?** → Open [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## 🚀 Deployment

### Deploy on Vercel (Recommended)

```bash
# 1. Push code to GitHub
git add .
git commit -m "ready for production"
git push origin main

# 2. Go to https://vercel.com → "Import Project"
# 3. Select your GitHub repository
# 4. Add 3 environment variables:
#    ADMIN_PASSWORD = your_password
#    UPSTASH_REDIS_REST_URL = your_url
#    UPSTASH_REDIS_REST_TOKEN = your_token
# 5. Click Deploy

# Now updates automatically on every git push! 🎉
```

### Deploy Elsewhere (Railway/Render/Heroku)

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed steps.

---

## 📊 Scoring Rules

- **Runs:** 0-6 clicks update score instantly
- **Dots:** Click `•` (zero runs)
- **Fours/Sixes:** Auto-track in batsman stats
- **Wickets:** Ball counted, new batsman enters as striker
- **Wides:** +1 run to extras, over not complete (6 legitimate balls = over)
- **No Balls:** +1 run to extras, over not complete
- **Byes/Leg Byes:** To extras (not to bowler), over completes at 6 legitimate balls
- **Strike rotation:** Automatic on odd runs, manual swap available
- **Undo:** Reverts last 5 balls with full state snapshot

---

## 🎯 Features

✅ Real-time SSE streaming (no polling delay)  
✅ Ball-by-ball scoring with quick buttons  
✅ Wicket management modal  
✅ Manual player edits (names, stats)  
✅ Undo last 5 balls  
✅ Swap strike manually  
✅ Current over display  
✅ Match history via Redis  
✅ Mobile-responsive design  
✅ Auto-result calculation (2nd innings)  
✅ Admin login with session token  
✅ Production-ready error handling  

---

## 🛠️ Development

### Build for production
```bash
npm run build
npm run start
```

### Check for errors
```bash
npm run lint
```

---

## 📚 Additional Guides

- **[GIT_WORKFLOW.md](./GIT_WORKFLOW.md)** — Step-by-step Git & GitHub guide
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — Troubleshooting & deployment guide

---

## 📄 License

Open source — use freely for your college/club tournaments!

---

## 🤝 Contributing

Found a bug? Want to improve scoring UI? Pull requests welcome!

```bash
git checkout -b fix/your-fix
git commit -m "fix: description"
git push origin fix/your-fix
# Then create Pull Request on GitHub
```

---

**Built with ❤️ for cricket enthusiasts**

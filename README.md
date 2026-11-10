# 📚 The Complete Shelf — 3D Editorial Virtual Library & Book Scanner

> An original Three.js continuous library experience inspired by editorial clothbound hardcovers, with client-side mobile OCR scanner and Google Sheets/Drive synchronization.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FPlangsr%2F3d-bookshelf)

---

## ✨ Features

- **Continuous 3D Shelf Experience:**
  - Fluid scrolling using drag, touch swipe, mouse wheel, position indicators, or arrow keys.
  - Oiled walnut shelving with architectural warm ambient and spotlighting.
- **19-Piece Curated Clothbound Hardcovers:**
  - Distinct book proportions, thicknesses, and rich editorial cloth hues (Navy, Burgundy, Cypress, Charcoal, Ochre).
  - Procedural gold, silver, and copper foil debossing motifs.
- **Detailed 3D Inspection Mode:**
  - Pull individual books forward into an interactive orbit, tilt, and zoom examination view.
  - Inspect front cover, back cover, and spine textures.
- **Mobile Camera Scanner & OCR Engine:**
  - Capture front, spine, and back cover photos directly from your phone.
  - Page-by-page OCR engine powered by **Tesseract.js** (supports both Thai and English) directly in the browser—no external AI billing required.
  - Customizable page typography: font size, font family (Serif, Sans, Monospace), text color, and paper tones (Cream, Parchment, Dark).
- **E-Book Reader:**
  - Clean, distraction-free reading experience modeled after cream archival paper sheets.
- **Google Sheets & Google Drive Integration:**
  - Real-time catalog storage via Google Sheets API.
  - Cover photo uploads streamed to Google Drive with automated public sharing.

---

## 🛠️ Tech Stack

- **Framework:** Next.js (App Router, TypeScript)
- **Styling:** Tailwind CSS + Google Fonts (Cinzel, Cormorant Garamond)
- **3D Graphics:** Three.js, `@react-three/fiber`, `@react-three/drei`
- **OCR Engine:** `tesseract.js` (Client-side Thai + English)
- **Storage & Database:** Google Sheets API, Google Drive API via `googleapis`
- **Deployment:** Vercel

---

## 🚀 Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/Plangsr/3d-bookshelf.git
cd 3d-bookshelf
npm install
```

### 2. Configure Environment Variables (Optional)

Create `.env.local` using the template `.env.example`:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL="your-service-account@project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID="your_google_sheet_id"
GOOGLE_DRIVE_FOLDER_ID=""
```

*(Note: If Google credentials are not supplied, the app gracefully falls back to the local curated 19-piece library and in-memory book addition).*

### 3. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.  
To test mobile scanning on your phone, open `http://<your-computer-ip>:3000` on the same Wi-Fi network.

---

## ☁️ Deploying to Vercel

1. Push your repository to GitHub.
2. Go to [Vercel](https://vercel.com) and click **Import Project**.
3. Select `3d-bookshelf`.
4. Add your Google Service Account environment variables if integrating with Google Sheets/Drive.
5. Click **Deploy**.

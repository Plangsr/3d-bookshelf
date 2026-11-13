# Atelier Rack & Receipt Studio — 3D Garment Rack & Multi-Size Receipt Printer

An interactive Next.js 16 + Three.js boutique garment showroom and multi-size receipt printing studio. Browse hanging 3D shirts on a walnut-and-brass clothing rack, inspect garments in 360°, pick shirt sizes and quantities onto a receipt draft, customize both **shirt sizes** and **receipt paper dimensions**, persist data to **Google Sheets (`ข้อมูลหนังสือ`)** or browser `localStorage`, and print or export PDF receipts across 4 tailored templates.

---

## ✨ Features

- **3D Boutique Clothing Rack (`ClothingRackCanvas` & `WardrobeRack`):**
  - Sculpted 3D garments (`ShirtModel`) hanging on wooden & brushed brass hangers along an architectural oiled-walnut rack with warm boutique downlights.
  - Supports 4 garment silhouettes (`tshirt`, `polo`, `oxford`, `hoodie`) with procedural fabric weaves (jersey, piqué, oxford basketweave, brushed fleece), collar/pocket/hood details, hang tags, and optional uploaded front/back textures (`ShirtTextureGenerator`).
  - Navigate smoothly via mouse drag, touch swipe, mouse wheel, bottom indicator controls, or keyboard (`ArrowLeft`, `ArrowRight`, `Escape`), and filter instantly by search query (name, SKU, category, collection, style, or size) or category pills.

- **360° Shirt Inspection & Size/Quantity Picker (`ShirtInspectionView`):**
  - Click any hanging garment to bring it onto an interactive 360° studio pedestal powered by `OrbitControls` (drag to rotate, scroll to zoom).
  - View SKU, collection, category, and fabric notes; pick from per-shirt sizes with chest/length/shoulder measurements (in inches), stock count, and per-size prices; adjust quantity; and add straight to the receipt draft—or jump directly into editing or deleting the garment.

- **Shirt Studio & Customizable Shirt Sizes (`ShirtStudioModal` & `SizeManagerModal`):**
  - Add new garments or edit existing ones: SKU, name, brand/collection, category, silhouette style, primary & accent color swatches, base price, fabric note, hang-tag text, and front/back images.
  - Full shirt size management per garment: add one-click presets (`XS`, `S`, `M`, `L`, `XL`, `2XL`, `3XL`, `Freesize`) or custom size labels, and edit chest, length, shoulder measurements, per-size pricing, and stock counts at any time.

- **4 Printable Receipt & Invoice Templates (`ReceiptPreview`):**
  - `thermal_pos` (**Thermal POS**): Compact monospace slip with shirt size measurements and PromptPay ID, tailored for 58mm / 80mm thermal rolls.
  - `retail_standard` (**Retail Standard**): Clean boutique receipt / cash bill showing SKU, size measurements, payment method (`cash`, `transfer`, `card`, `cod`), and itemized totals.
  - `tax_invoice` (**Tax Invoice**): Formal Thai VAT 7% Tax Invoice / Receipt with seller & customer Tax ID, VAT breakdown (`none`, `excluded_7`, `included_7`), and signature blocks.
  - `boutique_gift` (**Boutique Gift Slip**): Minimalist packing & gift slip with recipient details and an optional **Hide Prices** (`hidePricesOnSlip`) toggle.

- **Add & Edit Custom Receipt Paper Sizes (`SizeManagerModal` & `ReceiptStudioModal`):**
  - 5 built-in presets: `58mm` Thermal Roll (`58mm × auto`), `80mm` Thermal Roll (`80mm × auto`), `A5` (`148 × 210 mm`), `A4` (`210 × 297 mm`), and `4×6"` Gift / Packing Slip (`100 × 150 mm`).
  - Add custom paper sizes in millimeters (width `30–450 mm`, fixed height `30–600 mm` or continuous roll auto-height, margin `0–40 mm`, font scale `0.6–1.8×`, `portrait` or `landscape` orientation, and default template), edit existing sizes inline or in the Size Manager, delete custom sizes, or restore presets.

- **Real Print / Save PDF & Receipt History (`ReceiptStudioModal`):**
  - Live zoomable paper preview (`ReceiptPreview`), editable shop profile (shop name, tagline, address, phone, Tax ID, PromptPay ID, footer note), customer info, discount, shipping fee, VAT 7% calculation, and inline item size/quantity/price editing.
  - Dynamically injects `@page { size: ...; margin: ...; }` into `<style id="dynamic-print-page-style">` and renders a dedicated `#printable-receipt-root` for accurate `window.print()` / Save as PDF output.
  - Persists shirts, paper sizes, shop profile, active receipt draft, and saved receipt history in browser `localStorage` (`atelier_*_v1`) and syncs in parallel with Google Sheets (`ข้อมูลหนังสือ`) when configured.

- **Google Sheets (`ข้อมูลหนังสือ`), Google Drive & Gemini AI Tag Scan:**
  - **Google Sheets 4-Tab Database:** On load, the app hydrates `/api/shirts`, `/api/paper-sizes`, `/api/shop-profile`, and `/api/receipts` concurrently via `Promise.allSettled`, keeping `localStorage` in sync and writing updates with `valueInputOption: 'RAW'` (preserving leading zeros in Tax ID, PromptPay ID, and phone numbers). Falls back cleanly to `INITIAL_SHIRTS` / `INITIAL_PAPER_SIZES` / `DEFAULT_SHOP_PROFILE` and `localStorage` when unconfigured.
  - **Google Drive Image Upload (`/api/upload-cover`):** Streams front/back garment photos to Google Drive when service account credentials are provided, or gracefully stores compressed client data URLs offline.
  - **Gemini AI Tag & Garment Scan (`/api/gemini-scan`):** Uses `@google/genai` (`gemini-2.5-flash`) to OCR hangtags/care labels/size tables (`mode: "ocr"`) or auto-categorize garment photos (`mode: "categorize"`) when `GEMINI_API_KEY` is configured.

---

## 🛠️ Tech Stack

- **Framework:** Next.js `16.4.6` (App Router, `cacheComponents: true`, `partialPrefetching: true`, Turbopack)
- **UI & Styling:** React `19.3.0`, TypeScript `5`, Tailwind CSS `4.3.3` (`@tailwindcss/turbopack`), `lucide-react`, Google Fonts (`Cinzel`, `Cormorant Garamond`, `Noto Sans Thai`)
- **3D Rendering:** `three` `0.187.0`, `@react-three/fiber` `9.8.2`, `@react-three/drei` `10.7.9`
- **Cloud & AI Integrations (Optional):** `googleapis`, `@google/genai`

---

## 📊 Google Sheets Database (`ข้อมูลหนังสือ`)

When `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY` are configured, `getSheetsDatabaseConfig()` in `src/lib/googleSheets.ts` connects to the Google Sheet specified by `GOOGLE_SHEET_SHIRTS_ID` (optional override) or `GOOGLE_SHEET_ID` (defaulting to `DEFAULT_SPREADSHEET_ID` = `1i_tTqQkL7kd279Nc04-L_l7atRodk_145kFPMejfh3U`), supporting either a bare Spreadsheet ID or a full Google Sheets URL (`https://docs.google.com/spreadsheets/d/<ID>/edit...`).

### Service Account Setup
1. Enable **Google Sheets API** (and **Google Drive API** if using `/api/upload-cover`) in your Google Cloud project.
2. Create a Service Account key and copy `client_email` (`GOOGLE_SERVICE_ACCOUNT_EMAIL`) and `private_key` (`GOOGLE_PRIVATE_KEY`).
3. Open your Google Spreadsheet (`ข้อมูลหนังสือ`) and **Share** it with `GOOGLE_SERVICE_ACCOUNT_EMAIL` as **Editor**.

### Sheet Tabs & Columns
| Tab & Range | Columns | Notes |
| --- | --- | --- |
| `Shirts!A:O` | `id, sku, name, brandOrCollection, category, style, color, accentColor, basePrice, fabricNote, tagText, frontImageUrl, backImageUrl, sizesJson, createdAt` | Garment catalog & JSON-serialized `ShirtSize[]` |
| `Receipts!A:S` | `id, receiptNo, issuedAt, templateType, paperSizeId, customerName, customerPhone, customerAddress, customerTaxId, paymentMethod, discountAmount, shippingFee, vatMode, subtotal, vatAmount, grandTotal, itemCount, itemsJson, receiptJson` | Saved receipt history (`GET` sorts newest-first by `issuedAt`) |
| `PaperSizes!A:J` | `id, name, widthMm, heightMm, marginMm, fontScale, orientation, defaultTemplate, isPreset, updatedAt` | Preset & custom receipt paper sizes |
| `ShopProfile!A:H` | `id, shopName, tagline, address, phone, taxId, promptPayId, footerNote` | Single `id='default'` row (`ShopProfile!A1:H2`) |

---

## 🔌 API Routes

| Route | Methods | Description |
| --- | --- | --- |
| `/api/shirts` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | Reads/writes garments in `Shirts!A:O` (`DELETE` accepts `?id=` or JSON `{ id }`; falls back to `INITIAL_SHIRTS` when unconfigured). |
| `/api/receipts` | `GET`, `POST`, `DELETE` | Reads sorted receipt history, validates totals/VAT and appends to `Receipts!A:S`, or deletes a receipt row by `?id=` / JSON `{ id }`. |
| `/api/paper-sizes` | `GET`, `PUT`, `POST` | Reads `PaperSizes!A:J`, replaces the full paper-size list (`PUT` / bulk `POST`), or upserts a single paper size (`POST`). |
| `/api/shop-profile` | `GET`, `PUT` | Reads/updates the default shop profile in `ShopProfile!A1:H2` (synced with a 600ms debounce from the UI). |
| `/api/upload-cover` | `POST` | Uploads front/back garment images (`multipart/form-data`) to Google Drive (`GOOGLE_DRIVE_FOLDER_ID` optional). |
| `/api/gemini-scan` | `POST` | Runs `gemini-2.5-flash` hangtag/care-label/size-table OCR (`mode: "ocr"`) or garment categorization (`mode: "categorize"`). |
| `/api/webhooks/vercel-discord` | `POST` | Formats Vercel deployment events into Discord webhook embeds. |

*(Write routes against Google Sheets return `{ success: true, persisted: 'sheets' | 'local', ... }`, or HTTP `502` if Sheets credentials are configured and a Google Sheets write fails.)*

---

## 📁 Project Structure

```text
bookshelf-app/
├── .github/
│   ├── scripts/notify-discord.mjs          # GitHub Actions Discord deploy notifier
│   └── workflows/discord-notify.yml        # Build & deploy status check workflow
├── public/                                 # Static SVG assets
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── gemini-scan/route.ts        # POST: Gemini 2.5 Flash OCR & garment categorizer
│   │   │   ├── paper-sizes/route.ts        # GET/PUT/POST: PaperSizes!A:J sync
│   │   │   ├── receipts/route.ts           # GET/POST/DELETE: Receipts!A:S history & totals check
│   │   │   ├── shirts/route.ts             # GET/POST/PUT/PATCH/DELETE: Shirts!A:O catalog sync
│   │   │   ├── shop-profile/route.ts       # GET/PUT: ShopProfile!A:H sync
│   │   │   ├── upload-cover/route.ts       # POST: Garment image upload to Google Drive
│   │   │   └── webhooks/vercel-discord/
│   │   │       └── route.ts                # POST: Vercel deployment webhook to Discord
│   │   ├── globals.css                     # Tailwind theme + @media print layout rules
│   │   ├── layout.tsx                      # Root layout & Google Fonts (Cinzel, Cormorant, Noto Sans Thai)
│   │   └── page.tsx                        # Main application state, parallel Sheets sync & print orchestration
│   ├── components/
│   │   ├── 3d/
│   │   │   ├── ClothingRackCanvas.tsx      # 3D rack canvas, search/filters, hover card & size picker overlay
│   │   │   ├── ShirtInspectionView.tsx     # 360° OrbitControls pedestal inspection studio
│   │   │   ├── ShirtModel.tsx              # Sculpted 3D shirt silhouettes + wooden/brass hanger
│   │   │   ├── ShirtTextureGenerator.ts    # Procedural woven fabric & uploaded garment CanvasTextures
│   │   │   └── WardrobeRack.tsx            # Oiled walnut plinth, brass rail & warm downlight rig
│   │   ├── receipt/
│   │   │   ├── ReceiptPreview.tsx          # 4 receipt templates scaled to active mm paper dimensions
│   │   │   ├── ReceiptStudioModal.tsx      # Receipt builder, live preview, history & dynamic @page CSS
│   │   │   └── SizeManagerModal.tsx        # Add/edit custom receipt paper sizes & per-shirt sizes
│   │   └── studio/
│   │       └── ShirtStudioModal.tsx        # Add/edit shirt modal, size editor & Gemini AI scan
│   ├── data/
│   │   └── shirts.ts                       # Starter 6 garments, size templates, paper presets & shop defaults
│   ├── lib/
│   │   ├── googleDrive.ts                  # Google Drive v3 service-account helper
│   │   ├── googleSheets.ts                 # Spreadsheet ID parser, Sheets v4 client & deleteSheetRowById
│   │   └── storage.ts                      # SSR-safe localStorage helpers, VAT 7% math & THB formatting
│   └── types/
│       └── shirt.ts                        # TypeScript interfaces for shirts, sizes, paper & receipts
├── .env.example
├── next.config.ts
└── package.json
```

---

## 🔐 Environment Variables (Optional)

The app works completely out of the box in the browser using starter defaults and `localStorage`. Configure `.env` / `.env.local` (see `.env.example`) for Google Sheets (`ข้อมูลหนังสือ`), Google Drive uploads, Gemini AI tag scanning, or Discord notifications:

```env
# Optional: Google Cloud Service Account Credentials for Google Sheets & Google Drive
GOOGLE_SERVICE_ACCOUNT_EMAIL="your-service-account@your-project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Optional: Google Spreadsheet ID or full Google Sheets URL for "ข้อมูลหนังสือ"
# Supports either an ID or URL (https://docs.google.com/spreadsheets/d/<ID>/edit).
GOOGLE_SHEET_ID=""

# Optional override for the spreadsheet above (takes precedence over GOOGLE_SHEET_ID if set)
GOOGLE_SHEET_SHIRTS_ID=""

# Optional: Google Drive Folder ID for uploaded shirt/receipt images
GOOGLE_DRIVE_FOLDER_ID=""

# Optional: Google Gemini API Key for /api/gemini-scan (hangtag OCR & garment categorization)
GEMINI_API_KEY=""

# Optional: Discord Webhook URL for /api/webhooks/vercel-discord
DISCORD_WEBHOOK_URL=""
```

---

## 🚀 Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev

# 3. Build for production
npm run build

# 4. Run the production build locally
npm run start

# 5. Run ESLint
npm run lint
```

Open [http://localhost:3000](http://localhost:3000) in your browser after running `npm run dev` or `npm run start`.

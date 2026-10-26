import { createWorker } from 'tesseract.js';
import type { UnitType } from '../types';
import { MASTER_GROCERY_CATALOG, type CatalogItem } from '../data/masterCatalog';

export interface ExtractedProductDetails {
  name: string;
  brand: string;
  category: string;
  price: number | null; // MRP / Selling Price
  purchasePrice?: number;
  unit: UnitType;
  weightQuantity: string; // e.g. "500g" or "1 kg"
  barcode: string;
  expiryDate?: string;
  mfgDate?: string;
  rawText: string;
  confidence: number;
  catalogMatch?: CatalogItem;
  source: 'gemini' | 'tesseract' | 'catalog';
}

const KNOWN_BRANDS = [
  'Aashirvaad', 'Fortune', 'Tata', 'Tata Salt', 'Tata Tea', 'Parle', 'Britannia', 
  'Amul', 'Maggi', 'Nestle', 'Nestlé', 'Haldiram', "Haldiram's", 'Bikaji', 'Balaji', 
  'Everest', 'MDH', 'Catch', 'Goldiee', 'Badshah', 'Rajdhani', 'Dettol', 'Lifebuoy', 
  'Surf Excel', 'Ariel', 'Vim', 'Tide', 'Rin', 'Ghadi', 'Wheel', 'Clinic Plus', 
  'Head & Shoulders', 'Pantene', 'Sunsilk', 'Dove', 'Lux', 'Pears', 'Medimix', 
  'Cinthol', 'Mysore Sandal', 'Colgate', 'Pepsodent', 'Close Up', 'Sensodyne', 
  'Dabur', 'Patanjali', 'Saffola', 'Dhara', 'Gemini', 'Ruchi Gold', 'Emami', 
  'Boroplus', 'BoroLine', 'Vaseline', 'Nivea', 'Ponds', "Pond's", 'Cadbury', 
  'Dairy Milk', 'KitKat', 'Munch', 'Oreo', 'Good Day', 'Marie Gold', 'Monaco', 
  'Krackjack', 'Hide & Seek', 'Bourbon', 'Frooti', 'Maaza', 'Slice', 'Real', 
  'Tropicana', 'Kissan', 'Heinz', 'Knorr', "Ching's", 'Top Ramen', 'Yippee', 
  'Lipton', 'Red Label', 'Taj Mahal', 'Wagh Bakri', 'Bru', 'Nescafe', 'Bournvita', 
  'Horlicks', 'Boost', 'Complan', 'Lays', "Lay's", 'Kurkure', 'Bingo', 'Doritos', 
  'Uncle Chipps', 'Vadilal', "Kwality Wall's", 'Mother Dairy', 'Gowardhan', 'Nandini', 
  'MTR', 'Gits', 'Bambino', 'Kohinoor', 'Daawat', 'India Gate', 'Madhur', 
  'Dhampure', 'Mawana', 'Godrej', 'Good Knight', 'All Out', 'Hit', 'Harpic', 
  'Lizol', 'Colin', 'Whisper', 'Stayfree', 'Pampers', 'Huggies', 'Vicks', 
  'Zandu', 'Eno', 'Moov', 'Iodex', 'Volini', 'Tiger Balm', 'Uncle Chips'
];

// Helper to sanitize unit string
export function normalizeUnit(rawUnit: string): UnitType {
  const u = rawUnit.toLowerCase().trim();
  if (['kg', 'kgs', 'kilogram', 'kilograms', 'kilo'].includes(u)) return 'kg';
  if (['g', 'gm', 'gms', 'gram', 'grams'].includes(u)) return 'g';
  if (['l', 'ltr', 'ltrs', 'litre', 'litres', 'liter', 'liters'].includes(u)) return 'litre';
  if (['ml', 'mls', 'millilitre', 'millilitres'].includes(u)) return 'ml';
  if (['packet', 'pack', 'packs', 'pkt', 'pkts', 'pouch', 'pouches'].includes(u)) return 'packet';
  if (['piece', 'pieces', 'pc', 'pcs', 'unit', 'units'].includes(u)) return 'piece';
  if (['dozen', 'dozens', 'dz'].includes(u)) return 'dozen';
  if (['box', 'boxes'].includes(u)) return 'box';
  if (['bottle', 'bottles', 'btl'].includes(u)) return 'bottle';
  if (['carton', 'cartons', 'ctn'].includes(u)) return 'carton';
  return 'packet';
}

// Guess product category based on text keywords
export function inferCategory(text: string, brand?: string): string {
  const t = `${brand || ''} ${text}`.toLowerCase();
  
  if (/oil|tel|ghee|mustard|sunflower|refined|soya|groundnut|vanaspati/.test(t)) {
    return 'Cooking Oils & Ghee';
  }
  if (/atta|flour|maida|besan|suji|sooji|rawa|dalia|chana dal/.test(t)) {
    return 'Atta & Flours';
  }
  if (/rice|chawal|basmati|kolam|sona masoori|poha/.test(t)) {
    return 'Rice & Grains';
  }
  if (/dal|pulse|moong|urad|toor|arhar|masoor|chana|rajma|chhole|soyabean/.test(t)) {
    return 'Pulses & Dals';
  }
  if (/salt|namak|sugar|cheeni|shakar|jaggery|gur|gud/.test(t)) {
    return 'Salt, Sugar & Jaggery';
  }
  if (/masala|mirch|haldi|turmeric|chilli|dhaniya|coriander|jeera|cumin|garam masala|hing|rai|spices|pepper/.test(t)) {
    return 'Spices & Masalas';
  }
  if (/biscuit|cookie|rusk|wafer|cracker|namkeen|chips|bhujia|sev|snacks|kurkure|popcorn/.test(t)) {
    return 'Biscuits & Snacks';
  }
  if (/noodle|maggi|pasta|macaroni|yippee|sauce|ketchup|jam|spread|mayo|instant|soup/.test(t)) {
    return 'Instant Food & Noodles';
  }
  if (/tea|chai|coffee|bournvita|horlicks|boost|complan|juice|drink|sharbat|syrup|soda/.test(t)) {
    return 'Tea, Coffee & Beverages';
  }
  if (/soap|shampoo|conditioner|detergent|powder|liquid|bar|toothpaste|paste|brush|cleaner|wash|floor|dish|harpic|lizol|dettol|lifebuoy/.test(t)) {
    return 'Personal & Home Care';
  }
  if (/milk|dahi|curd|paneer|butter|cheese|cream/.test(t)) {
    return 'Dairy & Bakery';
  }
  return 'General Grocery';
}

// Intelligent regex and heuristic extractor from OCR text
export function parseProductText(rawText: string): ExtractedProductDetails {
  const cleanRaw = rawText.replace(/\r/g, '');
  const lines = cleanRaw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let brand = '';
  let name = '';
  let price: number | null = null;
  let weightQuantity = '';
  let unit: UnitType = 'packet';
  let barcode = '';
  let expiryDate = '';
  let mfgDate = '';

  // 1. Detect Barcode: Look for 8-14 digits, specially 890... (India)
  const barcodeMatches = cleanRaw.match(/\b(890\d{10}|\d{12,14}|\d{8})\b/g);
  if (barcodeMatches && barcodeMatches.length > 0) {
    // Prefer India 890 if present
    const indianEan = barcodeMatches.find((b) => b.startsWith('890'));
    barcode = indianEan || barcodeMatches[0];
  }

  // 2. Detect Brand from known list
  const textUpper = cleanRaw.toUpperCase();
  for (const b of KNOWN_BRANDS) {
    const re = new RegExp(`\\b${b.replace(/['.]/g, '')}\\b`, 'i');
    if (re.test(cleanRaw)) {
      brand = b;
      break;
    }
  }

  // If no brand from known list, check catalog brands
  if (!brand) {
    for (const catItem of MASTER_GROCERY_CATALOG) {
      if (catItem.brand && new RegExp(`\\b${catItem.brand}\\b`, 'i').test(cleanRaw)) {
        brand = catItem.brand;
        break;
      }
    }
  }

  // 3. Detect Price / MRP
  // Common formats: MRP Rs 50.00 / MRP ₹ 45 / Rs. 30.00 / M.R.P. : 120 / ₹99.00 / 45/-
  const mrpPatterns = [
    /(?:M\.?R\.?P\.?|MAX\.?\s*RETAIL\s*PRICE|PRICE|MRP)\s*[:.\-]?\s*(?:RS\.?|INR|₹)?\s*([0-9]{1,4}(?:\.[0-9]{1,2})?)/i,
    /(?:RS\.?|₹)\s*([0-9]{1,4}(?:\.[0-9]{1,2})?)/i,
    /([0-9]{1,4}(?:\.[0-9]{1,2})?)\s*(?:INCL\.?\s*OF\s*ALL\s*TAXES)/i,
    /\b([0-9]{1,4})\s*\/-/i,
  ];

  for (const pat of mrpPatterns) {
    const match = cleanRaw.match(pat);
    if (match && match[1]) {
      const val = parseFloat(match[1]);
      // Avoid false matches like year 2024, 2025, 2026 or unrealistic price
      if (val > 0 && val < 5000 && val !== 2024 && val !== 2025 && val !== 2026 && val !== 2027) {
        price = val;
        break;
      }
    }
  }

  // 4. Detect Weight / Volume / Quantity & Unit
  // e.g. Net Wt: 500g, Net Weight: 1 kg, Net Qty: 250 ml, 1L, 100 g, 5 kg
  const weightPatterns = [
    /(?:NET\s*(?:WT\.?|WEIGHT|QTY\.?|QUANTITY|VOLUME|CONTENTS?)|NET|QUANTITY|WT)\s*[:.\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*(KG|KILOGRAMS?|G|GM|GMS|GRAMS?|ML|MILLILITRES?|L|LTR|LITRES?|PACKET|PACK|PIECE|PIECES|PCS|BOTTLE|BOX)\b/i,
    /\b([0-9]+(?:\.[0-9]+)?)\s*(kg|gm|gms|g|ml|ltr|litre|l)\b/i,
  ];

  for (const pat of weightPatterns) {
    const match = cleanRaw.match(pat);
    if (match && match[1] && match[2]) {
      const amt = match[1];
      const rawU = match[2];
      unit = normalizeUnit(rawU);
      weightQuantity = `${amt}${rawU.toLowerCase()}`;
      break;
    }
  }

  // 5. Detect Expiry Date / Best Before
  const expPattern = /(?:EXP|EXPIRY|USE\s*BY|BEST\s*BEFORE|BB)\s*[:.\-]?\s*([0-9]{1,2}[/-][0-9]{2,4}|[A-Za-z]{3}\s*[0-9]{2,4}|[0-9]{2}\.[0-9]{2}\.[0-9]{2,4})/i;
  const expMatch = cleanRaw.match(expPattern);
  if (expMatch && expMatch[1]) {
    expiryDate = expMatch[1];
  }

  // 6. Match against MASTER_GROCERY_CATALOG
  let matchedCatalog: CatalogItem | undefined = undefined;
  if (barcode) {
    matchedCatalog = MASTER_GROCERY_CATALOG.find((c) => c.barcode === barcode);
  }

  if (!matchedCatalog) {
    // Score-based match across catalog items
    let highestScore = 0;
    const tokens = cleanRaw
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);

    for (const cat of MASTER_GROCERY_CATALOG) {
      let score = 0;
      const catLower = cat.name.toLowerCase();
      const brandLower = cat.brand.toLowerCase();

      if (brand && brandLower === brand.toLowerCase()) {
        score += 3;
      }

      // Check key name words
      const catWords = catLower.split(/\s+/).filter((w) => w.length > 2);
      for (const w of catWords) {
        if (tokens.includes(w)) {
          score += 2;
        }
      }

      // Match unit/weight if present
      if (weightQuantity && catLower.includes(weightQuantity.toLowerCase())) {
        score += 3;
      }

      if (score > highestScore && score >= 5) {
        highestScore = score;
        matchedCatalog = cat;
      }
    }
  }

  // 7. Determine Final Product Name & Category
  let category = inferCategory(cleanRaw, brand);

  if (matchedCatalog) {
    name = matchedCatalog.name;
    brand = matchedCatalog.brand;
    category = matchedCatalog.category;
    unit = matchedCatalog.unit;
    if (!price) price = matchedCatalog.typicalSellingPrice;
    if (!barcode) barcode = matchedCatalog.barcode;
  } else {
    // Construct clean name from OCR lines
    // Filter noise lines
    const noiseWords = [
      'fssai', 'ingredients', 'nutrition', 'information', 'customer', 'care',
      'batch', 'mfg', 'mfd', 'exp', 'mrp', 'keep', 'store in', 'manufactured',
      'marketed', 'trademark', 'lic no', 'net wt', 'rs.', 'pvt ltd', 'consumer'
    ];

    const cleanLines = lines.filter((line) => {
      const lower = line.toLowerCase();
      if (line.length < 3 || line.length > 50) return false;
      return !noiseWords.some((nw) => lower.includes(nw));
    });

    if (cleanLines.length > 0) {
      // Pick first prominent line that isn't just numbers
      const candidate = cleanLines.find((l) => /[a-zA-Z]{3,}/.test(l)) || cleanLines[0];
      name = candidate;
    }

    if (brand && !name.toLowerCase().includes(brand.toLowerCase())) {
      name = `${brand} ${name}`.trim();
    }

    if (weightQuantity && !name.toLowerCase().includes(weightQuantity.toLowerCase())) {
      name = `${name} (${weightQuantity})`.trim();
    }

    if (!name) {
      name = brand ? `${brand} Grocery Item` : 'Packaged Grocery Item';
    }
  }

  // Calculate purchase price heuristic: ~85% of selling price
  const purchasePrice = matchedCatalog 
    ? matchedCatalog.typicalPurchasePrice 
    : (price ? Math.round(price * 0.85) : undefined);

  return {
    name,
    brand: brand || 'Generic / Local',
    category,
    price,
    purchasePrice,
    unit,
    weightQuantity: weightQuantity || '1 packet',
    barcode: barcode || (matchedCatalog?.barcode || ''),
    expiryDate,
    mfgDate,
    rawText: cleanRaw,
    confidence: matchedCatalog ? 0.95 : (brand && price ? 0.8 : 0.65),
    catalogMatch: matchedCatalog,
    source: matchedCatalog ? 'catalog' : 'tesseract',
  };
}

// OCR Execution using Tesseract.js in the browser
export async function extractDetailsWithTesseract(
  imageSource: string | HTMLCanvasElement | Blob | File,
  onProgress?: (status: string, progressPct: number) => void
): Promise<ExtractedProductDetails> {
  onProgress?.('Initializing Optical Character Recognition (OCR)...', 15);

  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        const pct = Math.round((m.progress || 0) * 80) + 15;
        onProgress?.(`Reading product label text... ${Math.round((m.progress || 0) * 100)}%`, pct);
      } else if (m.status) {
        onProgress?.(`Preparing AI scanner: ${m.status}...`, 20);
      }
    },
  });

  try {
    onProgress?.('Scanning packet text, MRP, weight and details...', 60);
    const result = await worker.recognize(imageSource);
    const rawText = result.data?.text || '';

    onProgress?.('Extracting Brand, Price, Weight, and Barcode...', 90);
    const parsed = parseProductText(rawText);
    onProgress?.('Complete!', 100);

    return parsed;
  } finally {
    await worker.terminate();
  }
}

// Cloud Gemini Vision AI for ultra-high precision extraction (Optional with API key)
export async function extractDetailsWithGemini(
  base64DataUrl: string,
  apiKey: string,
  onProgress?: (status: string, pct: number) => void
): Promise<ExtractedProductDetails> {
  onProgress?.('Connecting to Gemini Vision AI...', 20);

  // Extract base64 without prefix
  const base64Data = base64DataUrl.replace(/^data:image\/\w+;base64,/, '');
  const mimeTypeMatch = base64DataUrl.match(/^data:(image\/\w+);base64,/);
  const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';

  const prompt = `You are a Kirana & Retail Product Identification AI.
Inspect this packaged grocery item photo carefully and extract all product details.
Respond ONLY with a valid JSON object matching this schema, without markdown formatting or code fences:
{
  "name": "full product name including brand and net weight e.g. Tata Salt Iodized (1kg)",
  "brand": "brand name e.g. Tata, Britannia, Maggi, Fortune",
  "category": "one of: 'Cooking Oils & Ghee', 'Atta & Flours', 'Rice & Grains', 'Pulses & Dals', 'Salt, Sugar & Jaggery', 'Spices & Masalas', 'Biscuits & Snacks', 'Instant Food & Noodles', 'Tea, Coffee & Beverages', 'Personal & Home Care', 'Dairy & Bakery', 'General Grocery'",
  "price": number or null (the printed Maximum Retail Price MRP in Rupees),
  "purchasePrice": number or null (approximate wholesale/purchase price in Rupees, typically 80-85% of MRP),
  "unit": "one of: 'kg', 'g', 'litre', 'ml', 'packet', 'piece', 'dozen', 'box', 'bottle', 'carton'",
  "weightQuantity": "e.g. 500g, 1 kg, 250ml, 1 L, 75g",
  "barcode": "extracted 8-14 digit barcode digits if visible on the packaging, else empty string",
  "expiryDate": "detected expiry or best before date string e.g. 12/2026 or empty string"
}`;

  onProgress?.('Analyzing packaging image with Gemini Vision...', 50);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errorBody}`);
  }

  onProgress?.('Processing Gemini AI extraction...', 85);
  const data = await response.json();
  const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textOutput) {
    throw new Error('No response content from Gemini');
  }

  // Parse JSON
  const parsed = JSON.parse(textOutput);
  onProgress?.('Product successfully identified!', 100);

  return {
    name: parsed.name || 'Scanned Grocery Item',
    brand: parsed.brand || 'Generic',
    category: parsed.category || 'General Grocery',
    price: typeof parsed.price === 'number' ? parsed.price : null,
    purchasePrice: typeof parsed.purchasePrice === 'number' ? parsed.purchasePrice : (parsed.price ? Math.round(parsed.price * 0.85) : undefined),
    unit: normalizeUnit(parsed.unit || 'packet'),
    weightQuantity: parsed.weightQuantity || '1 packet',
    barcode: parsed.barcode || '',
    expiryDate: parsed.expiryDate || '',
    rawText: textOutput,
    confidence: 0.98,
    source: 'gemini',
  };
}

// Unified orchestrator: Uses Gemini if key provided, else offline Tesseract.js
export async function extractProductDetails(
  imageSource: string | HTMLCanvasElement | Blob | File,
  options?: {
    geminiApiKey?: string;
    onProgress?: (status: string, pct: number) => void;
  }
): Promise<ExtractedProductDetails> {
  const { geminiApiKey, onProgress } = options || {};

  // If Gemini API key is provided and source is base64 string or convertable
  if (geminiApiKey && typeof imageSource === 'string' && imageSource.startsWith('data:image/')) {
    try {
      return await extractDetailsWithGemini(imageSource, geminiApiKey, onProgress);
    } catch (err) {
      console.warn('Gemini vision extraction failed, falling back to offline OCR:', err);
      onProgress?.('Gemini unavailable. Switching to offline OCR engine...', 10);
    }
  }

  // Default: Fast, local, private, offline-capable Tesseract OCR
  return await extractDetailsWithTesseract(imageSource, onProgress);
}

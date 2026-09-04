// Deterministic synthetic catalog for Muse Home Collective.
// Pure data + seeded PRNG — no database or network imports — so it can be
// unit-tested and reused by the seeder without DATABASE_URL.

export interface TypeSpec {
  name: string;
  dimensions: string;
  basePrice: number;
}

export interface CollectionSpec {
  id: string;
  name: string;
  description: string;
  materials: string;
  series: string[];
  types: TypeSpec[];
  intros: string[];
  closings: string[];
}

export interface GeneratedProduct {
  id: string;
  name: string;
  slug: string;
  collectionId: string;
  price: number;
  description: string;
  longDescription: string;
  materials: string;
  dimensions: string;
  images: string[];
  stock: number;
  rating: number;
  reviewCount: number;
  featured: boolean;
  isNew: boolean;
  createdAt: Date;
  ledger: { delta: number; kind: "initial" | "restock" | "sale" | "adjustment"; reference: string; note: string }[];
}

export interface GeneratedImport {
  id: string;
  sourceFile: string;
  status: "completed";
  importedBy: string;
  startedAt: Date;
  finishedAt: Date;
  productIds: string[];
}

export interface GeneratedCatalog {
  collections: {
    id: string;
    name: string;
    slug: string;
    description: string;
    image: string;
    heroImage: string;
    sortOrder: number;
    createdAt: Date;
  }[];
  products: GeneratedProduct[];
  imports: GeneratedImport[];
}

export const CATALOG_SEED = 20260903;
export const PRODUCTS_PER_COLLECTION = 25;
export const CATALOG_BASE_DATE = Date.parse("2026-09-01T09:00:00.000Z");
export const SEED_BATCH_SIZE = 100;

// Photo pool reused from the original storefront so the UI keeps its look.
const PHOTO_POOL = [
  "photo-1493663284031", "photo-1507473885765", "photo-1556909114",
  "photo-1558618666", "photo-1565193566173", "photo-1578500494198",
  "photo-1584100936595", "photo-1586023492125", "photo-1600210492486",
  "photo-1600585154340", "photo-1600607687939", "photo-1616486338812",
  "photo-1618221195710", "photo-1618220252344", "photo-1618220048045",
  "photo-1618221118493", "photo-1618219908412", "photo-1618220179428",
  "photo-1616594039964", "photo-1617103996702", "photo-1617806118233",
  "photo-1618767689160", "photo-1615874959474", "photo-1615529182904",
  "photo-1614622539917", "photo-1613545325278", "photo-1611967164521",
  "photo-1612196808214", "photo-1601760562234", "photo-1592078615290",
  "photo-1595428774223", "photo-1594026112284", "photo-1538688525198",
  "photo-1550581190", "photo-1533090481720", "photo-1519710164239",
];

const photoUrl = (photoId: string, width: number) =>
  `https://images.unsplash.com/${photoId}?w=${width}&q=80&auto=format&fit=crop`;

// Fixed-rate PRNG (mulberry32). Same seed => identical catalog, every run.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const COLLECTIONS: CollectionSpec[] = [
  {
    id: "nordic-ash",
    name: "Nordic Ash",
    description: "Pale Scandinavian case goods in fine-grained ash, finished by hand.",
    materials: "Solid ash, matte lacquer, hand-cut joinery",
    series: ["Halden", "Skiffer", "Lyng", "Brage", "Solvei"],
    types: [
      { name: "Sideboard", dimensions: "W 164 × D 45 × H 78 cm", basePrice: 1490 },
      { name: "Dining Chair", dimensions: "W 46 × D 52 × H 82 cm", basePrice: 340 },
      { name: "Coffee Table", dimensions: "W 120 × D 65 × H 42 cm", basePrice: 720 },
      { name: "Open Bookshelf", dimensions: "W 84 × D 32 × H 182 cm", basePrice: 980 },
      { name: "Three-Seat Sofa", dimensions: "W 228 × D 94 × H 78 cm", basePrice: 2400 },
    ],
    intros: [
      "built from pale, fine-grained ash and finished with a whisper-thin matte lacquer",
      "shaped with quiet restraint so the grain carries the room",
      "joined without visible hardware in the Danish cabinetmaking tradition",
    ],
    closings: [
      "Designed to anchor a room without raising its voice.",
      "Made for slow mornings, long dinners, and unhurried light.",
      "A quiet piece that rewards a second look.",
    ],
  },
  {
    id: "reclaimed-oak",
    name: "Reclaimed Oak",
    description: "Weathered oak salvaged from barns and rail lines, joined with hand-forged iron.",
    materials: "Reclaimed oak, hand-forged iron, hard-wax oil",
    series: ["Bramwell", "Torv", "Hesket", "Fenwick", "Alderby"],
    types: [
      { name: "Trestle Dining Table", dimensions: "W 240 × D 100 × H 75 cm", basePrice: 1850 },
      { name: "Settle Bench", dimensions: "W 160 × D 40 × H 45 cm", basePrice: 620 },
      { name: "Console Table", dimensions: "W 150 × D 40 × H 84 cm", basePrice: 890 },
      { name: "Backless Bar Stool", dimensions: "Ø 34 × H 66 cm", basePrice: 310 },
      { name: "Plank Sideboard", dimensions: "W 180 × D 48 × H 76 cm", basePrice: 1620 },
    ],
    intros: [
      "built from century-old oak beams, every nail hole and saw mark kept where it fell",
      "cut from reclaimed barn timber and wire-brushed rather than sanded flat",
      "wrought from reclaimed rail timber and finished in hard-wax oil",
    ],
    closings: [
      "The grain carries a hundred years of weather; the joinery will carry another hundred.",
      "Built to be inherited, not replaced.",
      "No two pieces leave the workshop alike.",
    ],
  },
  {
    id: "linen-and-stone",
    name: "Linen & Stone",
    description: "Washed Belgian linen over deep cushions, set against honed travertine.",
    materials: "Washed Belgian linen, honed travertine, kiln-dried hardwood frame",
    series: ["Ondine", "Maren", "Tovel", "Calme", "Serafina"],
    types: [
      { name: "Lounge Sofa", dimensions: "W 236 × D 98 × H 76 cm", basePrice: 2750 },
      { name: "Travertine Coffee Table", dimensions: "Ø 90 × H 34 cm", basePrice: 1150 },
      { name: "Slipcover Armchair", dimensions: "W 88 × D 92 × H 80 cm", basePrice: 1340 },
      { name: "Stone Side Table", dimensions: "Ø 42 × H 52 cm", basePrice: 480 },
      { name: "Daybed", dimensions: "W 205 × D 98 × H 74 cm", basePrice: 1980 },
    ],
    intros: [
      "upholstered in washed Belgian linen that softens with every year of use",
      "dressed in stone the colour of morning fog and cushions you sink into",
      "tailored over a kiln-dried hardwood frame with double-doweled corners",
    ],
    closings: [
      "Texture first, spectacle never.",
      "For rooms that are lived in, not staged.",
      "Comfort engineered to look effortless.",
    ],
  },
  {
    id: "atelier-brass",
    name: "Atelier Brass",
    description: "Hand-spun brass lighting and table accents with a living patina.",
    materials: "Hand-spun brass, opal glass, textile cable",
    series: ["Solstraal", "Lumen", "Dagny", "Kupari", "Aurora"],
    types: [
      { name: "Pendant Lamp", dimensions: "Ø 38 × H 32 cm", basePrice: 540 },
      { name: "Table Lamp", dimensions: "Ø 24 × H 46 cm", basePrice: 360 },
      { name: "Floor Lamp", dimensions: "Ø 32 × H 152 cm", basePrice: 780 },
      { name: "Wall Sconce", dimensions: "W 16 × D 22 × H 30 cm", basePrice: 290 },
      { name: "Candleholder Set", dimensions: "H 12 / 18 / 24 cm", basePrice: 180 },
    ],
    intros: [
      "spun from raw brass that deepens to a warmer tone with every passing season",
      "paired with mouth-blown opal glass that throws a low, even light",
      "soldered and burnished entirely by hand in a two-person workshop",
    ],
    closings: [
      "Light, considered as a material.",
      "A patina you earn, not a finish you buy.",
      "Designed to glow, not to dazzle.",
    ],
  },
  {
    id: "ceramic-studio",
    name: "Ceramic Studio",
    description: "Wheel-thrown stoneware vases and vessels in muted reactive glazes.",
    materials: "Wheel-thrown stoneware, reactive glaze, food-safe interior",
    series: ["Karna", "Isla", "Terra", "Mistel", "Vesta"],
    types: [
      { name: "Floor Vase", dimensions: "Ø 26 × H 58 cm", basePrice: 220 },
      { name: "Bud Vase Trio", dimensions: "H 10 / 14 / 18 cm", basePrice: 110 },
      { name: "Serving Bowl", dimensions: "Ø 30 × H 9 cm", basePrice: 140 },
      { name: "Ceramic Pitcher", dimensions: "Ø 12 × H 24 cm", basePrice: 95 },
      { name: "Lidded Jar", dimensions: "Ø 18 × H 26 cm", basePrice: 165 },
    ],
    intros: [
      "thrown on the wheel and dipped in a reactive glaze that pools where it chooses",
      "fired twice in a slow kiln until the surface blooms into muted speckle",
      "shaped by hand so no two silhouettes repeat exactly",
    ],
    closings: [
      "Small variations are the signature of the wheel, not a flaw.",
      "Everyday vessels with gallery manners.",
      "Glazed to be used, not just admired.",
    ],
  },
  {
    id: "walnut-modern",
    name: "Walnut Modern",
    description: "Mid-century silhouettes in oiled American walnut with brass detailing.",
    materials: "American walnut, natural oil, solid brass pulls",
    series: ["Eames-era", "Vestal", "Kingsley", "Miro", "Aalto"],
    types: [
      { name: "Writing Desk", dimensions: "W 140 × D 66 × H 74 cm", basePrice: 1290 },
      { name: "Lounge Chair", dimensions: "W 74 × D 82 × H 78 cm", basePrice: 1180 },
      { name: "Record Cabinet", dimensions: "W 92 × D 40 × H 64 cm", basePrice: 860 },
      { name: "Nightstand", dimensions: "W 48 × D 40 × H 56 cm", basePrice: 490 },
      { name: "Credenza", dimensions: "W 176 × D 45 × H 72 cm", basePrice: 1690 },
    ],
    intros: [
      "cut from American walnut and rubbed with oil until the figure glows",
      "proportioned to mid-century rules and detailed with solid brass pulls",
      "built with floating panels that move with the seasons without splitting",
    ],
    closings: [
      "The desk you keep for forty years.",
      "Modernism without the museum glass.",
      "Warm geometry for working and living.",
    ],
  },
  {
    id: "rattan-coast",
    name: "Rattan Coast",
    description: "Woven rattan and cane pieces that carry sea air and slow afternoons.",
    materials: "Natural rattan, hand-woven cane, powder-coated frame",
    series: ["Tidelands", "Marisol", "Kelp", "Dune", "Pelagos"],
    types: [
      { name: "Cane Armchair", dimensions: "W 62 × D 66 × H 84 cm", basePrice: 520 },
      { name: "Rattan Room Divider", dimensions: "W 168 × H 180 cm", basePrice: 440 },
      { name: "Woven Coffee Table", dimensions: "Ø 90 × H 38 cm", basePrice: 560 },
      { name: "Hanging Egg Chair", dimensions: "Ø 100 × H 196 cm", basePrice: 890 },
      { name: "Linen Cabinet", dimensions: "W 80 × D 44 × H 150 cm", basePrice: 760 },
    ],
    intros: [
      "woven by hand over a bent frame, each strand pulled tight and pegged",
      "cane-wrapped and open-weave so light passes clean through it",
      "steamed and bent into curves that remember the coast",
    ],
    closings: [
      "Made for screened porches and long, bright rooms.",
      "Weightless to look at, made to last.",
      "The season never really ends with rattan.",
    ],
  },
  {
    id: "slate-and-steel",
    name: "Slate & Steel",
    description: "Industrial steel framing with honed slate tops, built for daily work.",
    materials: "Powder-coated steel, honed slate, oak accents",
    series: ["Foundry", "Anvil", "Kran", "Bolt", "Smide"],
    types: [
      { name: "Work Table", dimensions: "W 180 × D 80 × H 90 cm", basePrice: 980 },
      { name: "Industrial Bar Stool", dimensions: "W 40 × D 40 × H 76 cm", basePrice: 290 },
      { name: "Steel Bookcase", dimensions: "W 90 × D 38 × H 200 cm", basePrice: 1150 },
      { name: "Kitchen Island", dimensions: "W 180 × D 90 × H 92 cm", basePrice: 2150 },
      { name: "Locker Sideboard", dimensions: "W 120 × D 45 × H 88 cm", basePrice: 1240 },
    ],
    intros: [
      "welded from square-section steel and finished in a fine-textured black powder coat",
      "topped with honed slate that shrugs off heat, knives, and decades",
      "bolted, not glued — every joint can be serviced, every panel replaced",
    ],
    closings: [
      "Tools that happen to be furniture.",
      "Built for workshops, at home in kitchens.",
      "Utility you can lean on, literally.",
    ],
  },
  {
    id: "boucle-lounge",
    name: "Bouclé Lounge",
    description: "Deep, cloud-like lounge seating wrapped in nubby ivory bouclé.",
    materials: "Ivory bouclé, high-resilience foam, beech frame",
    series: ["Nuage", "Puffy", "Cirro", "Halcyon", "Laine"],
    types: [
      { name: "Barrel Chair", dimensions: "W 78 × D 76 × H 74 cm", basePrice: 920 },
      { name: "Ottoman", dimensions: "Ø 60 × H 40 cm", basePrice: 380 },
      { name: "Two-Seat Sofa", dimensions: "W 172 × D 96 × H 78 cm", basePrice: 1890 },
      { name: "Chaise Longue", dimensions: "W 156 × D 82 × H 76 cm", basePrice: 1650 },
      { name: "Pouf", dimensions: "Ø 48 × H 36 cm", basePrice: 240 },
    ],
    intros: [
      "wrapped in nubby ivory bouclé with the give of a well-worn sweater",
      "built on a beech frame with high-resilience foam that keeps its shape",
      "generously proportioned so the whole piece reads as one soft line",
    ],
    closings: [
      "Sit-down-first design.",
      "The loudest thing about it is the texture.",
      "For reading rooms and slow Sundays.",
    ],
  },
  {
    id: "nordic-bedding",
    name: "Nordic Bedding",
    description: "Solid oak beds and layered linen for the quietest room in the house.",
    materials: "Solid oak, stonewashed linen, natural latex",
    series: ["Drøm", "Kvist", "Natte", "Ro", "Stille"],
    types: [
      { name: "Oak Bed Frame", dimensions: "W 168 × L 212 × H 96 cm", basePrice: 1450 },
      { name: "Linen Duvet Set", dimensions: "Fits 200 × 220 cm", basePrice: 260 },
      { name: "Upholstered Headboard", dimensions: "W 162 × H 120 cm", basePrice: 640 },
      { name: "Bedside Table", dimensions: "W 45 × D 38 × H 54 cm", basePrice: 320 },
      { name: "Wool Throw", dimensions: "W 130 × L 200 cm", basePrice: 180 },
    ],
    intros: [
      "planed from solid oak and left with a soft, splinter-free hand",
      "layered in stonewashed linen that sleeps cool in summer, warm in winter",
      "low to the ground and long in proportion, in the northern way",
    ],
    closings: [
      "A room that asks nothing of you at the end of the day.",
      "Sleep, engineered quietly.",
      "The best hour of the day starts here.",
    ],
  },
  {
    id: "terra-cotta",
    name: "Terra Cotta",
    description: "Frost-proof terracotta planters and outdoor pieces that weather beautifully.",
    materials: "Frost-proof terracotta, teak, natural fibre",
    series: ["Ochre", "Canyon", "Ardilla", "Horno", "Rustica"],
    types: [
      { name: "Large Planter", dimensions: "Ø 48 × H 52 cm", basePrice: 190 },
      { name: "Planter Trio", dimensions: "Ø 22 / 32 / 42 cm", basePrice: 240 },
      { name: "Teak Bench", dimensions: "W 150 × D 38 × H 45 cm", basePrice: 740 },
      { name: "Clay Urn", dimensions: "Ø 36 × H 62 cm", basePrice: 210 },
      { name: "Outdoor Side Table", dimensions: "Ø 50 × H 46 cm", basePrice: 280 },
    ],
    intros: [
      "pressed from frost-proof clay and fired until it rings like a cup",
      "left unsealed so the surface drinks the rain and softens in the sun",
      "paired with teak that silvers gracefully out of doors",
    ],
    closings: [
      "Gardens deserve good bones too.",
      "Improves every season it stands outside.",
      "Made to be rained on.",
    ],
  },
  {
    id: "glasshouse",
    name: "Glasshouse",
    description: "Steel-and-glass consoles and display pieces with gallery-weight lines.",
    materials: "Blackened steel, 8 mm tempered glass, oak shelves",
    series: ["Orangery", "Vitrine", "Skio", "Pavilion", "Axel"],
    types: [
      { name: "Display Cabinet", dimensions: "W 96 × D 42 × H 190 cm", basePrice: 1380 },
      { name: "Glass Console", dimensions: "W 140 × D 38 × H 80 cm", basePrice: 940 },
      { name: "Vitrine Side Table", dimensions: "Ø 55 × H 52 cm", basePrice: 420 },
      { name: "Bar Cabinet", dimensions: "W 110 × D 48 × H 150 cm", basePrice: 1560 },
      { name: "Shelf Tower", dimensions: "W 60 × D 36 × H 180 cm", basePrice: 780 },
    ],
    intros: [
      "framed in blackened steel and glazed with 8 mm tempered glass",
      "edge-lit shelves that make ordinary objects look collected",
      "drawer-line oak against glass, so nothing disappears into it",
    ],
    closings: [
      "Furniture for the things you keep.",
      "Architecture in miniature.",
      "See everything, show it well.",
    ],
  },
];

export function generateCatalog(seed: number = CATALOG_SEED): GeneratedCatalog {
  const rand = mulberry32(seed);

  const collections = COLLECTIONS.map((spec, ci) => ({
    id: spec.id,
    name: spec.name,
    slug: spec.id,
    description: spec.description,
    image: photoUrl(PHOTO_POOL[(ci * 3 + 1) % PHOTO_POOL.length], 1200),
    heroImage: photoUrl(PHOTO_POOL[(ci * 3) % PHOTO_POOL.length], 1920),
    sortOrder: ci,
    createdAt: new Date(CATALOG_BASE_DATE - (ci + 1) * 86400000),
  }));

  const products: GeneratedProduct[] = [];
  let productOrdinal = 0;

  for (const spec of COLLECTIONS) {
    for (let i = 0; i < PRODUCTS_PER_COLLECTION; i++) {
      const series = spec.series[i % spec.series.length];
      const type = spec.types[Math.floor(i / spec.series.length) % spec.types.length];
      const slugBase = `${series}-${type.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const id = `${spec.id}-${slugBase}`;
      const name = `${series} ${type.name}`;

      const priceFactor = 0.85 + rand() * 0.5;
      const price = Math.max(49, Math.round((type.basePrice * priceFactor) / 10) * 10 - 1);

      const rating = Math.min(5, Math.round((3.8 + rand() * 1.2) * 10) / 10);
      const reviewCount = Math.floor(rand() * rand() * 380) + 3;

      // Ledger-first stock: every unit of stock is backed by a ledger entry.
      const initialStock = 6 + Math.floor(rand() * 12);
      const ledger: GeneratedProduct["ledger"] = [
        { delta: initialStock, kind: "initial", reference: `SEED/INIT/${spec.id}`, note: "Opening stock" },
      ];
      const salesCount = Math.floor(rand() * 4);
      for (let s = 0; s < salesCount; s++) {
        ledger.push({ delta: -(1 + Math.floor(rand() * 3)), kind: "sale", reference: `SEED/SALE/${s + 1}`, note: "" });
      }
      const restockCount = Math.floor(rand() * 3);
      for (let r = 0; r < restockCount; r++) {
        ledger.push({ delta: 4 + Math.floor(rand() * 8), kind: "restock", reference: `SEED/RESTOCK/${r + 1}`, note: "" });
      }
      let stock = ledger.reduce((sum, entry) => sum + entry.delta, 0);
      if (stock < 0) {
        const cover = -stock + 5;
        ledger.push({ delta: cover, kind: "restock", reference: "SEED/RESTOCK/COVER", note: "" });
        stock += cover;
      }
      if (rand() < 0.2) {
        const adjustment = rand() < 0.5 ? -(1 + Math.floor(rand() * 2)) : 1 + Math.floor(rand() * 2);
        ledger.push({ delta: adjustment, kind: "adjustment", reference: "SEED/CYCLE-COUNT", note: "Cycle count correction" });
        stock += adjustment;
      }
      if (stock < 0) {
        const cover = -stock + 4;
        ledger.push({ delta: cover, kind: "restock", reference: "SEED/RESTOCK/COVER-2", note: "" });
        stock += cover;
      }

      const intro = spec.intros[i % spec.intros.length];
      const closing = spec.closings[i % spec.closings.length];
      const description = `${type.name} in the ${series} series, ${intro}.`;
      const longDescription =
        `${name} is ${intro}. Finished in ${spec.materials.toLowerCase()}. ` +
        `${closing} Each piece is inspected, numbered, and shipped flat-pack free wherever the design allows.`;

      const images = [
        photoUrl(PHOTO_POOL[(productOrdinal * 5 + 2) % PHOTO_POOL.length], 1200),
        photoUrl(PHOTO_POOL[(productOrdinal * 5 + 9) % PHOTO_POOL.length], 1200),
      ];

      products.push({
        id,
        name,
        slug: slugBase,
        collectionId: spec.id,
        price,
        description,
        longDescription,
        materials: spec.materials,
        dimensions: type.dimensions,
        images,
        stock,
        rating,
        reviewCount,
        featured: false, // assigned below so coverage is guaranteed
        isNew: rand() < 0.12,
        createdAt: new Date(CATALOG_BASE_DATE - productOrdinal * 86400000),
        ledger,
      });
      productOrdinal++;
    }
  }

  // Guarantee enough featured products for the homepage grid, deterministically.
  let promoteIndex = 0;
  while (products.filter((p) => p.featured).length < 10) {
    const candidate = products[(promoteIndex * 11) % products.length];
    candidate.featured = true;
    promoteIndex++;
  }

  // Three completed baseline imports, each with canonical snapshot coverage.
  const imports: GeneratedImport[] = [];
  for (let batch = 0; batch * SEED_BATCH_SIZE < products.length; batch++) {
    const start = batch * SEED_BATCH_SIZE;
    const end = Math.min(start + SEED_BATCH_SIZE, products.length);
    const month = ["03", "06", "08"][batch % 3];
    imports.push({
      id: `imp-2026-${month}${String(batch + 1).padStart(2, "0")}`,
      sourceFile: `${["spring", "summer", "autumn"][batch % 3]}-catalog-batch${batch + 1}.csv`,
      status: "completed",
      importedBy: "seed",
      startedAt: new Date(CATALOG_BASE_DATE - 40 * 86400000 + batch * 7 * 86400000),
      finishedAt: new Date(CATALOG_BASE_DATE - 40 * 86400000 + batch * 7 * 86400000 + 90 * 60000),
      productIds: products.slice(start, end).map((p) => p.id),
    });
  }

  return { collections, products, imports };
}

// Deterministic corruption target selection: 18 distinct products, spread
// evenly through the catalog (every 17th starting at 7), never overlapping.
export const CORRUPTION_TARGET_INDICES = Array.from({ length: 18 }, (_, i) => 7 + i * 17).filter(
  (i) => i < PRODUCTS_PER_COLLECTION * COLLECTIONS.length
);

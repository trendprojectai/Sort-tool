import { GoogleGenAI, Type } from "@google/genai";
import { OSMRestaurant, GoogleRestaurant } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getAISuggestions(unmatched: OSMRestaurant, candidates: GoogleRestaurant[]) {
  const prompt = `
You are an expert at matching restaurant names from different data sources.

OSM Restaurant:
Name: "${unmatched.name}"
Street: "${unmatched['addr:street'] || 'Unknown'}"
Cuisine: "${unmatched.cuisine || 'Unknown'}"

Potential matches from Google Maps:
${candidates.map((g, i) => `
${i + 1}. "${g.title}"
   Street: "${g.street || 'Unknown'}"
   Category: "${g.categoryName || 'Unknown'}"
`).join('\n')}

MATCHING RULES:
1. Strip these words before comparing: "Soho", "London", "Restaurant", "Bar", "Cafe", "Kitchen", "Grill", "The", "Street", "St"
2. Ignore punctuation: apostrophes ('), hyphens (-), periods (.)
3. Ignore case differences (Case-Insensitive)
4. Match if core names are >70% similar
5. Match if one name is contained in the other (e.g., "Violet" matches "Violet's Soho")
6. Street match is a BONUS but not required (OSM often has "Unknown Street")

CRITICAL EXAMPLE:
OSM: "Violet's" SHOULD match Google: "Violet's Soho (Georgian Cuisine)"
Core names: "violet" vs "violet" = EXACT MATCH ✅

Return JSON array (max 5 matches, confidence 50%+):
[
  {
    "index": 1,
    "confidence": 95,
    "reason": "Exact core name match after stripping suffixes (Violet's = Violet's Soho)",
    "source": "ai"
  }
]

If no matches found, return [].
BE EXTREMELY LENIENT - find matches even with slight variations or partial name overlaps!
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) return [];
    
    const cleanedText = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Gemini AI failed:", error);
    return [];
  }
}

/**
 * Deterministic Data Merger for TripAdvisor Fallback
 */
export async function deterministicMerge(originalData: any, tripAdvisorData: any) {
  const systemInstruction = `You are a deterministic data processing agent.
Rules:
- Never infer, guess, or hallucinate.
- Never overwrite existing data.
- Never remove fields.
- Never summarize or explain.
- Never change field names.

You must:
- Preserve all fields exactly as received.
- Use null for missing values.
- Output valid JSON only.
- Perform no reasoning.

If a value already exists, it must remain unchanged.

Your task:
- Merge TripAdvisor data ONLY into fields that are null in the original data
- Never overwrite existing values
- Preserve the full schema`;

  const prompt = `
Original Data:
${JSON.stringify(originalData, null, 2)}

TripAdvisor Fallback:
${JSON.stringify(tripAdvisorData, null, 2)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            google_place_id: { type: Type.STRING },
            cover_image: { type: Type.STRING, nullable: true },
            cover_image_alt: { type: Type.STRING, nullable: true },
            menu_url: { type: Type.STRING, nullable: true },
            menu_pdf_url: { type: Type.STRING, nullable: true },
            gallery_images: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
            phone: { type: Type.STRING, nullable: true },
            phone_formatted: { type: Type.STRING, nullable: true },
            email: { type: Type.STRING, nullable: true },
            instagram_handle: { type: Type.STRING, nullable: true },
            instagram_url: { type: Type.STRING, nullable: true },
            tiktok_handle: { type: Type.STRING, nullable: true },
            tiktok_url: { type: Type.STRING, nullable: true },
            tiktok_videos: { type: Type.ARRAY, items: { type: Type.OBJECT }, nullable: true },
            facebook_url: { type: Type.STRING, nullable: true },
            opening_hours: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
            cuisine_type: { type: Type.STRING, nullable: true },
            price_range: { type: Type.STRING, nullable: true }
          },
          required: ["google_place_id"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Deterministic merge failed:", error);
    return originalData;
  }
}

export async function getBulkAISuggestions(osmList: OSMRestaurant[], googleList: GoogleRestaurant[]) {
  const prompt = `
    You are an expert data matching agent. Your goal is to match "List A" (OSM) to "List B" (Google).
    These records represent physical restaurants.
    
    LIST A (OSM):
    ${osmList.map((item, i) => `[ID:${item['@id']}] Name: ${item.name} | Street: ${item['addr:street'] || 'N/A'}`).join('\n')}

    LIST B (Google):
    ${googleList.map((item, i) => `[Index:${i + 1}] Title: ${item.title} | Street: ${item.street || 'N/A'}`).join('\n')}

    LENIENT MATCHING RULES:
    1. STRIP common words like "Soho", "London", "Restaurant", "Bar", "Cafe", "Kitchen", "Grill", "The" before comparing.
    2. IGNORE punctuation (', -, .) and casing.
    3. ACCEPT partial matches where one name is a substring of the other (e.g., "Violet" matches "Violet's Soho").
    4. CORE NAME similarity should be the primary factor.
    5. Street match is preferred but NOT required if the core name is a strong match.

    EXPECTED BEHAVIOR:
    - "Violet's" should match "Violet's Soho (Georgian Cuisine)" with high confidence.
    - "Patty & Bun" should match "Patty&Bun Kingly Street".

    Return ONLY a JSON array. If no matches are found, return [].

    Expected Output Format:
    [
      {
        "osmId": "ID_FROM_LIST_A",
        "googleIndex": 1, // 1-based index from LIST B
        "confidence": 95,
        "reason": "Exact core name match after normalization",
        "source": "ai"
      }
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      }
    });

    const text = response.text;
    if (!text) return [];
    
    const cleanedText = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Gemini Bulk Sweep failed:", error);
    return [];
  }
}
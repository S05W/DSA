import type { TalentCategory, TalentValue } from "../models/Hero";

export const talentCategories: TalentCategory[] = [
  "Körpertalente",
  "Gesellschaftstalente",
  "Naturtalente",
  "Wissenstalente",
  "Handwerkstalente",
];

const talentNames: Record<TalentCategory, string[]> = {
  Körpertalente: [
    "Fliegen", "Gaukeleien", "Klettern", "Körperbeherrschung", "Kraftakt",
    "Reiten", "Schwimmen", "Selbstbeherrschung", "Singen", "Sinnesschärfe",
    "Tanzen", "Taschendiebstahl", "Verbergen", "Zechen",
  ],
  Gesellschaftstalente: [
    "Bekehren & Überzeugen", "Betören", "Einschüchtern", "Etikette", "Gassenwissen",
    "Menschenkenntnis", "Überreden", "Verkleiden", "Willenskraft",
  ],
  Naturtalente: [
    "Fährtensuchen", "Fesseln", "Fischen & Angeln", "Orientierung", "Pflanzenkunde",
    "Tierkunde", "Wildnisleben",
  ],
  Wissenstalente: [
    "Brett- & Glücksspiel", "Geographie", "Geschichtswissen", "Götter & Kulte",
    "Kriegskunst", "Magiekunde", "Mechanik", "Rechnen", "Rechtskunde",
    "Sagen & Legenden", "Sphärenkunde", "Sternkunde",
  ],
  Handwerkstalente: [
    "Alchimie", "Boote & Schiffe", "Fahrzeuge", "Handel", "Heilkunde Gift",
    "Heilkunde Krankheiten", "Heilkunde Seele", "Heilkunde Wunden", "Holzbearbeitung",
    "Lebensmittelbearbeitung", "Lederbearbeitung", "Malen & Zeichnen", "Metallbearbeitung",
    "Musizieren", "Schlösserknacken", "Steinbearbeitung", "Stoffbearbeitung",
  ],
};

const initialValues: Record<string, number> = {
  Magiekunde: 12,
  "Heilkunde Wunden": 8,
  Alchimie: 10,
  Sinnesschärfe: 7,
  Menschenkenntnis: 8,
};

export const createDefaultTalents = (): TalentValue[] =>
  talentCategories.flatMap((category) =>
    talentNames[category].map((name) => ({
      name,
      category,
      value: initialValues[name] ?? 0,
    })),
  );

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

const talentChecks: Record<string, string> = {
  Fliegen: "MU / IN / GE", Gaukeleien: "MU / CH / FF", Klettern: "MU / GE / KK", Körperbeherrschung: "GE / GE / KO", Kraftakt: "KO / KK / KK", Reiten: "CH / GE / KK", Schwimmen: "GE / KO / KK", Selbstbeherrschung: "MU / MU / KO", Singen: "KL / CH / KO", Sinnesschärfe: "KL / IN / IN", Tanzen: "KL / CH / GE", Taschendiebstahl: "MU / FF / GE", Verbergen: "MU / IN / GE", Zechen: "KL / KO / KK",
  "Bekehren & Überzeugen": "MU / KL / CH", Betören: "MU / CH / CH", Einschüchtern: "MU / IN / CH", Etikette: "KL / IN / CH", Gassenwissen: "KL / IN / CH", Menschenkenntnis: "KL / IN / CH", Überreden: "MU / IN / CH", Verkleiden: "IN / CH / GE", Willenskraft: "MU / IN / CH",
  Fährtensuchen: "MU / IN / GE", Fesseln: "KL / FF / KK", "Fischen & Angeln": "FF / GE / KO", Orientierung: "KL / IN / IN", Pflanzenkunde: "KL / FF / KO", Tierkunde: "MU / MU / CH", Wildnisleben: "MU / GE / KO",
  "Brett- & Glücksspiel": "KL / KL / IN", Geographie: "KL / KL / IN", Geschichtswissen: "KL / KL / IN", "Götter & Kulte": "KL / KL / IN", Kriegskunst: "MU / KL / IN", Magiekunde: "KL / KL / IN", Mechanik: "KL / KL / FF", Rechnen: "KL / KL / IN", Rechtskunde: "KL / KL / IN", "Sagen & Legenden": "KL / KL / IN", Sphärenkunde: "KL / KL / IN", Sternkunde: "KL / KL / IN",
  Alchimie: "MU / KL / FF", "Boote & Schiffe": "FF / GE / KK", Fahrzeuge: "CH / FF / KO", Handel: "KL / IN / CH", "Heilkunde Gift": "MU / KL / IN", "Heilkunde Krankheiten": "MU / KL / KO", "Heilkunde Seele": "IN / CH / KO", "Heilkunde Wunden": "KL / FF / FF", Holzbearbeitung: "FF / GE / KK", Lebensmittelbearbeitung: "IN / FF / FF", Lederbearbeitung: "FF / GE / KO", "Malen & Zeichnen": "IN / FF / FF", Metallbearbeitung: "FF / KO / KK", Musizieren: "CH / FF / KO", Schlösserknacken: "IN / FF / FF", Steinbearbeitung: "FF / KK / KK", Stoffbearbeitung: "KL / FF / FF",
};

export const talentCheckFor = (name: string) => talentChecks[name] ?? "KL / IN / CH";

export const createDefaultTalents = (): TalentValue[] =>
  talentCategories.flatMap((category) =>
    talentNames[category].map((name) => ({
      name,
      category,
      value: initialValues[name] ?? 0,
      check: talentCheckFor(name),
      ...(name === "Alchimie" ? {
        applications: "alchimistische Gifte, Elixiere, profane Alchimie",
        encumbrance: "ja",
        tools: "alchimistisches Labor",
        quality: "Der Trank weist eine bessere Qualität auf.",
        failedCheck: "Das Elixier ist misslungen oder eine Analyse hat kein Ergebnis gebracht.",
        criticalSuccess: "Der Held weiß exakt, welches Elixier er vor sich hat, welche Stufe es besitzt und wie lange haltbar es ist.",
        botch: "Das Elixier sorgt für einen unangenehmen Nebeneffekt.",
        improvementCost: "C",
      } : {}),
    })),
  );

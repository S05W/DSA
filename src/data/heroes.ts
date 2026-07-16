export type Hero = {
  id: number;
  name: string;
  profession: string;
  species: string;
  adventurePoints: number;
  lifePoints: number;
  astralPoints: number;
  description: string;
};

export const heroes: Hero[] = [
  {
    id: 1,
    name: "Aurelius von Gareth",
    profession: "Gildenmagier",
    species: "Mensch",
    adventurePoints: 1200,
    lifePoints: 25,
    astralPoints: 36,
    description:
      "Ein Feldmagier aus Gareth mit Interesse an Kampfmagie, Heilkunst und Alchemie.",
  },
];
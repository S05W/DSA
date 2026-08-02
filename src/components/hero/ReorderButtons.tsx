interface ReorderButtonsProps {
  index: number;
  length: number;
  label: string;
  onMove: (from: number, to: number) => void;
}

export default function ReorderButtons({ index, length, label, onMove }: ReorderButtonsProps) {
  return (
    <div className="reorder-buttons" aria-label={`Reihenfolge für ${label}`}>
      <button type="button" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`${label} nach oben verschieben`}>↑</button>
      <button type="button" disabled={index === length - 1} onClick={() => onMove(index, index + 1)} aria-label={`${label} nach unten verschieben`}>↓</button>
    </div>
  );
}

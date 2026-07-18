import type { DragEvent, PointerEvent } from "react";
import type { FogRect, GameMapSnapshot, MapToken } from "../../models/Map";

interface MapStageProps {
  snapshot: GameMapSnapshot;
  fogMode: "master" | "display";
  zoom?: number;
  preview?: FogRect | null;
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: PointerEvent<HTMLDivElement>) => void;
  onTokenDrop?: (heroId: string, x: number, y: number) => void;
}

function positionFromDrop(event: DragEvent<HTMLDivElement>) {
  const rectangle = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rectangle.left) / rectangle.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rectangle.top) / rectangle.height)),
  };
}

function Token({ token, movable }: { token: MapToken; movable: boolean }) {
  return <div className={`map-token${movable ? " movable" : ""}`} style={{ left: `${token.x * 100}%`, top: `${token.y * 100}%` }} draggable={movable} onDragStart={(event) => { if (movable) event.dataTransfer.setData("text/hero-id", token.heroId); }} title={`${token.heroName} · ${token.username}`}>
    {token.tokenVersion ? <img draggable={false} src={`/api/heroes/${encodeURIComponent(token.heroId)}/token?v=${token.tokenVersion}`} alt="" /> : <span>{token.initials}</span>}
    <b>{token.heroName}</b>
  </div>;
}

export default function MapStage({ snapshot, fogMode, zoom = 1, preview, onPointerDown, onPointerMove, onPointerUp, onTokenDrop }: MapStageProps) {
  const maskId = `fog-mask-${fogMode}`;
  const interactive = Boolean(onPointerDown || onTokenDrop);
  return <div className={`map-scroll-area map-scroll-${fogMode}`}><div className="map-stage" style={{ width: `${zoom * 100}%` }} onDragOver={(event) => { if (onTokenDrop) event.preventDefault(); }} onDrop={(event) => { if (!onTokenDrop) return; event.preventDefault(); const heroId = event.dataTransfer.getData("text/hero-id"); if (!heroId) return; const position = positionFromDrop(event); onTokenDrop(heroId, position.x, position.y); }}>
    <img className="map-background" draggable={false} src={`/api/map/image?v=${snapshot.imageVersion}`} alt="Spielkarte" />
    <svg className={`fog-overlay fog-${fogMode}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><mask id={maskId}><rect width="100" height="100" fill="white" />{snapshot.revealed.map((rect) => <rect key={rect.id} x={rect.x * 100} y={rect.y * 100} width={rect.width * 100} height={rect.height * 100} fill="black" />)}</mask></defs><rect width="100" height="100" mask={`url(#${maskId})`} /></svg>
    {preview && <div className="reveal-preview" style={{ left: `${preview.x * 100}%`, top: `${preview.y * 100}%`, width: `${preview.width * 100}%`, height: `${preview.height * 100}%` }} />}
    {snapshot.tokens.map((token) => <Token key={token.heroId} token={token} movable={Boolean(onTokenDrop)} />)}
    {interactive && <div className="map-interaction-layer" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} />}
  </div></div>;
}

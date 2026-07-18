import { useCallback, useEffect, useId, useRef, useState, type DragEvent, type PointerEvent } from "react";
import type { FogShape, GameMapSnapshot, MapImageMetrics, MapMonster, MapPin, MapToken } from "../../models/Map";

interface MapStageProps {
  snapshot: GameMapSnapshot;
  fogMode: "master" | "display";
  zoom?: number;
  preview?: FogShape | null;
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: PointerEvent<HTMLDivElement>) => void;
  onEntityDrop?: (kind: "hero" | "monster", entityId: string, x: number, y: number) => void;
  onMapPoint?: (x: number, y: number) => void;
  onPinSelect?: (pin: MapPin) => void;
  onMonsterSelect?: (monster: MapMonster) => void;
  onMetrics?: (metrics: MapImageMetrics) => void;
}

const pinIcons: Record<MapPin["type"], string> = { shop: "🛒", tavern: "🍺", place: "◆", npc: "♟", quest: "!", treasure: "✦", door: "↪", trap: "⚠" };

function positionFromEvent(event: { currentTarget: HTMLDivElement; clientX: number; clientY: number }) {
  const rectangle = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rectangle.left) / rectangle.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rectangle.top) / rectangle.height)),
  };
}

function FogShapeElement({ shape, preview = false }: { shape: FogShape; preview?: boolean }) {
  const fill = preview ? (shape.mode === "reveal" ? "rgba(64,190,112,.55)" : "rgba(205,63,58,.55)") : shape.mode === "reveal" ? "black" : "white";
  if (shape.shape === "rect") return <rect x={shape.x * 100} y={shape.y * 100} width={shape.width * 100} height={shape.height * 100} fill={fill} />;
  return <g>{shape.points.map((point, index) => <ellipse key={`${shape.id}-${index}`} cx={point.x * 100} cy={point.y * 100} rx={shape.radiusX * 100} ry={shape.radiusY * 100} fill={fill} />)}</g>;
}

function ResourceBars({ life, maxLife, astral, maxAstral, mode }: { life: number; maxLife: number; astral: number; maxAstral: number; mode: "numbers" | "bars" }) {
  const lifeWidth = Math.max(0, Math.min(100, maxLife ? (life / maxLife) * 100 : 0));
  const astralWidth = Math.max(0, Math.min(100, maxAstral ? (astral / maxAstral) * 100 : 0));
  return <div className={`map-resources map-resources-${mode}`}>
    <div title={`LeP ${life}/${maxLife}`}><span style={{ width: `${lifeWidth}%` }} />{mode === "numbers" && <b>LeP {life}/{maxLife}</b>}</div>
    {maxAstral > 0 && <div className="map-asp" title={`AsP ${astral}/${maxAstral}`}><span style={{ width: `${astralWidth}%` }} />{mode === "numbers" && <b>AsP {astral}/{maxAstral}</b>}</div>}
  </div>;
}

function EntityToken({ entity, movable, resourceMode, onMonsterSelect }: { entity: MapToken | MapMonster; movable: boolean; resourceMode: "numbers" | "bars" | "hidden"; onMonsterSelect?: (monster: MapMonster) => void }) {
  const monster = entity.kind === "monster";
  const id = monster ? entity.id : entity.heroId;
  const name = monster ? entity.name : entity.heroName;
  const tokenUrl = monster ? `/api/monsters/${encodeURIComponent(id)}/token?v=${entity.tokenVersion}` : `/api/heroes/${encodeURIComponent(id)}/token?v=${entity.tokenVersion}`;
  return <div className={`map-token map-token-${entity.kind}${movable ? " movable" : ""}${monster && !entity.visible ? " master-only" : ""}`} style={{ left: `${entity.x * 100}%`, top: `${entity.y * 100}%` }} draggable={movable} onDragStart={(event) => { if (movable) event.dataTransfer.setData("application/x-dsa-map-entity", JSON.stringify({ kind: entity.kind, id })); }} onClick={(event) => { if (monster && onMonsterSelect) { event.stopPropagation(); onMonsterSelect(entity); } }} title={monster ? name : `${name} · ${entity.username}`}>
    <div className="map-token-portrait">{entity.tokenVersion ? <img draggable={false} src={tokenUrl} alt="" /> : <span>{entity.initials}</span>}{!monster && entity.statusCount > 0 && <i title={`${entity.statusCount} Statuseffekte`}>!</i>}</div>
    <strong>{name}</strong>
    {resourceMode !== "hidden" && <ResourceBars life={entity.lifePoints} maxLife={entity.maxLifePoints} astral={entity.astralPoints} maxAstral={entity.maxAstralPoints} mode={resourceMode} />}
  </div>;
}

export default function MapStage({ snapshot, fogMode, zoom = 1, preview, onPointerDown, onPointerMove, onPointerUp, onEntityDrop, onMapPoint, onPinSelect, onMonsterSelect, onMetrics }: MapStageProps) {
  const rawId = useId();
  const maskId = `fog-mask-${rawId.replaceAll(":", "")}`;
  const scrollRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [openPin, setOpenPin] = useState<string | null>(null);
  const interactive = Boolean(onPointerDown || onMapPoint);

  const reportMetrics = useCallback(() => {
    const viewport = scrollRef.current; const image = imageRef.current;
    if (!viewport || !image?.naturalWidth || !onMetrics) return;
    onMetrics({ naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, viewportWidth: viewport.clientWidth, viewportHeight: viewport.clientHeight });
  }, [onMetrics]);

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport || !onMetrics) return;
    const observer = new ResizeObserver(reportMetrics);
    observer.observe(viewport);
    reportMetrics();
    return () => observer.disconnect();
  }, [onMetrics, reportMetrics]);

  const resourceMode = fogMode === "master" ? "numbers" : snapshot.resourceDisplay;
  return <div ref={scrollRef} className={`map-scroll-area map-scroll-${fogMode}`}><div className="map-stage" style={{ width: `${zoom * 100}%` }} onDragOver={(event) => { if (onEntityDrop) event.preventDefault(); }} onDrop={(event: DragEvent<HTMLDivElement>) => {
    if (!onEntityDrop) return; event.preventDefault();
    try {
      const entity = JSON.parse(event.dataTransfer.getData("application/x-dsa-map-entity")) as { kind: "hero" | "monster"; id: string };
      const position = positionFromEvent(event); onEntityDrop(entity.kind, entity.id, position.x, position.y);
    } catch { /* Kein DSA-Kartentoken. */ }
  }}>
    <img ref={imageRef} className="map-background" draggable={false} src={`/api/maps/${encodeURIComponent(snapshot.id)}/image?v=${snapshot.imageVersion}`} alt={snapshot.name} onLoad={reportMetrics} />
    <svg className={`fog-overlay fog-${fogMode}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><mask id={maskId}><rect width="100" height="100" fill="white" />{snapshot.fog.map((shape) => <FogShapeElement key={shape.id} shape={shape} />)}</mask></defs><rect width="100" height="100" mask={`url(#${maskId})`} /></svg>
    {preview && <svg className="fog-preview-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><FogShapeElement shape={preview} preview /></svg>}
    {snapshot.pins.map((pin) => <div key={pin.id} className={`map-pin map-pin-${pin.visibility}`} style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}><button type="button" title={pin.name} onClick={(event) => { event.stopPropagation(); setOpenPin(openPin === pin.id ? null : pin.id); onPinSelect?.(pin); }}>{pinIcons[pin.type]}</button>{openPin === pin.id && <div className="map-pin-card"><strong>{pin.name}</strong>{pin.description && <p>{pin.description}</p>}<small>{pin.visibility === "master" ? "Nur Meister" : "Für Spieler sichtbar"}</small></div>}</div>)}
    {snapshot.tokens.map((token) => <EntityToken key={token.heroId} entity={token} movable={Boolean(onEntityDrop)} resourceMode={resourceMode} />)}
    {snapshot.monsters.map((monster) => <EntityToken key={monster.id} entity={monster} movable={Boolean(onEntityDrop)} resourceMode={resourceMode} onMonsterSelect={onMonsterSelect} />)}
    {interactive && <div className="map-interaction-layer" onPointerDown={(event) => { if (onMapPoint && !onPointerDown) { const point = positionFromEvent(event); onMapPoint(point.x, point.y); } onPointerDown?.(event); }} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} />}
  </div></div>;
}

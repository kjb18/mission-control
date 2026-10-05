import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Time-based weekly calendar for the homepage (desktop). 07:00–21:00, 48px per
// hour. Untimed items (RFQ closings, deliveries, invoices, all-day events) sit
// in the fixed header; timed events are absolutely positioned in each day's
// column. Dragging a MIT or Hitlist task over a column shows a ghost chip
// snapped to 30 minutes; dropping calls onDropTask(label, source, ds, minutes).
// Styles: the tg-* rules in Home.css.

const START_H = 7;
const END_H = 21;
const HOUR_PX = 48;
const SNAP_MIN = 30;
const START_MIN = START_H * 60;
const END_MIN = END_H * 60;
const BODY_H = (END_H - START_H) * HOUR_PX;
const HOURS = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);

const manilaClock = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: false });
/** Minutes after midnight, Manila time, for a Date. */
export function manilaMinutes(date) {
  const [h, m] = manilaClock.format(date).split(":").map(Number);
  return (h % 24) * 60 + m;
}

const pxFor = (min) => ((min - START_MIN) / 60) * HOUR_PX;
const hourLabel = (h) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
export const timeLabel = (min) => {
  const h = Math.floor(min / 60);
  return `${h % 12 || 12}:${String(min % 60).padStart(2, "0")} ${h < 12 || h === 24 ? "AM" : "PM"}`;
};

/** Side-by-side lanes for overlapping events within one day. */
function layoutDay(items) {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out = [];
  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = [];
    cluster.forEach((it) => {
      let lane = lanes.findIndex((end) => end <= it.startMin);
      if (lane < 0) {
        lane = lanes.length;
        lanes.push(0);
      }
      lanes[lane] = it.endMin;
      it.lane = lane;
    });
    cluster.forEach((it) => {
      it.lanes = lanes.length;
    });
    out.push(...cluster);
    cluster = [];
  };
  sorted.forEach((it) => {
    if (cluster.length && it.startMin >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.endMin);
  });
  if (cluster.length) flush();
  return out;
}

/**
 * days: [{ ds, name, num, isToday, untimed: [{ ev, idx }], timed: [{ ev, idx }] }]
 *   timed ev: { t, l, start: Date, end: Date }
 * renderChip(ds, ev, idx): the existing clickable chip for untimed items.
 */
export default function WeekTimeGrid({ days, renderChip, onChipClick, onDropTask, onHeaderDrop, dragOverDay, setDragOverDay }) {
  const scrollRef = useRef(null);
  const [gutter, setGutter] = useState(0);
  const [nowMin, setNowMin] = useState(() => manilaMinutes(new Date()));
  const [drag, setDrag] = useState(null); // { label } while a task is being dragged
  const [ghost, setGhost] = useState(null); // { ds, min }

  // Current-time line, refreshed every minute.
  useEffect(() => {
    const id = setInterval(() => setNowMin(manilaMinutes(new Date())), 60000);
    return () => clearInterval(id);
  }, []);

  // Which task is being dragged: dragover can't read dataTransfer contents,
  // so capture the label at dragstart (after the source's own handler set it).
  useEffect(() => {
    const onStart = (e) => {
      const dt = e.dataTransfer;
      if (!dt || dt.types.includes("zone-drag")) return;
      const label = dt.getData("text/plain");
      if (label) setDrag({ label });
    };
    const onEnd = () => {
      setDrag(null);
      setGhost(null);
    };
    document.addEventListener("dragstart", onStart);
    document.addEventListener("dragend", onEnd);
    return () => {
      document.removeEventListener("dragstart", onStart);
      document.removeEventListener("dragend", onEnd);
    };
  }, []);

  // On load, scroll so the current time line sits ~3 hours below the top edge.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = pxFor(manilaMinutes(new Date())) - 3 * HOUR_PX;
    el.scrollTop = Math.max(0, Math.min(target, BODY_H - el.clientHeight));
  }, []);

  // Keep the fixed header aligned with the columns when the body has a scrollbar.
  useLayoutEffect(() => {
    const measure = () => {
      const el = scrollRef.current;
      if (el) setGutter(el.offsetWidth - el.clientWidth);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const slotAt = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const raw = START_MIN + ((e.clientY - rect.top) / HOUR_PX) * 60;
    const snapped = Math.round(raw / SNAP_MIN) * SNAP_MIN;
    return Math.max(START_MIN, Math.min(END_MIN - SNAP_MIN, snapped));
  };

  const nowVisible = nowMin >= START_MIN && nowMin <= END_MIN;

  return (
    <div className="tg-hscroll">
      <div className="tg">
        <div className="tg-head" style={{ paddingRight: gutter }}>
          <div className="tg-corner" />
          {days.map((d) => (
            <div
              key={d.ds}
              className={`tg-hday${dragOverDay === d.ds ? " drag-over-day" : ""}`}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("zone-drag")) return;
                e.preventDefault();
                setDragOverDay(d.ds);
              }}
              onDragLeave={() => setDragOverDay(null)}
              onDrop={(e) => !e.dataTransfer.types.includes("zone-drag") && onHeaderDrop(e, d.ds)}
            >
              <div className="wd-n">{d.name}</div>
              {d.isToday ? <div className="wd-tod">{d.num}</div> : <div className="wd-d">{d.num}</div>}
              {d.untimed.map(({ ev, idx }) => renderChip(d.ds, ev, idx))}
            </div>
          ))}
        </div>

        <div className="tg-scroll" ref={scrollRef}>
          <div className="tg-body" style={{ height: BODY_H }}>
            <div className="tg-hours">
              {HOURS.map((h) => (
                <div key={h} className="tg-hlabel" style={{ top: pxFor(h * 60) }}>
                  {hourLabel(h)}
                </div>
              ))}
            </div>

            {days.map((d) => {
              const placed = layoutDay(
                d.timed
                  .map(({ ev, idx }) => {
                    const startMin = manilaMinutes(ev.start);
                    const dur = Math.max(15, Math.round((ev.end - ev.start) / 60000) || 30);
                    return { ev, idx, startMin, endMin: startMin + dur };
                  })
                  .filter((p) => p.endMin > START_MIN && p.startMin < END_MIN)
              );
              return (
                <div
                  key={d.ds}
                  className={`tg-col${d.isToday ? " today" : ""}`}
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes("zone-drag")) return;
                    e.preventDefault();
                    const min = slotAt(e);
                    setGhost((g) => (g && g.ds === d.ds && g.min === min ? g : { ds: d.ds, min }));
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) setGhost((g) => (g?.ds === d.ds ? null : g));
                  }}
                  onDrop={(e) => {
                    if (e.dataTransfer.types.includes("zone-drag")) return;
                    e.preventDefault();
                    const min = slotAt(e);
                    const label = e.dataTransfer.getData("text/plain");
                    const source = e.dataTransfer.getData("source");
                    setGhost(null);
                    if (label?.trim()) onDropTask(label, source, d.ds, min);
                  }}
                >
                  {HOURS.map((h) => (
                    <div key={h} className="tg-hr" />
                  ))}

                  {placed.map(({ ev, idx, startMin, endMin, lane, lanes }) => {
                    const top = Math.max(0, pxFor(startMin));
                    const height = Math.max(20, pxFor(Math.min(endMin, END_MIN)) - top - 1);
                    return (
                      <div
                        key={`${idx}-${ev.l}`}
                        className={`tg-ev ev-${ev.t}`}
                        title={`${ev.l} · ${timeLabel(startMin)}`}
                        style={{ top, height, left: `calc(${(lane / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)` }}
                        onClick={() => onChipClick(d.ds, ev, idx)}
                      >
                        <span className="tg-ev-t">{ev.l}</span>
                        <span className="tg-ev-time">{timeLabel(startMin)}</span>
                      </div>
                    );
                  })}

                  {drag && ghost?.ds === d.ds && (
                    <div className="tg-ghost" style={{ top: pxFor(ghost.min), height: HOUR_PX / 2 - 1 }}>
                      <span className="tg-ev-t">{drag.label}</span>
                      <span className="tg-ev-time">{timeLabel(ghost.min)}</span>
                    </div>
                  )}
                </div>
              );
            })}

            {nowVisible && (
              <div className="tg-now" style={{ top: pxFor(nowMin) }}>
                <span className="tg-now-label">{timeLabel(nowMin)}</span>
                <span className="tg-now-dot" />
                <span className="tg-now-line" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/*
 * Flashlight icons for the scanner's torch button. The project has no icon library: its icons are
 * inline SVGs in the same style (24 px grid, 2 px round strokes, `currentColor`), so these follow it.
 * The state shows in the icon itself: off = outline; on = filled, with light rays above the head.
 * `data-icono` is only a hook for the tests.
 */

const COMUN = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
} as const;

export function LinternaApagadaIcon() {
  return (
    <svg {...COMUN} fill="none" data-icono="apagada">
      <path d="M7 4h10l-2 6H9z" />
      <rect x="9" y="10" width="6" height="11" rx="2" />
    </svg>
  );
}

export function LinternaEncendidaIcon() {
  return (
    <svg {...COMUN} fill="currentColor" data-icono="encendida">
      <path d="M7 4h10l-2 6H9z" />
      <rect x="9" y="10" width="6" height="11" rx="2" />
      <path d="M12 0.8v1.4M4.8 2.6l1.2 1M19.2 2.6l-1.2 1" fill="none" />
    </svg>
  );
}

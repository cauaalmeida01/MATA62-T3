import { SVGProps } from 'react';

/** Ícones de traço simples (estilo do protótipo), desenhados inline para não depender de biblioteca. */
type P = SVGProps<SVGSVGElement>;

const base = (props: P, d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden width={18} height={18} {...props}>
    {d}
  </svg>
);

export const IconeEmail = (p: P) => base(p, <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>);
export const IconeCadeado = (p: P) => base(p, <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>);
export const IconeGlobo = (p: P) => base(p, <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>);
export const IconeHash = (p: P) => base(p, <path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16" />);
export const IconeLista = (p: P) => base(p, <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9h10M7 13h10M7 17h6" /></>);
export const IconeMais = (p: P) => base(p, <path d="M12 5v14M5 12h14" />);
export const IconeSeta = (p: P) => base(p, <path d="M5 12h14M13 6l6 6-6 6" />);
export const IconeSair = (p: P) => base(p, <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>);
export const IconeMoedas = (p: P) => base(p, <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>);
export const IconeCamera = (p: P) => base(p, <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>);
export const IconeEscudo = (p: P) => base(p, <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />);
export const IconeCheck = (p: P) => base(p, <path d="m5 12 5 5 9-10" />);
export const IconeGirar = (p: P) => base(p, <><path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3" /><path d="M4 4v4h4M20 20v-4h-4" /></>);
export const IconeBusca = (p: P) => base(p, <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>);
export const IconeVoltar = (p: P) => base(p, <path d="M19 12H5M11 6l-6 6 6 6" />);
export const IconeAlerta = (p: P) => base(p, <><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" /></>);

/** Marca do Veridit: carimbo branco num círculo laranja, como no protótipo. */
export function Marca({ claro = false }: { claro?: boolean }) {
  return (
    <span className={`flex items-center gap-2.5 text-xl font-bold ${claro ? 'text-white' : 'text-marinho'}`}>
      <svg viewBox="0 0 32 32" width={32} height={32} aria-hidden>
        <circle cx="16" cy="16" r="16" fill="#c2410c" />
        <circle cx="16" cy="11" r="3.6" fill="#fff" />
        <path d="M14 14h4v4h4.5a1.5 1.5 0 0 1 1.5 1.5V21H8v-1.5A1.5 1.5 0 0 1 9.5 18H14z" fill="#fff" />
        <rect x="9" y="22.5" width="14" height="1.8" rx=".9" fill="#fff" />
      </svg>
      Veridit
    </span>
  );
}

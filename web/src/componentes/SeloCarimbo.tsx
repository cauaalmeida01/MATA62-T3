import { FonteCarimbo } from '../api/tipos';

/**
 * Mostra de onde veio a hora do registro. O contrato exige que o relatório diga
 * se o carimbo é de terceiro (FreeTSA) ou do relógio local, usado quando a FreeTSA não respondeu.
 */
export function SeloCarimbo({ fonte, compacto }: { fonte: FonteCarimbo; compacto?: boolean }) {
  const terceiro = fonte === 'FREETSA';
  const texto = terceiro ? 'Carimbo FreeTSA' : 'Hora do relógio local';
  const explicacao = terceiro
    ? 'Data e hora atestadas por uma autoridade de carimbo do tempo (RFC 3161).'
    : 'A autoridade de carimbo não respondeu; a hora veio do relógio do servidor e tem menos força de prova.';

  return (
    <span
      title={compacto ? explicacao : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        terceiro ? 'bg-selo-claro text-selo' : 'bg-alerta-claro text-alerta'
      }`}
    >
      <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3">
        {terceiro ? (
          <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        ) : (
          <path d="M6 2.5v4M6 8.6v.9" fill="none" stroke="currentColor" strokeWidth="1.6" />
        )}
      </svg>
      {texto}
      {!compacto && <span className="sr-only">. {explicacao}</span>}
    </span>
  );
}

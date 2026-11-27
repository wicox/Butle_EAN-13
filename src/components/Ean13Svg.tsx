import React, { useMemo } from 'react';
import { encodeEan13Modules, EAN13_QUIET_LEFT_MODULES, EAN13_TOTAL_MODULES, validateEan13 } from '../utils/ean13';

interface Ean13SvgProps {
  code: string;
  barWidthPx: number;
  className?: string;
}

/**
 * Renders a razor-sharp SVG EAN-13 barcode where the span from the FIRST black bar
 * to the LAST black bar equals exactly `barWidthPx`.
 */
export const Ean13Svg: React.FC<Ean13SvgProps> = ({ code, barWidthPx, className = '' }) => {
  const encoded = useMemo(() => {
    const res = validateEan13(code);
    if (!res.valid) return null;
    try {
      return encodeEan13Modules(res.normalized);
    } catch {
      return null;
    }
  }, [code]);

  if (!encoded) {
    return (
      <div className="flex h-28 w-full items-center justify-center border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-xs text-slate-500">
        Wprowadź lub odczytaj poprawny 13-cyfrowy kod EAN-13, aby wygenerować podgląd.
      </div>
    );
  }

  // Exact proportions matching renderEan13ToPng
  const moduleUnits = 1;
  const totalWidthUnits = EAN13_TOTAL_MODULES * moduleUnits; // 113
  const barSpanUnits = 95 * moduleUnits;
  const topMargin = 2.5;
  const regularBarH = barSpanUnits * 0.56; // 53.2
  const guardExtension = 5;
  const digitBandH = 11.5;
  const totalHeightUnits = topMargin + regularBarH + guardExtension + digitBandH;

  // Scale total SVG pixel width so 95 bar modules = barWidthPx
  const totalWidthPx = barWidthPx * (EAN13_TOTAL_MODULES / 95);
  const totalHeightPx = totalWidthPx * (totalHeightUnits / totalWidthUnits);

  const rects: Array<{ x: number; h: number }> = [];
  for (let i = 0; i < encoded.modules.length; i++) {
    if (encoded.modules[i] === 1) {
      rects.push({
        x: EAN13_QUIET_LEFT_MODULES + i,
        h: encoded.isGuard[i] ? regularBarH + guardExtension : regularBarH,
      });
    }
  }

  const digitY = topMargin + regularBarH + 9.2;
  const startX = EAN13_QUIET_LEFT_MODULES;

  return (
    <svg
      width={totalWidthPx}
      height={totalHeightPx}
      viewBox={`0 0 ${totalWidthUnits} ${totalHeightUnits}`}
      className={`block bg-white select-none ${className}`}
      role="img"
      aria-label={`Kod kreskowy EAN-13: ${encoded.code}`}
    >
      <rect x={0} y={0} width={totalWidthUnits} height={totalHeightUnits} fill="#FFFFFF" />
      <g fill="#000000">
        {rects.map((r, idx) => (
          <rect key={idx} x={r.x} y={topMargin} width={1.01} height={r.h} />
        ))}
      </g>
      <g
        fill="#000000"
        fontFamily="'JetBrains Mono', 'Courier New', monospace"
        fontWeight="600"
        fontSize="9.2"
        textAnchor="middle"
      >
        <text x={EAN13_QUIET_LEFT_MODULES * 0.52} y={digitY}>
          {encoded.code[0]}
        </text>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <text key={`L${i}`} x={startX + 3 + i * 7 + 3.5} y={digitY}>
            {encoded.code[1 + i]}
          </text>
        ))}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <text key={`R${i}`} x={startX + 50 + i * 7 + 3.5} y={digitY}>
            {encoded.code[7 + i]}
          </text>
        ))}
      </g>
    </svg>
  );
};

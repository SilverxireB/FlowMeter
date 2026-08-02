/**
 * Flow yükleniyor göstergesi — markanın O halkası.
 *
 * Neden PNG değil: logo dosyasının içinde ürün glifi (kamera, bar-chart…) var;
 * onu döndürmek tuhaf duruyor. Burada YALNIZ halka çizilir — dört yay, logonun
 * kendi renkleriyle, iki yarıçapta (dışta mavi+kırmızı, içte turuncu+yeşil).
 * SVG olduğu için her boyutta net, ek istek yok.
 */
const ARCS = [
  { r: 20, color: "#2094f3", dash: "52 74", rot: -140 }, // dış — mavi
  { r: 20, color: "#d62027", dash: "52 74", rot: 40 }, // dış — kırmızı
  { r: 13, color: "#f0913a", dash: "34 54", rot: 110 }, // iç — turuncu
  { r: 13, color: "#1b7d3a", dash: "34 54", rot: -70 }, // iç — yeşil
] as const;

export default function FlowSpinner({
  size = 40,
  className = "",
  label = "Yükleniyor",
  center,
}: {
  size?: number;
  className?: string;
  label?: string;
  /** Halkanın ORTASINDA duran içerik (ör. yüzde). Dönmez — yalnız halka döner. */
  center?: React.ReactNode;
}) {
  const ring = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={`animate-spin ${className}`}
      style={{ animationDuration: "1.1s" }}
      role="status"
      aria-label={label}
    >
      <g fill="none" strokeLinecap="round" strokeWidth={5}>
        {ARCS.map((a, i) => (
          <circle
            key={i}
            cx="24"
            cy="24"
            r={a.r}
            stroke={a.color}
            strokeDasharray={a.dash}
            transform={`rotate(${a.rot} 24 24)`}
          />
        ))}
      </g>
    </svg>
  );

  if (center === undefined) return ring;
  return (
    <span className="relative inline-grid place-items-center shrink-0" style={{ width: size, height: size }}>
      {ring}
      <span className="absolute inset-0 grid place-items-center leading-none">{center}</span>
    </span>
  );
}

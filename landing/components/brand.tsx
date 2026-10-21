import { brandIdentity } from "./brand-identity";

export function Brand({
  large = false,
  inverse = false,
}: {
  large?: boolean;
  inverse?: boolean;
}) {
  const markColor = inverse
    ? brandIdentity.colors.mint
    : brandIdentity.colors.green;
  const textColor = inverse
    ? brandIdentity.colors.mint
    : brandIdentity.colors.forest;
  return (
    <a
      className={`brand${large ? " brand-large" : ""}`}
      href="#top"
      aria-label="Subloom home"
    >
      <svg
        className="brand-lockup"
        viewBox={`0 0 ${brandIdentity.lockupWidth} 64`}
        aria-hidden="true"
      >
        <path d={brandIdentity.markPath} className={inverse ? "brand-inverse" : "brand-mark"} fill={markColor} />
        <path
          d={brandIdentity.wordmarkPath}
          transform={`translate(${brandIdentity.wordmarkOffsetX} 0)`}
          className={inverse ? "brand-inverse" : "brand-wordmark"} fill={textColor}
        />
      </svg>
    </a>
  );
}

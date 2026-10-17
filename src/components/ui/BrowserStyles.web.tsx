import { useTheme } from "../../theme/useTheme";
export function BrowserStyles() {
  const { colors } = useTheme();
  return (
    <style>{`
    :root { --subloom-focus: ${colors.primary}; --subloom-selection: ${colors.mintStrong}; --subloom-text: ${colors.text}; scrollbar-color: ${colors.secondary} ${colors.background}; }
    ::selection { background: var(--subloom-selection); color: var(--subloom-text); }
    input, textarea { caret-color: var(--subloom-focus); }
    [role="button"]:focus-visible, button:focus-visible, [role="tab"]:focus-visible, [role="radio"]:focus-visible { outline: 2px solid var(--subloom-focus); outline-offset: 3px; }
    @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
  `}</style>
  );
}

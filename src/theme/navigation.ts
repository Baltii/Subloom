// Keep a full touch/label area above either gesture or three-button navigation.
export function bottomTabLayout(bottomInset: number) {
  const paddingBottom = Math.max(12, bottomInset);
  return { height: 60 + paddingBottom, paddingTop: 9, paddingBottom };
}

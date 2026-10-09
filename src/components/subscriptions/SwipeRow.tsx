import type { ReactNode } from "react";
import type { Subscription } from "../../domain/models";
export function SwipeRow({
  children,
}: {
  children: ReactNode;
  subscription: Subscription;
}) {
  return <>{children}</>;
}

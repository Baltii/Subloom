import { Platform } from "react-native";

type Bridge = {
  version: number;
  request: (message: unknown) => Promise<unknown>;
};
export function macosBridge(): Bridge | null {
  if (Platform.OS !== "web") return null;
  const bridge = (globalThis as typeof globalThis & { subloomMac?: Bridge })
    .subloomMac;
  return bridge?.version === 1 && typeof bridge.request === "function"
    ? bridge
    : null;
}
export async function macosRequest<T>(
  op: string,
  args: object = {},
): Promise<T> {
  const bridge = macosBridge();
  if (!bridge) throw new Error("Open the standalone Subloom Mac app first.");
  return (await bridge.request({ op, ...args })) as T;
}

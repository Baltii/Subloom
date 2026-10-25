import { Redirect } from "expo-router";

/** Preserve old links without exposing the retired receipt forwarding tool. */
export default function Sources() {
  return (
    <Redirect href={{ pathname: "/settings", params: { section: "Tools" } }} />
  );
}

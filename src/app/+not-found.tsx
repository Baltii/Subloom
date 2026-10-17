import { router } from "expo-router";
import { Button, Label, Page } from "../components/ui/Primitives";
export default function NotFound() {
  return (
    <Page
      title="This page is unavailable."
      subtitle="Return to your subscriptions to continue."
    >
      <Label>The page may have moved or is no longer part of Subloom.</Label>
      <Button onPress={() => router.replace("/")}>Go to overview</Button>
    </Page>
  );
}

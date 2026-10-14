import { Button, Label } from "../ui/Primitives";
export function FinanceState({
  loaded,
  error,
  reload,
}: {
  loaded: boolean;
  error: string | null;
  reload: () => Promise<void>;
}) {
  return error ? (
    <>
      <Label>{error}</Label>
      <Button variant="secondary" onPress={() => void reload()}>
        Reload financial records
      </Button>
    </>
  ) : !loaded ? (
    <Label>Loading financial records…</Label>
  ) : null;
}

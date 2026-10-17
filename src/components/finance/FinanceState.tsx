import { Button, Label } from "../ui/Primitives";
import { FinanceError } from "./FinanceError";
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
      <FinanceError message={error} />
      <Button variant="secondary" onPress={() => void reload()}>
        Reload financial records
      </Button>
    </>
  ) : !loaded ? (
    <Label>Loading financial records…</Label>
  ) : null;
}

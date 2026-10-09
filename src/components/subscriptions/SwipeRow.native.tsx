import { useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import Swipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { useReducedMotion } from "react-native-reanimated";
import type { Subscription } from "../../domain/models";
import { changeStatus } from "../../store/app";
import { Button, Confirm } from "../ui/Primitives";

export function SwipeRow({
  children,
  subscription: s,
}: {
  children: ReactNode;
  subscription: Subscription;
}) {
  const ref = useRef<SwipeableMethods>(null),
    reduced = useReducedMotion();
  const [confirm, setConfirm] = useState(false);
  if (!["active", "trial", "paused"].includes(s.status) || reduced)
    return <>{children}</>;
  const resume = s.status === "paused";
  return (
    <>
      <Swipeable
        ref={ref}
        friction={2}
        overshootRight={false}
        rightThreshold={45}
        renderRightActions={() => (
          <View style={{ justifyContent: "center", paddingHorizontal: 8 }}>
            <Button
              small
              variant="secondary"
              onPress={() => {
                ref.current?.close();
                setConfirm(true);
              }}
            >
              {resume ? "Resume" : "Pause"}
            </Button>
          </View>
        )}
      >
        {children}
      </Swipeable>
      <Confirm
        visible={confirm}
        title={(resume ? "Resume " : "Pause ") + s.name + "?"}
        body={
          resume
            ? "This restores the subscription to your recurring estimates and reminder schedule."
            : "This stops tracking and reminders in Subloom. Your provider will continue billing until you cancel with them."
        }
        action={resume ? "Resume tracking" : "Pause tracking"}
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          await changeStatus(
            s.id,
            resume ? (s.trialEnd ? "trial" : "active") : "paused",
          );
          setConfirm(false);
        }}
      />
    </>
  );
}

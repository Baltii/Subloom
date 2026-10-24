import { useState, type ReactNode } from "react";
import { Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { ProPage } from "../../app/pro";
import { ProAccessContext, type ProFeature } from "../../hooks/useProAccess";
import { useApp } from "../../store/app";
import { useTheme } from "../../theme/useTheme";

export function ProAccessProvider({ children }: { children: ReactNode }) {
  const identity = useApp((state) => state.identity);
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [request, setRequest] = useState<{
    identity: string;
    feature: ProFeature;
  } | null>(null);
  if (request && request.identity !== identity) setRequest(null);
  const close = () => setRequest(null);
  return (
    <ProAccessContext.Provider
      value={(feature) => setRequest({ identity, feature })}
    >
      {children}
      <Modal
        accessibilityLabel="Subloom Pro"
        visible={request?.identity === identity}
        animationType={reduced ? "none" : "slide"}
        presentationStyle="fullScreen"
        onRequestClose={close}
      >
        <SafeAreaView
          accessibilityViewIsModal
          style={{ flex: 1, backgroundColor: colors.background }}
        >
          {request?.identity === identity && (
            <ProPage
              key={identity}
              identity={identity}
              feature={request.feature}
              onClose={close}
            />
          )}
        </SafeAreaView>
      </Modal>
    </ProAccessContext.Provider>
  );
}

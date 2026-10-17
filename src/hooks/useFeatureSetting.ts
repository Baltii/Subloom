import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useFocusEffect } from "expo-router";
import { useApp, readableError } from "../store/app";
import { readSetting, writeSetting } from "../services/featureSettings";
export function useFeatureSetting<T>(
  key: string,
  schema: z.ZodType<T>,
  initial: T,
  refreshOnFocus = true,
) {
  const identity = useApp((s) => s.identity),
    demo = useApp((s) => s.data.demo);
  const [state, setState] = useState<{
    identity: string;
    value: T;
    version: number;
    loaded: boolean;
    error: string | null;
  }>({ identity, value: initial, version: 0, loaded: false, error: null });
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const saving = useRef(false);
  const reload = useCallback(async () => {
    const current = ++generation.current;
    setState({
      identity,
      value: initial,
      version: 0,
      loaded: false,
      error: null,
    });
    try {
      const result = await readSetting(identity, key, schema, initial);
      if (current === generation.current)
        setState({ identity, ...result, loaded: true, error: null });
    } catch (e) {
      if (current === generation.current)
        setState({
          identity,
          value: initial,
          version: 0,
          loaded: false,
          error: readableError(e),
        });
    }
  }, [identity, key, schema, initial]);
  useEffect(() => {
    const revision = generation;
    let alive = true;
    void Promise.resolve().then(() => {
      if (alive && !refreshOnFocus) return reload();
    });
    return () => {
      alive = false;
      revision.current++;
    };
  }, [reload, refreshOnFocus]);
  useFocusEffect(
    useCallback(() => {
      if (refreshOnFocus) void reload();
      return () => {
        if (refreshOnFocus) generation.current++;
      };
    }, [reload, refreshOnFocus]),

  );
  const save = async (value: T) => {
    if (
      demo ||
      saving.current ||
      busy ||
      !state.loaded ||
      state.identity !== identity ||
      useApp.getState().identity !== identity
    )
      throw new Error(
        "Reload your settings before saving. Leave demo mode to edit.",
      );
    const current = generation.current;
    saving.current = true;
    setBusy(true);
    try {
      const version = await writeSetting(
        identity,
        key,
        schema,
        value,
        state.version,
      );
      if (current === generation.current)
        setState({
          ...state,
          value: schema.parse(value),
          version,
          error: null,
        });
    } catch (error) {
      if (current === generation.current)
        setState({ ...state, loaded: false, error: readableError(error) });
      throw error;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  return {
    value: state.identity === identity ? state.value : initial,
    loaded: state.identity === identity && state.loaded,
    error: state.identity === identity ? state.error : null,
    busy,
    save,
    reload,
  };
}

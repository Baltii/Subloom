import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { supabase } from "./supabase";
export async function importTextFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["text/plain", "text/html"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const file = result.assets[0];
  if (!file || (file.size ?? 0) > 100_000)
    throw new Error("Choose a text receipt under 100 KB.");
  const text =
    Platform.OS === "web"
      ? await (await fetch(file.uri)).text()
      : await new File(file.uri).text();
  if (text.length > 100_000)
    throw new Error("Choose a text receipt under 100 KB.");
  return text;
}
export type ReceiptImage = { uri: string; base64: string; mime: string };
export async function chooseReceiptImage(): Promise<ReceiptImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    base64: true,
    quality: 0.8,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.base64)
    throw new Error(
      "This image could not be read. Try a JPEG or PNG screenshot.",
    );
  if (asset.base64.length > 7_000_000 || (asset.fileSize ?? 0) > 5_000_000)
    throw new Error("Choose a screenshot under 5 MB.");
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(
      asset.mimeType || "image/jpeg",
    )
  )
    throw new Error("Choose a JPEG, PNG, or WebP receipt.");
  return {
    uri: asset.uri,
    base64: asset.base64,
    mime: asset.mimeType || "image/jpeg",
  };
}
export async function recognizeReceipt(image: ReceiptImage): Promise<string> {
  if (!supabase)
    throw new Error(
      "Screenshot reading needs the configured OCR backend. You can paste receipt text now.",
    );
  const { data, error } = await supabase.functions.invoke("process-detection", {
    body: { image: image.base64, mime: image.mime },
  });
  if (error)
    throw new Error(
      "Screenshot reading is unavailable. Check your account and OCR configuration, or paste the text.",
    );
  if (typeof data?.text !== "string")
    throw new Error("No readable text was returned. Try a clearer image.");
  return data.text;
}

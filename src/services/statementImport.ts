import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
export async function chooseStatementCsv(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["text/csv", "text/plain", "application/vnd.ms-excel"],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0]!;
  const file = Platform.OS === "web" ? null : new File(asset.uri);
  if ((asset.size ?? file?.size ?? 0) > 2_000_000)
    throw new Error("Choose a CSV smaller than 2 MB.");
  const text = file ? await file.text() : await (await fetch(asset.uri)).text();
  if (text.length > 2_000_000)
    throw new Error("Choose a CSV smaller than 2 MB.");
  return text;
}

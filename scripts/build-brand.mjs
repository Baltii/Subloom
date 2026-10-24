import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const check = process.argv.includes("--check");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const runtimeManifestPath = "scripts/brand-runtime-manifest.json";

// CI validates the committed product assets without needing the private brand kit.
if (check) {
  const manifest = JSON.parse(await readFile(path.join(root, runtimeManifestPath), "utf8"));
  for (const [file, expectedHash] of Object.entries(manifest.files)) {
    if (hash(await readFile(path.join(root, file))) !== expectedHash)
      throw new Error(`Modified runtime brand export: ${file}`);
  }
  console.log(`Runtime brand consistency passed: ${Object.keys(manifest.files).length} product assets.`);
}

const masterPath = "brand/source/identity.json";
try {
  await access(path.join(root, masterPath));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  if (check) process.exit(0);
  throw new Error("Restore the private brand workspace to regenerate assets. Use --check to verify the committed product assets.");
}
const masterSource = await readFile(path.join(root, masterPath), "utf8");
const identity = JSON.parse(masterSource);
const { mark, wordmark, colors } = identity;
const files = new Map();
const markBody = (fill) =>
  `<path fill="${fill}" d="${mark.path}"/>`;
const svg = (viewBox, body, width, height) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${width ? ` width="${width}" height="${height}"` : ""}><title>Subloom</title>${body}</svg>\n`;
const logo = (symbolColor, textColor) =>
  svg(
    `0 0 ${wordmark.lockupWidth} 64`,
    `${markBody(symbolColor)}<path d="${wordmark.path}" transform="translate(${wordmark.offsetX} 0)" fill="${textColor}"/>`,
  );
function withOrigin(png) {
  if (png.includes(Buffer.from("impeccable:prompt\0"))) return png;
  const data = Buffer.from(`impeccable:prompt\0Origin: deterministic Subloom Fourfold Bloom ${identity.version} vector export from ${masterPath}.`);
  const type = Buffer.from("tEXt");
  const body = Buffer.concat([type, data]);
  let crc = 0xffffffff;
  for (const byte of body) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([png.subarray(0, -12), length, body, checksum, png.subarray(-12)]);
}
const add = (file, value) => files.set(file, Buffer.isBuffer(value) && file.endsWith(".png") ? withOrigin(value) : value);
add("brand/source/subloom-master.svg", logo(colors.green, colors.forest));

for (const [variant, symbolColor, textColor] of [
  ["primary", colors.green, colors.forest],
  ["forest", colors.forest, colors.forest],
  ["inverse", colors.mint, colors.mint],
  ["black", "#000000", "#000000"],
  ["white", colors.white, colors.white],
]) {
  add(`brand/logos/subloom-logo-${variant}.svg`, logo(symbolColor, textColor));
  add(
    `brand/logos/subloom-mark-${variant}.svg`,
    svg(mark.viewBox, markBody(symbolColor)),
  );
  add(
    `brand/logos/subloom-wordmark-${variant}.svg`,
    svg(wordmark.viewBox, `<path d="${wordmark.path}" fill="${textColor}"/>`),
  );
}
const icon = (size, slot, fill, background, rounded = false) => {
  const offset = (size - slot) / 2;
  return svg(
    `0 0 ${size} ${size}`,
    `${background ? `<rect width="${size}" height="${size}"${rounded ? ` rx="${size * 0.23}"` : ""} fill="${background}"/>` : ""}<g transform="translate(${offset} ${offset}) scale(${slot / 64})">${markBody(fill)}</g>`,
    size,
    size,
  );
};
add(
  "brand/icons/subloom-app-icon.svg",
  icon(1024, 896, colors.mint, colors.green),
);
add(
  "brand/icons/subloom-adaptive-foreground.svg",
  icon(1080, 720, colors.mint),
);
add(
  "brand/icons/subloom-adaptive-monochrome.svg",
  icon(1080, 720, colors.white),
);
add("brand/icons/subloom-splash.svg", icon(512, 440, colors.green));
add("brand/icons/subloom-splash-dark.svg", icon(512, 440, colors.mint));
add(
  "brand/icons/subloom-favicon.svg",
  icon(64, 72, colors.mint, colors.green, true),
);

const constants = `// Generated from ${masterPath}. Run node scripts/build-brand.mjs; do not redraw.\nexport const brandIdentity = ${JSON.stringify({ version: identity.version, markPath: mark.path, wordmarkPath: wordmark.path, lockupWidth: wordmark.lockupWidth, wordmarkOffsetX: wordmark.offsetX, colors }, null, 2)} as const;\n`;
add("src/brand/identity.ts", constants);
add(
  "brand/tokens/brand.json",
  JSON.stringify(
    {
      name: identity.name,
      version: identity.version,
      colors,
      typography: identity.typography,
      spacing: identity.spacing,
      radius: identity.radius,
      motion: identity.motion,
    },
    null,
    2,
  ) + "\n",
);
add(
  "brand/tokens/brand.css",
  `/* Canonical Subloom identity v${identity.version}; UI status/accent tokens remain separate. */\n:root {\n${Object.entries(
    colors,
  )
    .map(
      ([key, value]) =>
        `  --subloom-${key.replace(/[A-Z]/g, (v) => `-${v.toLowerCase()}`)}: ${value};`,
    )
    .join(
      "\n",
    )}\n  --subloom-font-display: "Manrope", sans-serif;\n  --subloom-font-body: "DM Sans", sans-serif;\n}\n`,
);

if (check) {
  const manifest = JSON.parse(
    await readFile(path.join(root, "brand/manifest.json"), "utf8"),
  );
  if (manifest.sourceHash !== hash(masterSource))
    throw new Error("Brand master changed: regenerate the kit.");
  for (const [file, expected] of files)
    if ((await readFile(path.join(root, file), "utf8")) !== expected)
      throw new Error(`Stale brand export: ${file}`);
  for (const [file, expectedHash] of Object.entries(manifest.files))
    if (hash(await readFile(path.join(root, file))) !== expectedHash)
      throw new Error(`Modified brand export: ${file}`);
  console.log(
    `Brand consistency passed: ${files.size} vector/token/component exports and ${Object.keys(manifest.files).length} manifest entries match the master.`,
  );
} else {
  // Optional tool for regenerating the private brand kit; runtime verification needs no sharp.
  let sharp;
  try {
    sharp = createRequire(path.join(root, "package.json"))("sharp");
  } catch {
    throw new Error("Regenerating the private brand kit requires sharp: npm install --no-save sharp");
  }
  for (const variant of ["primary", "inverse", "forest", "black", "white"])
    for (const shape of ["logo", "mark", "wordmark"]) {
      const filename = `brand/logos/subloom-${shape}-${variant}`;
      const output = await sharp(Buffer.from(files.get(`${filename}.svg`)))
        .resize({ width: shape === "mark" ? 1024 : 2400 })
        .png()
        .withMetadata({
          exif: {
            IFD0: {
              ImageDescription: `Origin: deterministic vector export from Subloom Fourfold Bloom ${identity.version}; ${masterPath}.`,
            },
          },
        })
        .toBuffer();
      add(`${filename}.png`, output);
    }
  for (const name of [
    "app-icon",
    "adaptive-foreground",
    "adaptive-monochrome",
    "splash",
    "splash-dark",
  ]) {
    const image = sharp(Buffer.from(files.get(`brand/icons/subloom-${name}.svg`)));
    if (name === "app-icon") image.removeAlpha();
    add(
      `brand/icons/subloom-${name}.png`,
      await image
        .png()
        .withMetadata({
          exif: {
            IFD0: {
              ImageDescription: `Origin: canonical Subloom Fourfold Bloom vector master ${identity.version}.`,
            },
          },
        })
        .toBuffer(),
    );
  }
  add("assets/icon.png", files.get("brand/icons/subloom-app-icon.png"));
  add(
    "assets/adaptive-icon.png",
    files.get("brand/icons/subloom-adaptive-foreground.png"),
  );
  add(
    "assets/monochrome-icon.png",
    files.get("brand/icons/subloom-adaptive-monochrome.png"),
  );
  add("assets/splash-mark.png", files.get("brand/icons/subloom-splash.png"));
  add(
    "assets/splash-mark-dark.png",
    files.get("brand/icons/subloom-splash-dark.png"),
  );
  for (const size of [16, 32, 48, 180, 192, 512])
    add(
      `brand/icons/subloom-favicon-${size}.png`,
      await sharp(Buffer.from(files.get("brand/icons/subloom-favicon.svg")))
        .resize(size, size)
        .png()
        .withMetadata({
          exif: {
            IFD0: {
              ImageDescription:
                "Origin: canonical Subloom Fourfold Bloom vector favicon export.",
            },
          },
        })
        .toBuffer(),
    );
  add("brand/icons/subloom-apple-touch-icon.png", await sharp(files.get("brand/icons/subloom-app-icon.png")).resize(180, 180).removeAlpha().png().toBuffer());
  for (const [file, value] of files) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), value);
  }
  await writeFile(
    path.join(root, "brand/manifest.json"),
    JSON.stringify(
      {
        version: identity.version,
        source: masterPath,
        sourceHash: hash(masterSource),
        files: Object.fromEntries(
          [...files].map(([file, value]) => [file, hash(value)]),
        ),
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    path.join(root, runtimeManifestPath),
    JSON.stringify({
      version: identity.version,
      source: masterPath,
      sourceHash: hash(masterSource),
      files: Object.fromEntries([...files]
        .filter(([file]) => !file.startsWith("brand/"))
        .map(([file, value]) => [file, hash(value)])),
    }, null, 2) + "\n",
  );
  console.log(
    `Generated ${files.size} brand exports from one canonical master.`,
  );
}

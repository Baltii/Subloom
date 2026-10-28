import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { p256 } from "@noble/curves/nist.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { concatBytes } from "@noble/hashes/utils.js";
import {
  createAppPasskey,
  passkeyAvailable,
  verifyAppPasskey,
} from "../../src/services/passkeys.web";
import type { AppPasskey } from "../../src/domain/appLock";

vi.mock("../../src/services/macosBridge", () => ({ macosBridge: () => null }));
vi.mock("../../src/services/windowsBridge", () => ({
  windowsBridge: () => null,
}));
const origin = "https://subloom.test",
  rpId = "subloom.test";
const encode = (value: Uint8Array | ArrayBuffer) =>
  Buffer.from(new Uint8Array(value)).toString("base64url");
const secret = new Uint8Array(32).fill(1);
const rawId = Uint8Array.from([1, 2, 3, 4]).buffer;
let passkey: AppPasskey;
const get = vi.fn(),
  create = vi.fn();
type Options = { publicKey: PublicKeyCredentialRequestOptions };
type Mutation = {
  origin?: string;
  challenge?: string;
  rpId?: string;
  flags?: number;
  counter?: number;
  signature?: Uint8Array;
  id?: ArrayBuffer;
};
function assertion(options: Options, mutation: Mutation = {}) {
  const clientDataJSON = new TextEncoder().encode(
    JSON.stringify({
      type: "webauthn.get",
      challenge:
        mutation.challenge ??
        encode(new Uint8Array(options.publicKey.challenge as ArrayBuffer)),
      origin: mutation.origin ?? origin,
      crossOrigin: false,
    }),
  );
  const authenticatorData = new Uint8Array(37);
  authenticatorData.set(
    sha256(new TextEncoder().encode(mutation.rpId ?? rpId)),
  );
  authenticatorData[32] = mutation.flags ?? 5;
  new DataView(authenticatorData.buffer).setUint32(
    33,
    mutation.counter ?? 0,
    false,
  );
  const signature =
    mutation.signature ??
    p256.sign(concatBytes(authenticatorData, sha256(clientDataJSON)), secret, {
      format: "der",
      lowS: false,
    });
  return {
    rawId: mutation.id ?? rawId,
    response: {
      clientDataJSON: clientDataJSON.buffer,
      authenticatorData: authenticatorData.buffer,
      signature: signature.buffer,
    },
  };
}
beforeEach(async () => {
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("PublicKeyCredential", class {});
  vi.stubGlobal("navigator", { credentials: { get, create } });
  vi.stubGlobal("location", { origin, hostname: rpId });
  const key = await webcrypto.subtle.importKey(
    "raw",
    p256.getPublicKey(secret, false),
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"],
  );
  const publicKey = await webcrypto.subtle.exportKey("spki", key);
  passkey = {
    id: encode(rawId),
    publicKey: encode(publicKey),
    rpId,
    origin,
    counter: 0,
  };
  get.mockImplementation((options: Options) => assertion(options));
  create.mockImplementation(
    ({
      publicKey: options,
    }: {
      publicKey: PublicKeyCredentialCreationOptions;
    }) => {
      const data = new Uint8Array(37);
      data.set(sha256(new TextEncoder().encode(rpId)));
      data[32] = 5;
      return {
        rawId,
        response: {
          clientDataJSON: new TextEncoder().encode(
            JSON.stringify({
              type: "webauthn.create",
              challenge: encode(
                new Uint8Array(options.challenge as ArrayBuffer),
              ),
              origin,
            }),
          ).buffer,
          getPublicKey: () => publicKey,
          getPublicKeyAlgorithm: () => -7,
          getAuthenticatorData: () => data.buffer,
        },
      };
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("app passkey verification", () => {
  it("registers only after a signed assertion proves possession and requires user verification", async () => {
    expect(await createAppPasskey()).toEqual(passkey);
    expect(
      create.mock.calls[0]![0].publicKey.authenticatorSelection
        .userVerification,
    ).toBe("required");
    expect(get.mock.calls[0]![0].publicKey.userVerification).toBe("required");
  });
  it("verifies real DER-encoded ECDSA signatures and uses a new random challenge each time", async () => {
    await expect(verifyAppPasskey(passkey)).resolves.toBe(0);
    await expect(verifyAppPasskey(passkey)).resolves.toBe(0);
    expect(encode(get.mock.calls[0]![0].publicKey.challenge)).not.toBe(
      encode(get.mock.calls[1]![0].publicKey.challenge),
    );
  });
  it.each([
    ["wrong challenge", { challenge: "replayed" }],
    ["wrong origin", { origin: "https://attacker.test" }],
    ["wrong RP", { rpId: "attacker.test" }],
    ["no user verification", { flags: 1 }],
    ["no user presence", { flags: 4 }],
    ["invalid signature", { signature: new Uint8Array(64) }],
    ["wrong credential", { id: new Uint8Array([9, 8, 7]).buffer }],
  ] as [string, Mutation][])("rejects %s", async (_label, mutation) => {
    get.mockImplementationOnce((options: Options) =>
      assertion(options, mutation),
    );
    await expect(verifyAppPasskey(passkey)).rejects.toThrow();
  });
  it("rejects replayed counters and accepts increasing counters", async () => {
    get.mockImplementationOnce((options: Options) =>
      assertion(options, { counter: 7 }),
    );
    await expect(verifyAppPasskey({ ...passkey, counter: 7 })).rejects.toThrow(
      "repeated",
    );
    get.mockImplementationOnce((options: Options) =>
      assertion(options, { counter: 8 }),
    );
    await expect(verifyAppPasskey({ ...passkey, counter: 7 })).resolves.toBe(8);
  });
  it("does not enable a passkey if its proof-of-possession prompt is canceled", async () => {
    get.mockResolvedValueOnce(null);
    await expect(createAppPasskey()).rejects.toThrow("canceled");
  });
  it("disables passkeys in insecure contexts and rejects a changed app origin", async () => {
    vi.stubGlobal("isSecureContext", false);
    expect(await passkeyAvailable()).toBe(false);
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("location", {
      origin: "https://other.test",
      hostname: "other.test",
    });
    await expect(verifyAppPasskey(passkey)).rejects.toThrow("browser");
    expect(get).not.toHaveBeenCalled();
  });
});

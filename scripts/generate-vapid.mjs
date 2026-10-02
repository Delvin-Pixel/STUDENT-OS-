import { generateKeyPairSync } from "node:crypto";

const toBase64Url = value => Buffer.from(value).toString("base64url");

const { publicKey, privateKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});
const publicJwk = publicKey.export({ format: "jwk" });
const privateJwk = privateKey.export({ format: "jwk" });

const publicKeyBytes = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(publicJwk.x, "base64url"),
  Buffer.from(publicJwk.y, "base64url"),
]);

console.log(
  JSON.stringify(
    {
      publicKey: toBase64Url(publicKeyBytes),
      privateKey: privateJwk.d,
    },
    null,
    2
  )
);

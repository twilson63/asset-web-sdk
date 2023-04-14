import { assert, test } from "vitest";

import Arweave from "arweave";
import { WarpFactory } from "warp-contracts";

import SDK from "./index.js";

const arweave = Arweave.init({
  host: "arweave.net",
  port: 443,
  protocol: "https",
});
const sdk = SDK.init({ arweave, warp: WarpFactory.forMainnet() });

test("ok", async () => {
  const result = await sdk.getAsset(
    "vCU8cXnxkkMupiACruf9ih2M4k_CWIEvGsozbY9jlzg"
  );
  console.log("result", result);
  assert.ok(true);
});

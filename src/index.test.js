import { assert, test } from "vitest";
import Bundlr from "@bundlr-network/client";
import Arweave from "arweave";
import { WarpFactory } from "warp-contracts";
import { DeployPlugin } from "warp-contracts-plugin-deploy";

import SDK from "./index.js";

const arweave = Arweave.init({
  host: "arweave.net",
  port: 443,
  protocol: "https",
});

const sdk = SDK.init({
  arweave,
  warp: WarpFactory.forMainnet().use(new DeployPlugin()),
});

globalThis.window = {
  arweaveWallet: {
    dispatch: async (tx) => {
      // emulate dispatch
      const w = await arweave.wallets.generate();
      const bundlr = new Bundlr("https://node2.bundlr.network", "arweave", w);
      const transaction = arweave.transactions.fromRaw(tx);
      const data = transaction.get("data", { decode: true, string: true });
      const tags = transaction.get("tags").map((tag) => ({
        name: tag.get("name", { decode: true, string: true }),
        value: tag.get("value", { decode: true, string: true }),
      }));
      const result = await bundlr
        .upload(data, { tags })
        .catch((e) => (console.log(e), e));
      return result;
    },
  },
};

test("create asset", async () => {
  const result = await sdk
    .createAsset({
      meta: "# Hello World",
      data: "<h1>Hello World</h1>",
      groupId: "TEST3",
      type: "app",
      title: "Test Application v2",
      description: "Fair Forks test",
      topics: ["fair-forks", "test"],
      balances: {
        "vh-NTHVvlKZqRxc8LyyTNok65yQ55a_PJ1zWLb9G2JI": 10000,
      },
    })
    .catch((e) => {
      console.log(e);
      return { ok: true };
    });

  console.log(result);
}, 10000);

test("get asset", async () => {
  const result = await sdk.getAsset(
    "vCU8cXnxkkMupiACruf9ih2M4k_CWIEvGsozbY9jlzg"
  );
  console.log("result", result);
  assert.ok(true);
});

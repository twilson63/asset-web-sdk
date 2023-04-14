// @ts-nocheck
import { z } from "zod";
import crocks from "crocks";
import {
  assoc,
  path,
  compose,
  reduce,
  always,
  keys,
  append,
  prop,
  ifElse,
  has,
  identity,
  lensProp,
  over,
  map
} from "ramda";
import Stamps from "@permaweb/stampjs";

const CONTRACT_SRC = "x0ojRwrcHBmZP20Y4SY0mgusMRx-IYTjg5W8c3UFoNs";

const { of, fromPromise, Resolved, Rejected, all } = crocks.Async;

// eslint-disable-next-line
const AtomicAsset = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(180),
  description: z.string().max(300),
  type: z.string(),
  topics: z.array(z.string()),
  balances: z.record(z.string(), z.number()),
  contentType: z.string().default("text/html"),
  data: z.string().or(z.instanceof(Uint8Array)).optional(),
  forks: z.string().default(""),
  groupId: z.string().optional(),
  meta: z.string().optional(),
});

/**
 * @typedef {Object} Env
 * @property {any} arweave
 * @property {any} warp
 */

/**
 * @typedef { z.infer<typeof AtomicAsset> } Asset
 */

/**
 * @callback GetAsset
 * @param {string} id
 * @returns {Promise<Asset>}
 */

/**
 * @typedef {Object} AssetWebSdk
 * @property {GetAsset} getAsset
 */

export default {
  /**
   * @param {Env} env
   * @returns {AssetSDK}
   */
  init(env) {
    const stamps = Stamps.init({ warp: env.warp });

    return {
      // createAsset: (asset) =>
      //   of(asset)
      //     .map(defaultGroupId)
      //     .map(createAssetData)
      //     .chain(publishAsset)
      // //.chain(registerStamps)
      // ,
      /**
       * @type {GetAsset} getAsset
       */
      getAsset: (id) =>
        of(id)
          .chain(buildQuery)
          .chain(fromPromise(gql))
          .map(pluckData)
          .chain(getData)
          .chain(getStampCount)
          .toPromise(),
    };

    function publishAsset(asset) {
      if (!window.arweaveWallet) {
        return Rejected(Error("No Wallet found!"));
      }
      const dispatch = fromPromise(window.arweaveWallet.dispatch);
      const createTransaction = fromPromise(env.arweave.createTransaction);
      const registerContract = ({ id }) => fromPromise(env.warp.register)(id, 'node2')
      const addTags = (tags) => (tx) => (
        map((t) => tx.addTag(t.name, t.value), tags), tx
      );

      return createTransaction({ data: asset.meta.data })
        .map(addTags(asset.meta.tags))
        .chain(dispatch)
        .chain(({ id }) => createTransaction({ data: asset.target.data })
          .map(
            addTags([
              ...asset.target.tags,
              { name: "META", value: id },
              { name: "App-Name", value: "SmartWeaveContract" },
              { name: "App-Version", value: "0.3.0" },
              { name: "Contract-Src", value: CONTRACT_SRC },
            ])
          )

        )
        .chain(dispatch)
        .chain(registerContract);
    }

    function createAssetData(asset) {
      const topicTags = map(
        (v) => ({ name: `Topic:${v}`, value: v }),
        asset.topics
      );
      return {
        target: {
          data: asset.data,
          tags: [
            { name: "Content-Type", value: asset.contentType },
            { name: "Title", value: asset.title },
            { name: "Description", value: asset.description },
            { name: "Type", value: asset.type },
            { name: "Published", value: String(Date.now()) },
            { name: "GroupId", value: asset.groupId },
            { name: "Forks", value: asset.forks },
            {
              name: "Init-State",
              value: JSON.stringify({
                balances: asset.balances,
                pairs: [],
                name: `${asset.type}-${asset.title}`,
                ticker: asset.type.toUpperCase(),
                settings: [["isTradeable", true]],
              }),
            },
          ],
          ...topicTags,
        },
        meta: {
          data: asset.meta,
          tags: [
            { name: "Content-Type", value: "text/markdown" },
            { name: "App-Name", value: "AssetSDK" },
            { name: "Title", value: asset.title },
            { name: "Description", value: asset.description },
            { name: "Type", value: `${asset.type}-meta` },
          ],
        },
      };
    }

    // default GroupId to randomUUID if not set
    function defaultGroupId(asset) {
      return ifElse(
        has("groupId"),
        identity,
        over(lensProp("groupId"), () => crypto.randomUUID())
      )(asset);
    }

    // get stamp count
    function getStampCount(asset) {
      return fromPromise(stamps.count)(asset.id).map(({ vouched }) =>
        assoc("stamps", vouched, asset)
      );
    }

    // get first transaction to match this query
    function buildQuery(id) {
      return Resolved({
        query: `query ($ids: [ID!], $cursor: String) {
          transactions(first: 1, after: $cursor, 
            ids: $ids) {
            pageInfo {
              hasNextPage
            }
            edges {
              cursor
              node {
                id
                owner { address }
                tags {
                  name
                  value
                }
              }
            }
          }
        }`,
        variables: {
          ids: [id],
        },
      });
    }

    //function run(data: { query: string, variables: Record<string, any> }): Promise<any> {
    function run(data) {
      return env.arweave.api
        .post("graphql", data)
        .then((x) => {
          if (x.data.errors) {
            throw new Error(JSON.stringify(x.data.errors, null, 2));
          }
          return x;
        })
        .then(path(["data", "data", "transactions"]));
    }

    //async function gql(q: { query: string, variables: Record<string, any> }) {
    async function gql(q) {
      let hasNextPage = true;
      let edges = []; //: any[] = []
      let cursor = "";

      while (hasNextPage) {
        const result = await run({
          query: q.query,
          variables: { ...q.variables, cursor },
        });

        if (result.edges && result.edges.length) {
          // @ts-ignore
          edges = edges.concat(result.edges);
          cursor = result.edges[result.edges.length - 1].cursor;
        }
        hasNextPage = result.pageInfo.hasNextPage;
      }

      return edges;
    }

    // convert tags to an object and extract the id and meta identifier
    function pluckData(data) {
      return compose(
        (o) => ({
          tags: o,
          assetId: data[0].node.id,
          sourceId: o.META,
          owner: data[0].node.owner.address,
        }),
        reduce((acc, { name, value }) => assoc(name, value, acc), {})
      )(data[0].node.tags);
    }

    // get the data of the meta/source and the id, then convert the asset data to an object
    function getData(asset) {
      return all([
        fromPromise(() =>
          env.arweave.api
            .get(asset.sourceId)
            .then(prop("data"))
            .catch(always("No meta data"))
        )(),
        fromPromise(() =>
          env.arweave.api
            .get(asset.assetId)
            .then(prop("data"))
            .catch(always("No data..."))
        )(),
      ]).map(([meta, data]) => ({
        ...toAssetItem(asset),
        meta,
        data,
      }));
    }

    // convert asset data to an object
    function toAssetItem(asset) {
      return {
        id: asset.assetId,
        type: asset.tags.Type,
        title: asset.tags.Title,
        description: asset.tags.Description,
        groupId: asset.tags.GroupId || asset.tags["Group-Id"],
        forks: asset.tags.Forks,
        published: asset.tags.Published,
        owner: asset.owner,
        stamps: 0,
        topics: compose(
          reduce(
            (acc, k) => (/^Topic:/.test(k) ? append(asset.tags[k], acc) : acc),
            []
          ),
          keys
        )(asset.tags),
      };
    }
  },
};

// @ts-nocheck
// import graph from "@permaweb/asset-graph";
// import AssetSDK from "@permaweb/asset-sdk";
// import Bundlr from "@bundlr-network/client";
// import { WarpFactory } from "warp-contracts";
// import fs from "fs";
// import { Data } from "../types";
import crocks from 'crocks';
import { assoc, path, compose, reduce, always, keys, append, prop, ifElse, has, identity, lensProp, over } from 'ramda';
import Stamps from '@permaweb/stampjs'
import { WarpFactory } from 'warp-contracts'

const stamps = Stamps.init({ warp: WarpFactory.forMainnet() })
const { of, fromPromise, Resolved, all } = crocks.Async

export default {
  init(env) {
    return {
      createAsset: (asset) =>
        of(asset)
          .map(defaultGroupId)
          .map(createAssetData)
      //.chain(publishAsset)
      ,
      getAsset: (id) =>
        of(id)
          .chain(buildQuery)
          .chain(fromPromise(gql))
          .map(pluckData)
          .chain(getData)
          .chain(getStampCount)
          .toPromise()
    }

    function createAssetData(asset) {
      return {
        target: {},
        meta: {}
      }
    }

    // default GroupId to randomUUID if not set
    function defaultGroupId(asset) {
      return ifElse(has('groupId'), identity, over(lensProp('groupId'), () => crypto.randomUUID()))(asset)
    }

    // get stamp count
    function getStampCount(asset) {
      return fromPromise(stamps.count)(asset.id)
        .map(({ vouched }) => assoc('stamps', vouched, asset))
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
          ids: [id]
        }
      })
    }

    //function run(data: { query: string, variables: Record<string, any> }): Promise<any> {
    function run(data) {
      return env.arweave.api.post('graphql', data)
        .then(x => {
          if (x.data.errors) {
            throw new Error(JSON.stringify(x.data.errors, null, 2))
          }
          return x
        })
        .then(path(['data', 'data', 'transactions']))
    }

    //async function gql(q: { query: string, variables: Record<string, any> }) {
    async function gql(q) {
      let hasNextPage = true;
      let edges = [] //: any[] = []
      let cursor = ""

      while (hasNextPage) {
        const result = await run({ query: q.query, variables: { ...q.variables, cursor } })

        if (result.edges && result.edges.length) {
          // @ts-ignore
          edges = edges.concat(result.edges)
          cursor = result.edges[result.edges.length - 1].cursor
        }
        hasNextPage = result.pageInfo.hasNextPage
      }

      return edges
    }

    // convert tags to an object and extract the id and meta identifier
    function pluckData(data) {
      return compose(
        o => ({ tags: o, assetId: data[0].node.id, sourceId: o.META, owner: data[0].node.owner.address }),
        reduce((acc, { name, value }) => assoc(name, value, acc), {})
      )(data[0].node.tags)
    }

    // get the data of the meta/source and the id, then convert the asset data to an object
    function getData(asset) {
      return all([
        fromPromise(() => env.arweave.api.get(asset.sourceId).then(prop('data')).catch(always('No meta data')))(),
        fromPromise(() => env.arweave.api.get(asset.assetId).then(prop('data')).catch(always('No data...')))()
      ]).map(([meta, data]) => ({
        ...toAssetItem(asset),
        meta,
        data
      }))
    }

    // convert asset data to an object
    function toAssetItem(asset) {
      return {
        id: asset.assetId,
        type: asset.tags.Type,
        title: asset.tags.Title,
        description: asset.tags.Description,
        groupId: asset.tags.GroupId || asset.tags['Group-Id'],
        forks: asset.tags.Forks,
        published: asset.tags.Published,
        owner: asset.owner,
        stamps: 0,
        topics: compose(
          reduce((acc, k) => /^Topic:/.test(k) ? append(asset.tags[k], acc) : acc, []),
          keys
        )(asset.tags)
      }
    }
  }
}

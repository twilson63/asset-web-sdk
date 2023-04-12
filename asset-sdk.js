// @ts-nocheck
// import graph from "@permaweb/asset-graph";
// import AssetSDK from "@permaweb/asset-sdk";
// import Bundlr from "@bundlr-network/client";
// import { WarpFactory } from "warp-contracts";
// import fs from "fs";
// import { Data } from "../types";
import crocks from 'crocks';
import { path, compose, reduce } from 'ramda';

const { of, fromPromise, Resolved } = crocks.Async

export default {
  init(env) {
    return {
      getAsset: (id) =>
        of(id)
          .chain(buildQuery)
          .chain(fromPromise(gql))
          .map(pluckData)
          // .chain(getData)
          // .chain(getStampCount)
          .toPromise()
    }

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

    function pluckData(data) {

      return compose(
        o => ({ tags: o, assetId: data[0].node.id, sourceId: o.META, owner: data[0].node.owner.address }),
        reduce((acc, { name, value }) => assoc(name, value, acc), {})
      )(data[0].tags)
    }
  }
}

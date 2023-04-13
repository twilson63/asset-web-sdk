import Arweave from 'arweave'
import SDK from './asset-sdk.js'

const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' })
const sdk = SDK.init({ arweave })

async function main() {

  const result = await sdk.getAsset('vCU8cXnxkkMupiACruf9ih2M4k_CWIEvGsozbY9jlzg')
  console.log('result', result)
}

main()
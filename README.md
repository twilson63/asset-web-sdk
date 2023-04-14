# Asset-Web-SDK

This SDK is for Atomic Assets in the browser.

## Install

```
npm install @permaweb/asset-web-sdk
```

## Usage

### init

```js
import Arweave from 'arweave'
import { WarpFactory } from 'warp-contracts'
import SDK from '@permaweb/asset-web-sdk'

const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' })
const sdk = SDK.init({ arweave, warp: WarpFactory.forMainnet() })
```


### getAsset

```js
const result = await sdk.getAsset('vCU8cXnxkkMupiACruf9ih2M4k_CWIEvGsozbY9jlzg')
console.log('result', result)
```

## Developer Information

### test

```sh
yarn test
```

### format

```sh
yarn fmt
```

### lint

```sh
yarn lint
```

### coverage

```sh
yarn coverage
```
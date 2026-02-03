## 1.0.0 (2026-02-03)

### Features

* **actions:** add RelaxedState type for variant property access ([1e32955](https://github.com/chrismichaelps/tagix/commit/1e32955d9c21f0ab6b568488efe6171fb0f01e99))
* add action creators for sync and async operations ([30c33ca](https://github.com/chrismichaelps/tagix/commit/30c33ca1e611fbdc08f0d0c9fcdeca74eeb54a4e))
* add context module with dependency injection ([5d90b27](https://github.com/chrismichaelps/tagix/commit/5d90b273ffc2209d92dd5e07358c79ef7f81ce78))
* add functional programming primitives ([426f4de](https://github.com/chrismichaelps/tagix/commit/426f4de87b24d2a9f1b9bdf0f9c347e6d32fc435))
* add GetState type to tagged enum ([4ba0f42](https://github.com/chrismichaelps/tagix/commit/4ba0f42aaf6e534ad7d977ffa17c18ac726d7803))
* add main library exports ([32bd5c6](https://github.com/chrismichaelps/tagix/commit/32bd5c6b81631f89ed967878a1f64ab3b3b32f52))
* add maxRetries configuration option ([a200566](https://github.com/chrismichaelps/tagix/commit/a200566766ddadf600b410c81db5374d0279b0eb))
* add middleware system with logger ([de4ade7](https://github.com/chrismichaelps/tagix/commit/de4ade710e67f92dacafc95305ffaa385f72c46a))
* add Option type helpers for context get operation ([c327d9e](https://github.com/chrismichaelps/tagix/commit/c327d9e073da18c95d5b66a3a0baa4a6d7a6454c))
* add pattern matching utilities ([247c3ec](https://github.com/chrismichaelps/tagix/commit/247c3ec39d68d2319446b5685b00efc507353345))
* add selectors with memoization ([132c467](https://github.com/chrismichaelps/tagix/commit/132c4675bc1ceb238eade2f1e9fa126e91c83045))
* add state-utils module for tagged union operations ([85a04c9](https://github.com/chrismichaelps/tagix/commit/85a04c92683a915e71c79384c34e63d8ea65897f))
* add type-safe state guards ([73a0f9f](https://github.com/chrismichaelps/tagix/commit/73a0f9f4522c0cae8791040820a298a6f1c3c3e4))
* implement core store with history management ([e7224d4](https://github.com/chrismichaelps/tagix/commit/e7224d4b283284990993886e79e7c9598999019c))
* improve selectors with additional utilities ([97951db](https://github.com/chrismichaelps/tagix/commit/97951db43d44c904a4c9662777acfac633e541e9))
* **store:** improve select method generic inference ([038eeef](https://github.com/chrismichaelps/tagix/commit/038eeef988fc2d640d1a63ca7814a916b901a303))
* **store:** support action creator dispatch pattern ([60d940c](https://github.com/chrismichaelps/tagix/commit/60d940c3ab1351e06e5f2506867325f881585f96))

### Bug Fixes

* add function overloads to action creators ([af7a39f](https://github.com/chrismichaelps/tagix/commit/af7a39f12a525fc6492d76b93b5ed75f87b9b9bb))
* call subscriber callback immediately on subscribe ([2c40010](https://github.com/chrismichaelps/tagix/commit/2c4001041012674a7d9c2ce6ddf90c606436d477))
* **guards:** fix withState generic type parameter ([b90adb9](https://github.com/chrismichaelps/tagix/commit/b90adb9d12aff5d1b0c9a097c4c6d35c62b98a2b))
* improve dispatch payload handling and error matching ([39c7f73](https://github.com/chrismichaelps/tagix/commit/39c7f735fd6437e552d0bb86dc06736fc61424e6))
* optimize pluck selector with early return ([bcdefd8](https://github.com/chrismichaelps/tagix/commit/bcdefd8790e781ac787f04fa6df61976f7686797))
* resolve payload passing and history management bugs in store ([df2addb](https://github.com/chrismichaelps/tagix/commit/df2addb33b1c5dd606ea02ec3a91edd34dca0b9f))
* resolve test syntax errors in actions and selectors ([42d645d](https://github.com/chrismichaelps/tagix/commit/42d645d0562edfb86af02e1e4b29437528bc979c))
* **types:** update Middleware type to support blocking actions ([0910672](https://github.com/chrismichaelps/tagix/commit/0910672421eeb63e48f58bfac436845941c551e6))
* update core store implementation ([ecd41e8](https://github.com/chrismichaelps/tagix/commit/ecd41e87c14c32f7ee05405cf90dce8dc66e3741))

### Documentation

* add CONTRIBUTING and SECURITY guidelines, and funding information ([8351b40](https://github.com/chrismichaelps/tagix/commit/8351b40051869e0d140b38144a1d1543ccdb746b))
* Add documentation link to README. ([1700fd9](https://github.com/chrismichaelps/tagix/commit/1700fd9d7ccac52c088f46de8f58f1d3e14be1f0))
* add project README ([a87d17d](https://github.com/chrismichaelps/tagix/commit/a87d17de4521ad375d64397f723e4c32ba9a27aa))
* add TSDoc comments to action creators ([642efc6](https://github.com/chrismichaelps/tagix/commit/642efc6fb3f6dccc7a33342fb8c8c8efe7ea47e9))
* add TSDoc comments to core store and types ([cf6340e](https://github.com/chrismichaelps/tagix/commit/cf6340e22e9099b509d7c33571d2a00fb8148545))
* add TSDoc comments to error handling ([6efa79b](https://github.com/chrismichaelps/tagix/commit/6efa79bc0b8d6def1721237895ea2733a0e50c62))
* add TSDoc comments to guards ([e39134b](https://github.com/chrismichaelps/tagix/commit/e39134b813d97214fed56afb66ce10f13ba8ab8d))
* add TSDoc comments to logger middleware ([c242f2d](https://github.com/chrismichaelps/tagix/commit/c242f2d96c06a8409ab386da884f9c508ca46771))
* add TSDoc comments to match utilities ([e401b57](https://github.com/chrismichaelps/tagix/commit/e401b57b315f5194cc84aaa88db4e97140c0193e))
* add TSDoc comments to selectors ([9b84b2d](https://github.com/chrismichaelps/tagix/commit/9b84b2d736b83f841c22e0cb38ec8e26fefd8e46))
* Clean up tagix documentation md files. ([ba8c52d](https://github.com/chrismichaelps/tagix/commit/ba8c52d0251f149369227913c41fb1e4a160b3d0))
* Clean up tagix documentation md files. ([0127968](https://github.com/chrismichaelps/tagix/commit/01279683284876ca5c5793342d076bcf88d9c752))
* document onError config in createContext ([e5de283](https://github.com/chrismichaelps/tagix/commit/e5de28392928382bafd71b1cdfd5376097136d3b))
* export state-utils from Data module ([fd327ca](https://github.com/chrismichaelps/tagix/commit/fd327ca5609d6c3b4b835753e325aba21d8b2c2e))
* remove .sidebar.json configuration file ([bc0da51](https://github.com/chrismichaelps/tagix/commit/bc0da5174fe7f06e0a04a644444b0f7bfe7d54d8))
* remove history documentation from createStore ([df1e3f5](https://github.com/chrismichaelps/tagix/commit/df1e3f55b0e90268d2174716033dac70126dc93a))
* remove history management from library description ([b5fb848](https://github.com/chrismichaelps/tagix/commit/b5fb848f63a3dc8156f008f1985b78d08cdccac0))
* remove maxUndoHistory from createStore example ([ec142c3](https://github.com/chrismichaelps/tagix/commit/ec142c3c4cdfce212ae7efc235be1ce8a8b1414f))
* update guards and match documentation ([731ac7a](https://github.com/chrismichaelps/tagix/commit/731ac7a8924b17f879c9d4630a17824730faa800))
* update READMEs with middleware blocking and state freshness ([f2d1b6f](https://github.com/chrismichaelps/tagix/commit/f2d1b6f14258ed3589eedf071849db5692dc4e07))

### Code Refactoring

* add isRecord import and MinimalStore interface ([5a19c83](https://github.com/chrismichaelps/tagix/commit/5a19c83a2cae7cf6eaa2dc5d0fca8ca0f0045785))
* export context module from store index ([7d2368f](https://github.com/chrismichaelps/tagix/commit/7d2368fbd6e049cd3d308630dde43ad2064c41ee))
* remove duplicate immediate call in context.select ([0669894](https://github.com/chrismichaelps/tagix/commit/0669894c4778030155f822d7ffc89767f1821126))
* remove history methods and properties from store ([202b267](https://github.com/chrismichaelps/tagix/commit/202b26709cdacf86507331a34ccb2d994ee8565d))
* remove maxSnapshots and maxUndoHistory from config ([5954597](https://github.com/chrismichaelps/tagix/commit/5954597a24004d684011bc175d93148b61a5d470))
* remove Snapshot and DerivedDefinition types ([76739c4](https://github.com/chrismichaelps/tagix/commit/76739c4586438471025a335069094bec5b048722))
* remove SnapshotNotFoundError and MaxHistoryExceededError ([48aa900](https://github.com/chrismichaelps/tagix/commit/48aa9009ab98a43a77beeb9e193ca8c094130d9b))
* remove unused types from src/types ([b503c39](https://github.com/chrismichaelps/tagix/commit/b503c39117c97bd2c5a90c31d19f16cccb2f5060))
* replace optional chaining with predicates in logger middleware ([dd90923](https://github.com/chrismichaelps/tagix/commit/dd90923dd64446fe39a13919d74f8f8794ed8e64))
* replace optional chaining with predicates in tagged-error ([295c584](https://github.com/chrismichaelps/tagix/commit/295c58492ececd28260a989896ad8a4eb1f49001))

### Tests

* **actions:** add comprehensive dispatch API tests ([0c204dd](https://github.com/chrismichaelps/tagix/commit/0c204dd85d95f5a727cec307d9f047651295e2ff))
* **actions:** update tests with proper type assertions ([13fdf17](https://github.com/chrismichaelps/tagix/commit/13fdf174a3e28b2fa721fb0d808f694848a1f814))
* add additional test coverage for guards, match, and middleware ([c00aea0](https://github.com/chrismichaelps/tagix/commit/c00aea0e8c451722ea668cee325666ff0e4e67d8))
* add error callback and cleanup verification tests ([0c0c0fb](https://github.com/chrismichaelps/tagix/commit/0c0c0fb57cf62302d5d506a65aa6429fec2ef070))
* add logger middleware option tests ([7a6a63b](https://github.com/chrismichaelps/tagix/commit/7a6a63b17c4b949a41afab3825a5945776a9c289))
* add test utilities for store testing ([009608e](https://github.com/chrismichaelps/tagix/commit/009608e22f06a961bf2ac1f3a9bf1cfc10380a61))
* **core:** update factory tests with new state patterns ([db9ae11](https://github.com/chrismichaelps/tagix/commit/db9ae11f16084c94376a6690556a86697a142d9f))
* **guards:** update tests to use asVariant and TaggedEnum ([bec3b36](https://github.com/chrismichaelps/tagix/commit/bec3b364219bca816f66513ed463b4311aebdb03))
* remove undo/redo and snapshot tests from factory ([f033667](https://github.com/chrismichaelps/tagix/commit/f033667bfaf6895d5d61766c2ff0667a5128e1eb))
* replace optional chaining with predicates in factory tests ([e3542db](https://github.com/chrismichaelps/tagix/commit/e3542dbaac3149455126ca249e14875c85219062))
* replace optional chaining with predicates in logger tests ([4e41aff](https://github.com/chrismichaelps/tagix/commit/4e41affb5fd569b618ceb8b50b376cd5aa39c684))
* **selectors:** fix selector type signatures ([301fe56](https://github.com/chrismichaelps/tagix/commit/301fe564834ba289fbe598a793fbbc81d0b27a9d))
* update context tests for immediate callback behavior ([4a2b8fd](https://github.com/chrismichaelps/tagix/commit/4a2b8fd256240cb14acf60a5a55f69a893415f5b))
* update factory tests for immediate callback behavior ([e09212a](https://github.com/chrismichaelps/tagix/commit/e09212a265e2ae0c94fd8ff882782a764f10fe4a))
* update logger middleware tests ([5a510a9](https://github.com/chrismichaelps/tagix/commit/5a510a96824ff617796fb70bbb8c903553360aec))
* update test cases ([366d589](https://github.com/chrismichaelps/tagix/commit/366d58904d11ad94b0152f992e88418e4a2fe90d))

### CI/CD

* Implement automated releases using semantic-release and GitHub Actions. ([89bc1ee](https://github.com/chrismichaelps/tagix/commit/89bc1ee65605a78d1a184c01146c5ca02b580cb0))

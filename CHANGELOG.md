## [1.3.0](https://github.com/chrismichaelps/tagix/compare/v1.2.2...v1.3.0) (2026-06-25)

### Features

* **actions:** add withPayload to async builder and remove payload! non-null assertions ([5a2d037](https://github.com/chrismichaelps/tagix/commit/5a2d0375349be0f5c908913034be89399667025c)), closes [#60](https://github.com/chrismichaelps/tagix/issues/60)
* **actions:** pass dispatch context to async onSuccess/onError ([aa327a7](https://github.com/chrismichaelps/tagix/commit/aa327a7d6339f6e8fb4af0861383d9a10789c1d3)), closes [#73](https://github.com/chrismichaelps/tagix/issues/73)
* **core:** add selector subscriptions on the store ([471fbec](https://github.com/chrismichaelps/tagix/commit/471fbec26c9f46f6e80b7f87297712ccb11d95cd)), closes [#89](https://github.com/chrismichaelps/tagix/issues/89)
* **core:** add store.reset() to restore initial state ([1621ef3](https://github.com/chrismichaelps/tagix/commit/1621ef3394a0b71ec768e7d11a9d56ccdf1af9f3)), closes [#87](https://github.com/chrismichaelps/tagix/issues/87)
* **data:** add Effect-inspired Brand nominal types ([ca9894f](https://github.com/chrismichaelps/tagix/commit/ca9894f4f920de53ae20b38463c0e78633bc9bc9)), closes [#56](https://github.com/chrismichaelps/tagix/issues/56)
* **data:** add Effect-inspired Order comparator module ([2639ffc](https://github.com/chrismichaelps/tagix/commit/2639ffc9f7cf75e2cb650dfe13c65bcf3e6604e6)), closes [#43](https://github.com/chrismichaelps/tagix/issues/43)
* **data:** add fromPredicate and all to Option and Either ([cb8dc31](https://github.com/chrismichaelps/tagix/commit/cb8dc317d1a2f633754981e5bf874bfa02fc28c7)), closes [#51](https://github.com/chrismichaelps/tagix/issues/51)
* **data:** pipeable Option combinators + narrowing hasTag guard ([eb8641f](https://github.com/chrismichaelps/tagix/commit/eb8641f5efd1f596e52f1f8e7d84b0eba5b77fd3)), closes [#49](https://github.com/chrismichaelps/tagix/issues/49)
* **middleware:** add Redux DevTools integration ([03b16be](https://github.com/chrismichaelps/tagix/commit/03b16be3053b07dd64e6076b4da54f8e28637b8f)), closes [#85](https://github.com/chrismichaelps/tagix/issues/85)
* **persist:** add persist helper for storage hydration and sync ([96bed5d](https://github.com/chrismichaelps/tagix/commit/96bed5d103a88d783eb3b276a069b3ea2c2cb5a2)), closes [#83](https://github.com/chrismichaelps/tagix/issues/83)
* **react:** add useSyncExternalStore-based reactive hooks ([f1e1a60](https://github.com/chrismichaelps/tagix/commit/f1e1a60897ca9c73acad1c2803c9ef24331ae647)), closes [#58](https://github.com/chrismichaelps/tagix/issues/58)
* **selectors:** add reselect-style createSelector ([6b94c3e](https://github.com/chrismichaelps/tagix/commit/6b94c3e0892e2d91cb0a69367ef3ff81f143feae)), closes [#79](https://github.com/chrismichaelps/tagix/issues/79)
* **selectors:** type-safe function accessors and composable Lens optics ([2bbb82c](https://github.com/chrismichaelps/tagix/commit/2bbb82cef5490d2e3b137d638cb5bcc99c40e90b)), closes [#41](https://github.com/chrismichaelps/tagix/issues/41)
* **slice:** add bindActions for bound dispatchers over existing actions ([4bee911](https://github.com/chrismichaelps/tagix/commit/4bee911e59c9015965efb4711658c8b83fd2b548)), closes [#81](https://github.com/chrismichaelps/tagix/issues/81)
* **slice:** add createSlice for colocated, low-boilerplate stores ([da39d86](https://github.com/chrismichaelps/tagix/commit/da39d861962a5d6db57f2faa7b5c141cd61d9a36)), closes [#75](https://github.com/chrismichaelps/tagix/issues/75)
* **slice:** support async actions inline in createSlice ([8c540ed](https://github.com/chrismichaelps/tagix/commit/8c540ed575a07ca29ca1243cf55ff69558b412a1)), closes [#77](https://github.com/chrismichaelps/tagix/issues/77)
* **vue:** add shallowRef-based reactive composables via onScopeDispose ([6dc9d86](https://github.com/chrismichaelps/tagix/commit/6dc9d86d50f2a3f4d074c770a39f514c5fd7de0c))

### Bug Fixes

* **actions:** infer effect return into onSuccess result (no more unknown) ([a8f4066](https://github.com/chrismichaelps/tagix/commit/a8f406613145456100c6a4cee5db7f5910535021)), closes [#96](https://github.com/chrismichaelps/tagix/issues/96)
* **build:** keep adapter frameworks external to prevent 2 MB bundle bloat ([f67f0ab](https://github.com/chrismichaelps/tagix/commit/f67f0abc72502548898188a153e4690446fe060d))
* **context:** dedup DerivedContext.select callbacks by selected value ([1826fa6](https://github.com/chrismichaelps/tagix/commit/1826fa6b80dd02ef44b69d9bfcdbeacdc5aedb2f)), closes [#45](https://github.com/chrismichaelps/tagix/issues/45)
* **context:** dedup undefined selections with a sentinel instead of overloading undefined ([d68e9cf](https://github.com/chrismichaelps/tagix/commit/d68e9cf9f7b6c94c4f42465e223d280b21a81024))
* **context:** release store subscription on dispose and propagate services ([a2c38c5](https://github.com/chrismichaelps/tagix/commit/a2c38c539969a452023850d1476c1eb8fca8108e))
* **core:** prevent unbounded re-entrancy in subscriber notification ([1f3e088](https://github.com/chrismichaelps/tagix/commit/1f3e0886cab14833c40c74bd84377d9a15be5bf4))
* **docs:** clarify non-reactive nature of core hooks, fix maxRetries JSDoc ([202e193](https://github.com/chrismichaelps/tagix/commit/202e19307be0f8e30b81a2a6b6484000060d75be))
* **error:** attach a numeric code to every tagged error ([5bc594d](https://github.com/chrismichaelps/tagix/commit/5bc594de4aca4ad096756a9e19b3ef9f08ea9b14))
* logger double-log, Order.number NaN ordering, deepEqual cyclic overflow ([a0e3536](https://github.com/chrismichaelps/tagix/commit/a0e35366de2c2a26ea1d57e88aedcb15698ada22)), closes [#47](https://github.com/chrismichaelps/tagix/issues/47)
* **selectors:** deep-compare Date/RegExp/Map/Set/TypedArray in memoize ([953de89](https://github.com/chrismichaelps/tagix/commit/953de89e6d8f0cb0fb9455598efce6bb566a648e))
* **selectors:** preserve property type in pluck instead of returning unknown ([137ef5e](https://github.com/chrismichaelps/tagix/commit/137ef5ef0829c29b5d30aba60b913d824d02143c)), closes [#39](https://github.com/chrismichaelps/tagix/issues/39)
* **store:** copy middlewares before reversing to avoid mutating caller array ([9574041](https://github.com/chrismichaelps/tagix/commit/95740411ef0771454d800f3f67037276d2634543)), closes [#33](https://github.com/chrismichaelps/tagix/issues/33)
* **store:** harden dispatch error handling and async state validation ([5198520](https://github.com/chrismichaelps/tagix/commit/5198520e02a76414af472b5214151ab49509eb0e))
* **store:** preserve source store config when forking ([6c99b44](https://github.com/chrismichaelps/tagix/commit/6c99b4405780a78e4cb7bdd4bbb77c65d5cae363))
* **store:** run async effects once by default; make auto-retry opt-in ([1d1f985](https://github.com/chrismichaelps/tagix/commit/1d1f985c41abff21d92c862ccccd1a45180474d6)), closes [#32](https://github.com/chrismichaelps/tagix/issues/32)
* **types:** bound RelaxedState to known variant keys, closing the any hole ([ff2e134](https://github.com/chrismichaelps/tagix/commit/ff2e1341e9d12c6408159173ef9341e85d8a5c1e))

### Documentation

* add Functional Utilities guide (Option, Either, pipe/flow, predicates) ([5f4afc5](https://github.com/chrismichaelps/tagix/commit/5f4afc58414b8773a92775de2923fe1ddd96353f)), closes [#53](https://github.com/chrismichaelps/tagix/issues/53)
* align quick-start, core, architecture, state, async, machines, selectors with shipped API ([21eea2d](https://github.com/chrismichaelps/tagix/commit/21eea2d5a7b0770b28a569ac4d7159d9462875d8))
* align remaining guides with shipped API and clarify variant schemas ([814e486](https://github.com/chrismichaelps/tagix/commit/814e486f7d75448338de6b61dadb9f245fa4f1e9))
* fix services examples, hook signatures, and createStore arity in middleware/context ([1c8dd48](https://github.com/chrismichaelps/tagix/commit/1c8dd48bd500531ee96167a8ccd41a38803e79b6))
* **services:** mark the React hooks example as a tsx fence ([52e9244](https://github.com/chrismichaelps/tagix/commit/52e924448ab3de9ecd7610d1edc69a26afd19c61))

### Code Refactoring

* **config:** derive tsup/vitest from single adapter manifest ([3eceddd](https://github.com/chrismichaelps/tagix/commit/3ecedddecca6a9bc631cdc6b415a0d15d25e8a5f))
* **constants:** replace 'window as any' with typed WindowWithDevTools ([54a4c62](https://github.com/chrismichaelps/tagix/commit/54a4c6234c4472099176e6b5ef91ea8c8fad0698))
* remove unnecessary type casts where TypeScript infers correctly ([7915b2d](https://github.com/chrismichaelps/tagix/commit/7915b2d3fc507c196279572c2b3996f94baa9fdd))

### Tests

* **config:** exclude vue tests from node project until vue deps installed ([297d693](https://github.com/chrismichaelps/tagix/commit/297d693cfd6df3f5d3cf63955758fee24fe9dc6a))
* **derived:** add coverage for derived store behavior ([ecb60a6](https://github.com/chrismichaelps/tagix/commit/ecb60a6af31ed7583ab225490908a2b3c408ad80))
* real-scenario integration suite + mutation-driven dedup test ([e99af00](https://github.com/chrismichaelps/tagix/commit/e99af00167c262ef1b00b5feb875583a290fdfee)), closes [#46](https://github.com/chrismichaelps/tagix/issues/46) [#92](https://github.com/chrismichaelps/tagix/issues/92)
* real-world integration suite against live HTTP API ([0bce21e](https://github.com/chrismichaelps/tagix/commit/0bce21e9af9afc87a795b7707414c3c078516f49)), closes [#94](https://github.com/chrismichaelps/tagix/issues/94)
* **store:** cover retry default, middleware immutability, and async flow ([876bf1e](https://github.com/chrismichaelps/tagix/commit/876bf1e93891e0eda9f94109826c5c3f3870c803))

## [1.2.2](https://github.com/chrismichaelps/tagix/compare/v1.2.1...v1.2.2) (2026-02-24)

### Bug Fixes

* state transitions and property bleeding in createAsyncAction ([589592c](https://github.com/chrismichaelps/tagix/commit/589592c61c4828371bc9a697f2e67f0c8e302ce4)), closes [#30](https://github.com/chrismichaelps/tagix/issues/30)

## [1.2.1](https://github.com/chrismichaelps/tagix/compare/v1.2.0...v1.2.1) (2026-02-14)

### Documentation

* add detailed service system documentation Ref: [#28](https://github.com/chrismichaelps/tagix/issues/28) ([0b8def4](https://github.com/chrismichaelps/tagix/commit/0b8def4b2f3d80d59cd8a9badf59efef7a49860d))

## [1.2.0](https://github.com/chrismichaelps/tagix/compare/v1.1.0...v1.2.0) (2026-02-13)

### Features

* Implement pattern matching hooks (, , ) for tagged union states and enhance  with action-object typing Ref: [#26](https://github.com/chrismichaelps/tagix/issues/26) ([362c636](https://github.com/chrismichaelps/tagix/commit/362c6360709a13db4e68e076ac90dab6cc96a531))
* Implement pattern matching hooks (, , ) for tagged union states and enhance  with action-object typing. ([920694a](https://github.com/chrismichaelps/tagix/commit/920694a950ade9ca5198a98166a43987acb5eb4f))
* Implement pattern matching hooks (useMatch, useMatchPartial, useWhen) for tagged union states and enhance useDispatch with action-object typing. ([7f85bbf](https://github.com/chrismichaelps/tagix/commit/7f85bbf3be70125e1164f11bdec27741a06b9db4)), closes [#26](https://github.com/chrismichaelps/tagix/issues/26)

### Documentation

* Update hook utilities documentation to introduce new type-safe pattern matching and dispatching hooks and deprecate older ones. ([f750778](https://github.com/chrismichaelps/tagix/commit/f750778edc4f1a8b2b086e197477db6ab4a54c1c))

### Code Refactoring

* update hook imports from tagix/hooks to tagix in documentation and examples. ([5173dc3](https://github.com/chrismichaelps/tagix/commit/5173dc374b7f0b265b91475882b806300049f929))

## [1.1.0](https://github.com/chrismichaelps/tagix/compare/v1.0.1...v1.1.0) (2026-02-11)

### Features

* add derived stores for computed state ([ed81adf](https://github.com/chrismichaelps/tagix/commit/ed81adf51d99dec36cbf080425353487bb2e25ee)), closes [#22](https://github.com/chrismichaelps/tagix/issues/22)
* add single-store overload and edge case tests for derived stores ([b3e34fa](https://github.com/chrismichaelps/tagix/commit/b3e34fa3b544f5515256a9f8215c497444f10ea0))
* export  and update action documentation. ([24fba92](https://github.com/chrismichaelps/tagix/commit/24fba92a9099fad9877606a3089deeab9e89c300))
* **function.ts:** add Gist author support ([d1b4635](https://github.com/chrismichaelps/tagix/commit/d1b4635c04d8aa9d94e39352c0117de525900b96))
* introduce action groups for better action organization and dispatching, along with supporting documentation and tests. ([f0cfe93](https://github.com/chrismichaelps/tagix/commit/f0cfe93d83fff14d325a4b0d985881a23ec2c1fa)), closes [#24](https://github.com/chrismichaelps/tagix/issues/24)
* Introduce Tagix store hooks for state access, selection, and subscription, complete with documentation and tests. ([50bfb80](https://github.com/chrismichaelps/tagix/commit/50bfb802c60765d90723b6099712474f7e086ca7))

### Bug Fixes

* add subscriber exception handling to prevent crashes ([f075e3a](https://github.com/chrismichaelps/tagix/commit/f075e3ad87c0bb908f97399cd9865d0176f11fad)), closes [#15](https://github.com/chrismichaelps/tagix/issues/15)
* add subscriber exception handling to prevent crashes ([d8a31aa](https://github.com/chrismichaelps/tagix/commit/d8a31aa618b6dd4895f38f675a14e33c05ccbcc3)), closes [#15](https://github.com/chrismichaelps/tagix/issues/15)
* add subscriber exception handling to prevent crashes ([31ddd18](https://github.com/chrismichaelps/tagix/commit/31ddd1840c4c734de47d0a145785bf9589aac246)), closes [#15](https://github.com/chrismichaelps/tagix/issues/15)
* add type-safe validation for async action effect property ([86df1e4](https://github.com/chrismichaelps/tagix/commit/86df1e4ff5b4aa3745d259c5e945ec04f1e09a36)), closes [#16](https://github.com/chrismichaelps/tagix/issues/16)
* ensure unique error history timestamps to prevent collisions ([12d6806](https://github.com/chrismichaelps/tagix/commit/12d6806f91f54aa9fcd7fd0c3699b2fa37aa14dd)), closes [#15](https://github.com/chrismichaelps/tagix/issues/15)
* **error:** add missing categories for new error types ([c6e13e9](https://github.com/chrismichaelps/tagix/commit/c6e13e9811bca250b9422002daf7b12827a18866))
* fork() creates isolated state for contexts ([b96ff04](https://github.com/chrismichaelps/tagix/commit/b96ff04861bc8e682a6ef104fe235cc29fdbe44c)), closes [#20](https://github.com/chrismichaelps/tagix/issues/20)
* resolve critical state mutation in TagixContext.merge() ([4b3deae](https://github.com/chrismichaelps/tagix/commit/4b3deaed5695025aae4776ef902af59e51c5522c)), closes [#14](https://github.com/chrismichaelps/tagix/issues/14)

### Performance Improvements

* **predicate:** optimize partition from O(n²) to O(n) ([8611cae](https://github.com/chrismichaelps/tagix/commit/8611cae590a0a26ad291847bc774dcc2be194dab))

### Documentation

* add Derived Stores documentation ([7ae0901](https://github.com/chrismichaelps/tagix/commit/7ae0901bcadafa9dcb191cad89609648c6fde6b2)), closes [#22](https://github.com/chrismichaelps/tagix/issues/22)
* **group:** fix arrow in JSDoc comment ([d971fda](https://github.com/chrismichaelps/tagix/commit/d971fda16fd227877acaf74b68c130f7e3b37439))
* update and expand documentation ([afcff3e](https://github.com/chrismichaelps/tagix/commit/afcff3ef67ddc883239741eae604ea581c32828f))
* Update example user data in READMEs and tests. ([a187799](https://github.com/chrismichaelps/tagix/commit/a187799d490f5deb548d31c85971f3d7d298c0d8))
* update logo references to use SVG format ([99af4f9](https://github.com/chrismichaelps/tagix/commit/99af4f997e4ee443de5cdb7abe41c97ec1a6429f)), closes [#22](https://github.com/chrismichaelps/tagix/issues/22)

### Styles

* pnpm format ([d3e8841](https://github.com/chrismichaelps/tagix/commit/d3e884158510ce7314a464ae93ec5c33a4943e08))

### Code Refactoring

* **context:** replace Error with ContextDisposedError ([1ae1eda](https://github.com/chrismichaelps/tagix/commit/1ae1edad52b92f87ac7ee18a09187c655fde583c))
* **error-names:** use reverse map and inline narrowing ([d7b49cc](https://github.com/chrismichaelps/tagix/commit/d7b49ccf3d6913b7cb7f4e5c4e9540cfc54f76d9))
* **error:** add ContextDisposedError to error system ([679fd81](https://github.com/chrismichaelps/tagix/commit/679fd81ed4808496ceb73bdaff3cee49adaa801f))
* **error:** add OptionNoneError and AbsurdError ([df0c960](https://github.com/chrismichaelps/tagix/commit/df0c9609647c4f0023b2f121bfa7d7925d9fe244))
* **factory,context:** remove redundant action casts in fork ([0a487da](https://github.com/chrismichaelps/tagix/commit/0a487dabdc38c0fa9734401d38646f5bcf233efe))
* **functions:** use hasProperty and isFunction in matchTag ([8dc0091](https://github.com/chrismichaelps/tagix/commit/8dc00913afbae0efb99d3301642eb80a680a5b46))
* pnpm format ([e16efd6](https://github.com/chrismichaelps/tagix/commit/e16efd67a973222855ed06990222d2bb0dba3e75))
* **selectors:** use guards in pluck for safe property access ([e7975f9](https://github.com/chrismichaelps/tagix/commit/e7975f98153ab9e7bd0f3594e8e68f93c4430f1e))
* **store:** replace type assertions with guards and AnyAction type ([ec5dbdf](https://github.com/chrismichaelps/tagix/commit/ec5dbdf20efe26b7c8392ecfe04a080e451853d6))
* **tagged-error:** use symbol check in getStoredArgs ([02df038](https://github.com/chrismichaelps/tagix/commit/02df038ed175fe786aef63653e756ea9a5a61af2))
* **test:** add TestError and replace throw new Error() ([c3a2262](https://github.com/chrismichaelps/tagix/commit/c3a2262101fa5cba5ef00926fa5a29ad349d42c7))

### Tests

* delete test-08-tagged-enum-state.cjs ([9363a32](https://github.com/chrismichaelps/tagix/commit/9363a32f36c224aae5f3f0c240860ec2eb85c282))

## [1.0.1](https://github.com/chrismichaelps/tagix/compare/v1.0.0...v1.0.1) (2026-02-07)

### Bug Fixes

- \_mergeAsyncState uses deep merge for nested objects ([3dca04d](https://github.com/chrismichaelps/tagix/commit/3dca04dc2a86bf42adc4f5b321e6c921faf32733)), closes [#6](https://github.com/chrismichaelps/tagix/issues/6)
- auto-prefix action type in dispatch() for consistency ([a8c8266](https://github.com/chrismichaelps/tagix/commit/a8c8266b904560bbdc06c4003f0713fb40cc5115)), closes [#1](https://github.com/chrismichaelps/tagix/issues/1)
- Context.select uses deep equality to skip unnecessary callbacks ([047df32](https://github.com/chrismichaelps/tagix/commit/047df3290109f63200bb0a30fd4629c8dbf384b2)), closes [#4](https://github.com/chrismichaelps/tagix/issues/4)
- DerivedContext.select subscription tracking ([82d602a](https://github.com/chrismichaelps/tagix/commit/82d602a9b3bedf422085d3fcad0375a779a76753)), closes [#5](https://github.com/chrismichaelps/tagix/issues/5)
- memoize uses deep equality instead of reference equality ([3fc6afb](https://github.com/chrismichaelps/tagix/commit/3fc6afb8b319ee172261741d662b84238b4e2cee)), closes [#4](https://github.com/chrismichaelps/tagix/issues/4)
- taggedEnum.State returns state object instead of undefined ([8034416](https://github.com/chrismichaelps/tagix/commit/803441644816cfa9097e96b9bf151d399b76ec7a)), closes [#8](https://github.com/chrismichaelps/tagix/issues/8)

### Documentation

- Add badges for npm, license, release workflow, and semantic-release to README. ([68ea63b](https://github.com/chrismichaelps/tagix/commit/68ea63b7594ad548ef7845c0a023052d96acabcb))
- add installation instructions to README ([0337bec](https://github.com/chrismichaelps/tagix/commit/0337bec778bea950edc2a51cfbf33a7ffbc666d1))
- apply formatting ([70e66d2](https://github.com/chrismichaelps/tagix/commit/70e66d2ff99771773b6fabe1cd11521ae97a40ba))
- Remove duplicate 'Installation' heading from README. ([20518c0](https://github.com/chrismichaelps/tagix/commit/20518c0d79f5a68f9547b4163a224c2ee3636301))

### CI/CD

- Limit release workflow trigger to changes in source and build configuration files. ([5974555](https://github.com/chrismichaelps/tagix/commit/59745557b559ffcac8ce4ca5cb13c8b8fed1a95d))

## 1.0.0 (2026-02-03)

### Features

- **actions:** add RelaxedState type for variant property access ([1e32955](https://github.com/chrismichaelps/tagix/commit/1e32955d9c21f0ab6b568488efe6171fb0f01e99))
- add action creators for sync and async operations ([30c33ca](https://github.com/chrismichaelps/tagix/commit/30c33ca1e611fbdc08f0d0c9fcdeca74eeb54a4e))
- add context module with dependency injection ([5d90b27](https://github.com/chrismichaelps/tagix/commit/5d90b273ffc2209d92dd5e07358c79ef7f81ce78))
- add functional programming primitives ([426f4de](https://github.com/chrismichaelps/tagix/commit/426f4de87b24d2a9f1b9bdf0f9c347e6d32fc435))
- add GetState type to tagged enum ([4ba0f42](https://github.com/chrismichaelps/tagix/commit/4ba0f42aaf6e534ad7d977ffa17c18ac726d7803))
- add main library exports ([32bd5c6](https://github.com/chrismichaelps/tagix/commit/32bd5c6b81631f89ed967878a1f64ab3b3b32f52))
- add maxRetries configuration option ([a200566](https://github.com/chrismichaelps/tagix/commit/a200566766ddadf600b410c81db5374d0279b0eb))
- add middleware system with logger ([de4ade7](https://github.com/chrismichaelps/tagix/commit/de4ade710e67f92dacafc95305ffaa385f72c46a))
- add Option type helpers for context get operation ([c327d9e](https://github.com/chrismichaelps/tagix/commit/c327d9e073da18c95d5b66a3a0baa4a6d7a6454c))
- add pattern matching utilities ([247c3ec](https://github.com/chrismichaelps/tagix/commit/247c3ec39d68d2319446b5685b00efc507353345))
- add selectors with memoization ([132c467](https://github.com/chrismichaelps/tagix/commit/132c4675bc1ceb238eade2f1e9fa126e91c83045))
- add state-utils module for tagged union operations ([85a04c9](https://github.com/chrismichaelps/tagix/commit/85a04c92683a915e71c79384c34e63d8ea65897f))
- add type-safe state guards ([73a0f9f](https://github.com/chrismichaelps/tagix/commit/73a0f9f4522c0cae8791040820a298a6f1c3c3e4))
- implement core store with history management ([e7224d4](https://github.com/chrismichaelps/tagix/commit/e7224d4b283284990993886e79e7c9598999019c))
- improve selectors with additional utilities ([97951db](https://github.com/chrismichaelps/tagix/commit/97951db43d44c904a4c9662777acfac633e541e9))
- **store:** improve select method generic inference ([038eeef](https://github.com/chrismichaelps/tagix/commit/038eeef988fc2d640d1a63ca7814a916b901a303))
- **store:** support action creator dispatch pattern ([60d940c](https://github.com/chrismichaelps/tagix/commit/60d940c3ab1351e06e5f2506867325f881585f96))

### Bug Fixes

- add function overloads to action creators ([af7a39f](https://github.com/chrismichaelps/tagix/commit/af7a39f12a525fc6492d76b93b5ed75f87b9b9bb))
- call subscriber callback immediately on subscribe ([2c40010](https://github.com/chrismichaelps/tagix/commit/2c4001041012674a7d9c2ce6ddf90c606436d477))
- **guards:** fix withState generic type parameter ([b90adb9](https://github.com/chrismichaelps/tagix/commit/b90adb9d12aff5d1b0c9a097c4c6d35c62b98a2b))
- improve dispatch payload handling and error matching ([39c7f73](https://github.com/chrismichaelps/tagix/commit/39c7f735fd6437e552d0bb86dc06736fc61424e6))
- optimize pluck selector with early return ([bcdefd8](https://github.com/chrismichaelps/tagix/commit/bcdefd8790e781ac787f04fa6df61976f7686797))
- resolve payload passing and history management bugs in store ([df2addb](https://github.com/chrismichaelps/tagix/commit/df2addb33b1c5dd606ea02ec3a91edd34dca0b9f))
- resolve test syntax errors in actions and selectors ([42d645d](https://github.com/chrismichaelps/tagix/commit/42d645d0562edfb86af02e1e4b29437528bc979c))
- **types:** update Middleware type to support blocking actions ([0910672](https://github.com/chrismichaelps/tagix/commit/0910672421eeb63e48f58bfac436845941c551e6))
- update core store implementation ([ecd41e8](https://github.com/chrismichaelps/tagix/commit/ecd41e87c14c32f7ee05405cf90dce8dc66e3741))

### Documentation

- add CONTRIBUTING and SECURITY guidelines, and funding information ([8351b40](https://github.com/chrismichaelps/tagix/commit/8351b40051869e0d140b38144a1d1543ccdb746b))
- Add documentation link to README. ([1700fd9](https://github.com/chrismichaelps/tagix/commit/1700fd9d7ccac52c088f46de8f58f1d3e14be1f0))
- add project README ([a87d17d](https://github.com/chrismichaelps/tagix/commit/a87d17de4521ad375d64397f723e4c32ba9a27aa))
- add TSDoc comments to action creators ([642efc6](https://github.com/chrismichaelps/tagix/commit/642efc6fb3f6dccc7a33342fb8c8c8efe7ea47e9))
- add TSDoc comments to core store and types ([cf6340e](https://github.com/chrismichaelps/tagix/commit/cf6340e22e9099b509d7c33571d2a00fb8148545))
- add TSDoc comments to error handling ([6efa79b](https://github.com/chrismichaelps/tagix/commit/6efa79bc0b8d6def1721237895ea2733a0e50c62))
- add TSDoc comments to guards ([e39134b](https://github.com/chrismichaelps/tagix/commit/e39134b813d97214fed56afb66ce10f13ba8ab8d))
- add TSDoc comments to logger middleware ([c242f2d](https://github.com/chrismichaelps/tagix/commit/c242f2d96c06a8409ab386da884f9c508ca46771))
- add TSDoc comments to match utilities ([e401b57](https://github.com/chrismichaelps/tagix/commit/e401b57b315f5194cc84aaa88db4e97140c0193e))
- add TSDoc comments to selectors ([9b84b2d](https://github.com/chrismichaelps/tagix/commit/9b84b2d736b83f841c22e0cb38ec8e26fefd8e46))
- Clean up tagix documentation md files. ([ba8c52d](https://github.com/chrismichaelps/tagix/commit/ba8c52d0251f149369227913c41fb1e4a160b3d0))
- Clean up tagix documentation md files. ([0127968](https://github.com/chrismichaelps/tagix/commit/01279683284876ca5c5793342d076bcf88d9c752))
- document onError config in createContext ([e5de283](https://github.com/chrismichaelps/tagix/commit/e5de28392928382bafd71b1cdfd5376097136d3b))
- export state-utils from Data module ([fd327ca](https://github.com/chrismichaelps/tagix/commit/fd327ca5609d6c3b4b835753e325aba21d8b2c2e))
- remove .sidebar.json configuration file ([bc0da51](https://github.com/chrismichaelps/tagix/commit/bc0da5174fe7f06e0a04a644444b0f7bfe7d54d8))
- remove history documentation from createStore ([df1e3f5](https://github.com/chrismichaelps/tagix/commit/df1e3f55b0e90268d2174716033dac70126dc93a))
- remove history management from library description ([b5fb848](https://github.com/chrismichaelps/tagix/commit/b5fb848f63a3dc8156f008f1985b78d08cdccac0))
- remove maxUndoHistory from createStore example ([ec142c3](https://github.com/chrismichaelps/tagix/commit/ec142c3c4cdfce212ae7efc235be1ce8a8b1414f))
- update guards and match documentation ([731ac7a](https://github.com/chrismichaelps/tagix/commit/731ac7a8924b17f879c9d4630a17824730faa800))
- update READMEs with middleware blocking and state freshness ([f2d1b6f](https://github.com/chrismichaelps/tagix/commit/f2d1b6f14258ed3589eedf071849db5692dc4e07))

### Code Refactoring

- add isRecord import and MinimalStore interface ([5a19c83](https://github.com/chrismichaelps/tagix/commit/5a19c83a2cae7cf6eaa2dc5d0fca8ca0f0045785))
- export context module from store index ([7d2368f](https://github.com/chrismichaelps/tagix/commit/7d2368fbd6e049cd3d308630dde43ad2064c41ee))
- remove duplicate immediate call in context.select ([0669894](https://github.com/chrismichaelps/tagix/commit/0669894c4778030155f822d7ffc89767f1821126))
- remove history methods and properties from store ([202b267](https://github.com/chrismichaelps/tagix/commit/202b26709cdacf86507331a34ccb2d994ee8565d))
- remove maxSnapshots and maxUndoHistory from config ([5954597](https://github.com/chrismichaelps/tagix/commit/5954597a24004d684011bc175d93148b61a5d470))
- remove Snapshot and DerivedDefinition types ([76739c4](https://github.com/chrismichaelps/tagix/commit/76739c4586438471025a335069094bec5b048722))
- remove SnapshotNotFoundError and MaxHistoryExceededError ([48aa900](https://github.com/chrismichaelps/tagix/commit/48aa9009ab98a43a77beeb9e193ca8c094130d9b))
- remove unused types from src/types ([b503c39](https://github.com/chrismichaelps/tagix/commit/b503c39117c97bd2c5a90c31d19f16cccb2f5060))
- replace optional chaining with predicates in logger middleware ([dd90923](https://github.com/chrismichaelps/tagix/commit/dd90923dd64446fe39a13919d74f8f8794ed8e64))
- replace optional chaining with predicates in tagged-error ([295c584](https://github.com/chrismichaelps/tagix/commit/295c58492ececd28260a989896ad8a4eb1f49001))

### Tests

- **actions:** add comprehensive dispatch API tests ([0c204dd](https://github.com/chrismichaelps/tagix/commit/0c204dd85d95f5a727cec307d9f047651295e2ff))
- **actions:** update tests with proper type assertions ([13fdf17](https://github.com/chrismichaelps/tagix/commit/13fdf174a3e28b2fa721fb0d808f694848a1f814))
- add additional test coverage for guards, match, and middleware ([c00aea0](https://github.com/chrismichaelps/tagix/commit/c00aea0e8c451722ea668cee325666ff0e4e67d8))
- add error callback and cleanup verification tests ([0c0c0fb](https://github.com/chrismichaelps/tagix/commit/0c0c0fb57cf62302d5d506a65aa6429fec2ef070))
- add logger middleware option tests ([7a6a63b](https://github.com/chrismichaelps/tagix/commit/7a6a63b17c4b949a41afab3825a5945776a9c289))
- add test utilities for store testing ([009608e](https://github.com/chrismichaelps/tagix/commit/009608e22f06a961bf2ac1f3a9bf1cfc10380a61))
- **core:** update factory tests with new state patterns ([db9ae11](https://github.com/chrismichaelps/tagix/commit/db9ae11f16084c94376a6690556a86697a142d9f))
- **guards:** update tests to use asVariant and TaggedEnum ([bec3b36](https://github.com/chrismichaelps/tagix/commit/bec3b364219bca816f66513ed463b4311aebdb03))
- remove undo/redo and snapshot tests from factory ([f033667](https://github.com/chrismichaelps/tagix/commit/f033667bfaf6895d5d61766c2ff0667a5128e1eb))
- replace optional chaining with predicates in factory tests ([e3542db](https://github.com/chrismichaelps/tagix/commit/e3542dbaac3149455126ca249e14875c85219062))
- replace optional chaining with predicates in logger tests ([4e41aff](https://github.com/chrismichaelps/tagix/commit/4e41affb5fd569b618ceb8b50b376cd5aa39c684))
- **selectors:** fix selector type signatures ([301fe56](https://github.com/chrismichaelps/tagix/commit/301fe564834ba289fbe598a793fbbc81d0b27a9d))
- update context tests for immediate callback behavior ([4a2b8fd](https://github.com/chrismichaelps/tagix/commit/4a2b8fd256240cb14acf60a5a55f69a893415f5b))
- update factory tests for immediate callback behavior ([e09212a](https://github.com/chrismichaelps/tagix/commit/e09212a265e2ae0c94fd8ff882782a764f10fe4a))
- update logger middleware tests ([5a510a9](https://github.com/chrismichaelps/tagix/commit/5a510a96824ff617796fb70bbb8c903553360aec))
- update test cases ([366d589](https://github.com/chrismichaelps/tagix/commit/366d58904d11ad94b0152f992e88418e4a2fe90d))

### CI/CD

- Implement automated releases using semantic-release and GitHub Actions. ([89bc1ee](https://github.com/chrismichaelps/tagix/commit/89bc1ee65605a78d1a184c01146c5ca02b580cb0))

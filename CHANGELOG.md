# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.1.5](https://github.com/daniel-marcus/neuralnetvis/compare/v0.1.4...v0.1.5) (2026-10-16)

### Features

* **3d-model:** sharp vector text instead of canvas textures ([9209193](https://github.com/daniel-marcus/neuralnetvis/commit/92091933c9c258c24a8005a71b72ee56b6cb899b))
* add tinystories dataset & model ([3548d0b](https://github.com/daniel-marcus/neuralnetvis/commit/3548d0b82ced11119a71c7adfd6dd42dc4209ada))
* **autocomplete:** show tokens/s ([f9b748d](https://github.com/daniel-marcus/neuralnetvis/commit/f9b748d550bb2345ba8c4d266f829120d7afb44a))
* **connections:** frame the inputs of the hovered neuron ([e7ec857](https://github.com/daniel-marcus/neuralnetvis/commit/e7ec857e1e4af6ccf24db1161be264a91a9b45c9))
* cover ([38d3519](https://github.com/daniel-marcus/neuralnetvis/commit/38d35193d3e5184f49a56ce507fbf324749aeb97))
* **data:** add autocomplete for nextToken ([9b5694d](https://github.com/daniel-marcus/neuralnetvis/commit/9b5694dd0331a90a3c50abc6a26947e23c0d4a7c))
* **data:** add text area for custom text samples ([3f871cd](https://github.com/daniel-marcus/neuralnetvis/commit/3f871cd9f501587f81e09cc6689fa852ee5c0bc1))
* **data:** add TweetsTokenizer ([f142cfc](https://github.com/daniel-marcus/neuralnetvis/commit/f142cfcaa60a98258b96dcf4b0afe47ee4b45301))
* **data:** top-p sampling for autocomplete ([e34c95f](https://github.com/daniel-marcus/neuralnetvis/commit/e34c95f7089cbe56ff1dc6b823b228a7d8c47796))
* **data:** tweets dataset scaffold ([b8a9be2](https://github.com/daniel-marcus/neuralnetvis/commit/b8a9be23b2074a66cde732963adafaa2786c9ae4))
* **DrawArea:** auto enable when ds has draw options ([8b1dc20](https://github.com/daniel-marcus/neuralnetvis/commit/8b1dc20834f453842ef7dfbb85c04117a5e1d93d))
* **FeatureVis:** generate input that excites a single neuron the most ([9751ba1](https://github.com/daniel-marcus/neuralnetvis/commit/9751ba164bb206a47be09981542f5faa53d9cd73))
* **HoverConnections:** support textured layers and weightless layers ([dea3dce](https://github.com/daniel-marcus/neuralnetvis/commit/dea3dce9384e2a57d243e78d24bb4b9de45ccac9))
* **InputArea:** auto-hide ([2f80770](https://github.com/daniel-marcus/neuralnetvis/commit/2f8077052d185f5a6e9570b7a1ef2869330729e9))
* **interactions:** hover and select neurons in 3D view ([07e1357](https://github.com/daniel-marcus/neuralnetvis/commit/07e13575617a2c49e760cc804ff82f5184c8fdc1))
* **layers:** frame the inputs of attention neurons ([de263b1](https://github.com/daniel-marcus/neuralnetvis/commit/de263b1259348e62ed72c7d333650d176fdf2b96))
* **layers:** frame the inputs of GlobalAveragePooling1D neurons ([aff7b8a](https://github.com/daniel-marcus/neuralnetvis/commit/aff7b8aabb9d5b68ba44791f90701d58642d7a5f))
* **layers:** spheres for 1D layers ([5eabf2d](https://github.com/daniel-marcus/neuralnetvis/commit/5eabf2d58c9fa3eae26d7e1da9788ecff8582718))
* **layers:** support layers with more than one input ([2948b62](https://github.com/daniel-marcus/neuralnetvis/commit/2948b624572d1055909842445bf5f01474168668))
* **learn:** BlockGroup for shared scroll actions, constant block spacing ([28eb600](https://github.com/daniel-marcus/neuralnetvis/commit/28eb600cfe4c2275863626cc9a6b33c3902a3cfc))
* **learn:** content for "How do machines learn?" ([6d174ff](https://github.com/daniel-marcus/neuralnetvis/commit/6d174ffe0fe45bffac28f54822f16c6a89701117))
* **learn:** free exploration mode for unlocked lessons ([56ab7e5](https://github.com/daniel-marcus/neuralnetvis/commit/56ab7e5189892ad30f22eb405df706c1240980a9))
* **learn:** lesson infrastructure for neuron inspector & predictions ([e87f5bc](https://github.com/daniel-marcus/neuralnetvis/commit/e87f5bcfeb4100f44039468c65ee43c277064fee))
* **learn:** scroll-driven training ([8eb081f](https://github.com/daniel-marcus/neuralnetvis/commit/8eb081f62b296fd82472a20cc989a02f67bc2049))
* **learn:** show every connection while sweeping the output neurons ([47201ac](https://github.com/daniel-marcus/neuralnetvis/commit/47201acef747b440718eca1f1ea696c521565ebe))
* **model:** add ReversibleEmbedding layer ([f3899fe](https://github.com/daniel-marcus/neuralnetvis/commit/f3899fe5031c1195f05d41db7e77756332cd1451))
* **model:** add tweets model (v0.2, partially trained) ([144ee2d](https://github.com/daniel-marcus/neuralnetvis/commit/144ee2dd20de22edc29faf0108915f1c0b6fbf34))
* **model:** color text input tokens by their impact on the prediction ([7b3a4f1](https://github.com/daniel-marcus/neuralnetvis/commit/7b3a4f1519ffe36eb3e56b4a4244a64231033748))
* **model:** gpt-2 ([193ddb4](https://github.com/daniel-marcus/neuralnetvis/commit/193ddb4e2981f74410777afb4518533a0dd118f2))
* **model:** key 'm' shows model/ds status ([cfa0f3a](https://github.com/daniel-marcus/neuralnetvis/commit/cfa0f3a3fe8e04fa08e5a78800eac9897252e426))
* **model:** link to model in showModelStatus ([69c1b2b](https://github.com/daniel-marcus/neuralnetvis/commit/69c1b2be53cdf1f212d1c984a8ac13f85627315c))
* **model:** load safetensors from HF ([2387ef7](https://github.com/daniel-marcus/neuralnetvis/commit/2387ef7a2bdbe3ad38469fd5afa34d7a08f8da52))
* **model:** neutral token colors for nextToken text input ([bffe42d](https://github.com/daniel-marcus/neuralnetvis/commit/bffe42d540930904225c51a56c7fb7eb85c7bdb1))
* **model:** new tweet transformer ([b15b658](https://github.com/daniel-marcus/neuralnetvis/commit/b15b65850a5e8dabff9c3ad79fced241dfd22042))
* **model:** nextToken evaluation ([b276bc7](https://github.com/daniel-marcus/neuralnetvis/commit/b276bc7bed54bfd7b68551e1ea40d0f23a3857e4))
* **models:** new transformer model for imdb ([497e9a5](https://github.com/daniel-marcus/neuralnetvis/commit/497e9a5d273cdb4811b0251afd335e5ed323c6a4))
* **model:** support use_causal_mask in keras import for MultiHeadAttention ([1a0ae11](https://github.com/daniel-marcus/neuralnetvis/commit/1a0ae11af666c5e1ba2c0cb723986ebefe301ffe))
* **model:** switch tinystories to TinyStories-3M ([9e197bf](https://github.com/daniel-marcus/neuralnetvis/commit/9e197bf7edd7da8b0e29ad2565cc60a4472c1e64))
* **model:** use fetchWithProgress for weights ([e3b21e4](https://github.com/daniel-marcus/neuralnetvis/commit/e3b21e433838ca9f2886b2f3919c535fd285bde2))
* **NeuronInspector:** add top-k view ([f8ca388](https://github.com/daniel-marcus/neuralnetvis/commit/f8ca38880ba2d4c23e50ebc3d98644ea671f209f))
* **NeuronInspector:** add weighted inputs view ([9be8ab5](https://github.com/daniel-marcus/neuralnetvis/commit/9be8ab5a1c071210a525f95ab321b18e9db0c506))
* **NeuronInspector:** paginate top samples ([afcc4cf](https://github.com/daniel-marcus/neuralnetvis/commit/afcc4cfda66780280ef7812b9df9ed7c56976b68))
* **NeuronInspector:** show weights in collapsed models ([9f2e260](https://github.com/daniel-marcus/neuralnetvis/commit/9f2e2607f1ca385e8702447b102be0f745681bde))
* **NeuronInspector:** upgraded UI ([7441953](https://github.com/daniel-marcus/neuralnetvis/commit/74419530825c959d9ad250c760e8877d595b91f4))
* new LayerLabel ([f1a3364](https://github.com/daniel-marcus/neuralnetvis/commit/f1a3364a1c127bfb9253e606601acac22eaf9b34))
* new task type 'nextToken' ([bc42516](https://github.com/daniel-marcus/neuralnetvis/commit/bc4251664a7c263d136c623dcb280fac5fd1a1f0))
* **SampleViewer:** auto-hide ([9523460](https://github.com/daniel-marcus/neuralnetvis/commit/9523460f4f653ebd09ddf4aab42ac0d3fd4a481c))
* **SampleViewer:** follow the current sample ([4d8c6f0](https://github.com/daniel-marcus/neuralnetvis/commit/4d8c6f06301c0947bf3b618d433fe96feb1ee2c0))
* **scripts:** convert keras w/ weight shards ([c09c2c1](https://github.com/daniel-marcus/neuralnetvis/commit/c09c2c1e980a8b989aa9fe7f6773bdd293fe1ccb))
* **text-area:** don't wrap suggestions on mobile ([2158f40](https://github.com/daniel-marcus/neuralnetvis/commit/2158f40cca03395fbadcdef8a20d4d8b584c33e6))
* **TextArea:** autoscroll during autocomplete ([79f1f34](https://github.com/daniel-marcus/neuralnetvis/commit/79f1f345e28136d42967c72b5fd49864ad8a8ba5))
* **TextArea:** keyboard commands ([525694a](https://github.com/daniel-marcus/neuralnetvis/commit/525694a42f043d769360dbe8b578cf9544dcd225))
* **tokenizer:** add HF tokenizers ([14bd694](https://github.com/daniel-marcus/neuralnetvis/commit/14bd69415dfd2d1d1e333e64d5d61e6b41294dc3))
* TokenLayer ([f05661a](https://github.com/daniel-marcus/neuralnetvis/commit/f05661a1e63001eaa0145dd0ddae02d3978f6965))
* **vis:** viewShift to shift the rendered 3D view horizontally ([9eee75d](https://github.com/daniel-marcus/neuralnetvis/commit/9eee75d2177a11ade93f40f47306bb8431fbf244))

### Bug Fixes

* **activations:** always upd output layer for nextToken ([2c6ed61](https://github.com/daniel-marcus/neuralnetvis/commit/2c6ed61a01263deced6ce453bfd73ad6d890100b))
* **color-channels:** avoid z-fighting between color channel layers ([7485732](https://github.com/daniel-marcus/neuralnetvis/commit/7485732d96d08f5e9533a9191daac7e0402fc48e))
* **header:** show on top in learn mode ([20449fa](https://github.com/daniel-marcus/neuralnetvis/commit/20449fa4371b166a2c07fd7405e625b040c5d14c))
* **HoverConnections:** honor padding in receptive fields ([3fdddcb](https://github.com/daniel-marcus/neuralnetvis/commit/3fdddcb0967384df56562bd558b6341518ccd7cf))
* **HoverConnections:** no lines to the input layer in collapsed models ([cd29c22](https://github.com/daniel-marcus/neuralnetvis/commit/cd29c224b4de5070ed5bbc8588a60a50a8a4b0f4))
* **import-keras.ts:** fix broken import from keras 3.13.0 ([e30439d](https://github.com/daniel-marcus/neuralnetvis/commit/e30439dfaac0b07282824f435a64a8d820146ac3))
* **InputArea:** overlap w/ NeuronInspector ([3eb0f44](https://github.com/daniel-marcus/neuralnetvis/commit/3eb0f441b90b9a5d4395258455e7e4ae957c8cef))
* **interactions:** show layer hover box against the background ([76160d9](https://github.com/daniel-marcus/neuralnetvis/commit/76160d915ee16fe0d76238e0233c3a3b3b522f99))
* **interactions:** show layer hover fill on textured layers ([365a1e1](https://github.com/daniel-marcus/neuralnetvis/commit/365a1e1f20ed6f14fb0880beb6ca9073b81b91ba))
* **layers:** connect Dense neurons on sequences to their own position ([b6cfe17](https://github.com/daniel-marcus/neuralnetvis/commit/b6cfe17779a26cb378ebcb92e20b0595bd84af88))
* **layers:** release activation buffers with their model ([204f1c1](https://github.com/daniel-marcus/neuralnetvis/commit/204f1c1eb69e4f1b2e21becbb21cf30ef04a72df))
* **LayerWheel:** honor vis.showHiddenLayers ([2fc8539](https://github.com/daniel-marcus/neuralnetvis/commit/2fc8539bcdff6eda376f682a0bf7a0a2222021c4))
* **learn:** keep inline DrawArea visible while a neuron is selected ([a5df211](https://github.com/daniel-marcus/neuralnetvis/commit/a5df211d4ef394bfcbafe5c9b7415fa7ed7174c7))
* **learn:** stable layout after predictions, no "Ready to play?" CTA ([086f92b](https://github.com/daniel-marcus/neuralnetvis/commit/086f92b937f9578e2d1dd7d76fb0984b9bba4d68))
* **learn:** stop the final CTA in the viewport center ([6b62fc5](https://github.com/daniel-marcus/neuralnetvis/commit/6b62fc53619be8ce6c982bebf18848bb447d2dd4))
* **mobilenet:** normalize input to [-1, 1] ([e44fcab](https://github.com/daniel-marcus/neuralnetvis/commit/e44fcab2f1012e7626244e5f24969930f83dc248))
* **MultiHeadAttention:** use single graph input for self-attention ([66c6416](https://github.com/daniel-marcus/neuralnetvis/commit/66c6416431901d677abe35848ea207a74ed80f31))
* **NeuronInspector:** rank top samples by weighted input ([6596fb5](https://github.com/daniel-marcus/neuralnetvis/commit/6596fb534f875c452abf52da2d8191b200ac60d5))
* **neurons:** skip layers of disposed models after model changes ([5c621fb](https://github.com/daniel-marcus/neuralnetvis/commit/5c621fb4a268645aa1d6fca98f0c71bd454fa618))
* **TextureLayer:** add out-of-bounds check ([ce7cb3b](https://github.com/daniel-marcus/neuralnetvis/commit/ce7cb3bb1b869d5ac36f6a9627415ae1d050672b))
* **tokenizer:** keep accents and line-break word boundaries ([3af5bfe](https://github.com/daniel-marcus/neuralnetvis/commit/3af5bfe8b804fed20ce5e34feb48dc879d5fae65))
* **vis:** re-measure layer size when neuron spacing changes ([9e3ea4c](https://github.com/daniel-marcus/neuralnetvis/commit/9e3ea4ca75c7ca2cdff8615e5f24e79df18fea9a))

## [0.1.4](https://github.com/daniel-marcus/neuralnetvis/compare/v0.1.3...v0.1.4) (2026-01-04)


### Features

* add quickdraw dataset & model ([783a148](https://github.com/daniel-marcus/neuralnetvis/commit/783a148b0d8912faec0e13087ebb9f42fd728401))
* **datasets:** add draw options ([fa24d23](https://github.com/daniel-marcus/neuralnetvis/commit/fa24d2397a9f81e2f57b90b1d8ffc8719e1d822a))
* **DrawArea:** add pencil cursor ([6752e49](https://github.com/daniel-marcus/neuralnetvis/commit/6752e49e55c3f6bb2266e1880068a548ed17d515))


### Bug Fixes

* **MyModels:** fix model save ([1d96d7c](https://github.com/daniel-marcus/neuralnetvis/commit/1d96d7c4af44ce085f9c9772f9d8be5944dc2358))

## [0.1.3](https://github.com/daniel-marcus/neuralnetvis/compare/v0.1.2...v0.1.3) (2026-01-03)


### Features

* **DrawArea:** add draw area to draw digits for mnist ([b81174e](https://github.com/daniel-marcus/neuralnetvis/commit/b81174ee0821692f444ec9843a2ee1055bf91bfc))
* **mnist-conv:** add new pretrained conv model for mnist dataset ([29e26d8](https://github.com/daniel-marcus/neuralnetvis/commit/29e26d872abdb85aeab3647615f997453afac043))
* **model.tsx:** add version check for pretrained models ([7c44020](https://github.com/daniel-marcus/neuralnetvis/commit/7c44020d48e347d5a944f49ce07c86c59f200201))


### Bug Fixes

* **RandomRotation:** applyAtInference default false ([25e76bb](https://github.com/daniel-marcus/neuralnetvis/commit/25e76bbfbf830177b97a7d17551beb7a2df72b12))
* **SampleViewer:** fix containerWidth 0 glitch ([c38f1eb](https://github.com/daniel-marcus/neuralnetvis/commit/c38f1ebc227c910dfd74f0db4f541a407bba0c85))

## [0.1.2](https://github.com/daniel-marcus/neuralnetvis/compare/v0.1.1...v0.1.2) (2025-12-30)


### Bug Fixes

* fix more eslint errors / warnings ([437d60e](https://github.com/daniel-marcus/neuralnetvis/commit/437d60e11693a7411e3e1687725e0ca75c5bc31d))
* **flat-view.ts:** fix interference w/ model cameraShifter ([5b9d590](https://github.com/daniel-marcus/neuralnetvis/commit/5b9d590fa5555153d8ec1e974c9b98fb5f39f425))
* **LayerInteractions:** exclude labels from layer size measure ([848ce97](https://github.com/daniel-marcus/neuralnetvis/commit/848ce97f1b7367147d83a797691bbbcd5bd814ed))

## [0.1.1](https://github.com/daniel-marcus/neuralnetvis/compare/v0.1.0...v0.1.1) (2025-12-29)


### Features

* **tooling:** changelog with commit-and-tag-version ([e4446fc](https://github.com/daniel-marcus/neuralnetvis/commit/e4446fc8cd3f71b0b48358cca03ff26185375a8d))


### Bug Fixes

* fix eslint errors / warnings ([24c3e6c](https://github.com/daniel-marcus/neuralnetvis/commit/24c3e6c3815b2dac9b7b0c8ef5e9c2aeadc7a715))
* fix more eslint errors / warnings ([0ba6bc7](https://github.com/daniel-marcus/neuralnetvis/commit/0ba6bc7afcd19b84e62c23c91f58dd33158f3668))

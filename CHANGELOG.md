# Changelog

Release Please maintains this file from conventional commits merged into `main`.

## [1.3.0](https://github.com/Baltii/Subloom/compare/v1.2.0...v1.3.0) (2026-10-21)


### Features

* add directional navigation and modal transitions ([09c402a](https://github.com/Baltii/Subloom/commit/09c402ae40fef2145ec60457e27f4ab9cbea6a50))
* suggest matching services while typing subscription names ([6bdc2cd](https://github.com/Baltii/Subloom/commit/6bdc2cdbea9c780d1ea0069d823257439eab8c6f))


### Bug Fixes

* **ci:** handle historical release tags without mismatched artifacts ([94f15b5](https://github.com/Baltii/Subloom/commit/94f15b546d0f7f00387bc2a3e18fc0335f4a9c9f))
* **ci:** skip mismatched artifacts for historical releases ([daa8c40](https://github.com/Baltii/Subloom/commit/daa8c40b554e9d6e110914bb4248800bb8f76b7f))
* respect Android system navigation safe area ([a1ccf9f](https://github.com/Baltii/Subloom/commit/a1ccf9f8dc8b8a5b77cc4e06cb71c9936e0dba4b))
* **security:** keep Firebase Android configuration out of Git ([0ac0d11](https://github.com/Baltii/Subloom/commit/0ac0d112deb5b0db10a2f8349ade2cd5281f691e))
* **security:** move Firebase Android configuration to build secrets ([b0afdd5](https://github.com/Baltii/Subloom/commit/b0afdd5a6902c464a54ca1f288505a48d4779ac1))

## [1.2.0](https://github.com/Baltii/Subloom/compare/v1.1.0...v1.2.0) (2026-10-21)


### Features

* add a theme-aware three-step welcome flow ([a0ad6a1](https://github.com/Baltii/Subloom/commit/a0ad6a1e5c799fdcaa4d9886ea7bde7f8eed51e6))
* add Bitcoin watch history, wallet payment review and renewal preferences ([b9e84bd](https://github.com/Baltii/Subloom/commit/b9e84bd3863e14ff601e93992711341aa60a31f9))
* add cancellation watch and evidence packets ([5e61768](https://github.com/Baltii/Subloom/commit/5e617683635e74a12aaf0e4a7775caafab213140))
* add card labels and original-currency transaction journal ([35fc7a2](https://github.com/Baltii/Subloom/commit/35fc7a217a287ffbb760765474201175addad567))
* add cards and wallets payment-source hub ([8cd977a](https://github.com/Baltii/Subloom/commit/8cd977a68587efe7f716a3e34de042c21848314a))
* add family settlement ledger and request drafts ([46416fd](https://github.com/Baltii/Subloom/commit/46416fdb6e9b7dbebe26f91cdc02470d8e2d991f))
* add playful payment UI and eight accent themes ([4f81b59](https://github.com/Baltii/Subloom/commit/4f81b59e47f88b5cea43f5987c53af57dd1d98b6))
* add realistic saved card faces and billing icons ([80a578b](https://github.com/Baltii/Subloom/commit/80a578b7ca73e789c37481b1ef791492defb27f5))
* add renewal reserve and payday planning ([b6a71b4](https://github.com/Baltii/Subloom/commit/b6a71b45210ff13a146709c6d84f6bff0ef7af18))
* add renewal review rules and confirmation tracking ([4d564f0](https://github.com/Baltii/Subloom/commit/4d564f0cb73256b2f7f391b9d9947b916dbf1156))
* add service cancellation instructions and website links ([fd11d91](https://github.com/Baltii/Subloom/commit/fd11d9157d24dd525fbfb74e8c0ed950cab1b662))
* add statement imports and subscription radar ([6715774](https://github.com/Baltii/Subloom/commit/6715774dc3a2add90218e3f6667a1c749d749ee7))
* add subscription value coach and confirmed comparisons ([2c83f15](https://github.com/Baltii/Subloom/commit/2c83f154a5d17f4f53a8e49555479b1181329c16))
* add unenforced virtual card plans and simulations ([df24bc0](https://github.com/Baltii/Subloom/commit/df24bc017b7a57b70b531850310506607a631039))
* cache daily currency reference rates and show exact estimates ([76db381](https://github.com/Baltii/Subloom/commit/76db381d2ce1670aa32c15fd683f4b8770b461dd))
* finish combined app flows and document release readiness ([4d16b8b](https://github.com/Baltii/Subloom/commit/4d16b8b73710d8a3fe64769b9d06c8b1c970990b))
* save cards and wallets as subscription billing methods ([67bb37c](https://github.com/Baltii/Subloom/commit/67bb37cbafbbe82c2626577f02f02b508289eb4b))
* unify Subloom branding and publish animated landing page ([3b2113a](https://github.com/Baltii/Subloom/commit/3b2113afe4ffd5e33b3e99865b852c8c14480c9b))


### Bug Fixes

* build Expo web output on Vercel and stabilize CI fixtures ([31b0177](https://github.com/Baltii/Subloom/commit/31b017714aff9ef1d7919a6d7a851aaacf203ba0))
* include homepage in production response headers ([2bf5bc7](https://github.com/Baltii/Subloom/commit/2bf5bc755610d65532f50c7009d5eda9819b71f4))
* make Android EAS builds use reproducible npm installs ([fba0529](https://github.com/Baltii/Subloom/commit/fba05297f1f67929dcc2fdc4f7ef09ce37df9b23))
* make EAS dependency installation reproducible ([781780b](https://github.com/Baltii/Subloom/commit/781780bdf4c18d4d64aad6b73df3573f58f16f89))
* match saved card faces to light and dark appearance ([310f758](https://github.com/Baltii/Subloom/commit/310f758bc29120cb91ae7ef2ba9180d411b156f7))
* refresh finance records on return and harden financial feedback ([068094c](https://github.com/Baltii/Subloom/commit/068094cde496805245b55cb3e5c60f3714931f15))
* separate currency estimates from recorded spending ([953852e](https://github.com/Baltii/Subloom/commit/953852e46e268c435fe8d217c3fdf1def903009d))
* use strict imports for deployed Bitcoin function ([f020686](https://github.com/Baltii/Subloom/commit/f020686f80e9c10a6c28a433f6342d179374fa77))
* use web-safe accessibility props on billing icons ([abcee81](https://github.com/Baltii/Subloom/commit/abcee81e979f4528e31012267679b3c60428a4c4))
* verify strict backend fixtures and document web deployment ([41971bd](https://github.com/Baltii/Subloom/commit/41971bd97011eb1d3a04fab910dc7c291f112a67))

## [1.1.0](https://github.com/Baltii/Subloom/compare/v1.0.0...v1.1.0) (2026-10-12)


### Features

* add account sync, mobile push controls and Mac test app ([fe1b260](https://github.com/Baltii/Subloom/commit/fe1b260b3c8e35202e53cb00a8374651eb0d233e))
* add account sync, mobile push controls and Mac test app ([724863f](https://github.com/Baltii/Subloom/commit/724863f7365ecbee14b71d5a7c25987b8fb8a72d))
* add animated dashboard cost insights ([95495b9](https://github.com/Baltii/Subloom/commit/95495b99977ac50e9a840777cbd3719ecfb09f8b))
* add category budgets with account-safe settings ([69e4095](https://github.com/Baltii/Subloom/commit/69e4095a89b7ddfb85cba6e54e9d700cae067ac7))
* add interactive subscription calendar and date quick add ([d17a2c8](https://github.com/Baltii/Subloom/commit/d17a2c8c0ea87956600da97cdb6c8815ca94763b))
* add Mac local reminders and durable guest storage ([78ff0c8](https://github.com/Baltii/Subloom/commit/78ff0c845339f224daeb65229f96964adfdf8703))
* add reusable subscription notification email templates ([6b24f26](https://github.com/Baltii/Subloom/commit/6b24f26bd073453229671455379288017ce92813))
* add subscription calendar with date quick add ([0eaaf5b](https://github.com/Baltii/Subloom/commit/0eaaf5b916a089da72e29e2992f03f4bc5320212))
* cancellation plans and confirmation tracking ([19132b9](https://github.com/Baltii/Subloom/commit/19132b9a8abbffc4569b9d8f0c701bfe441bca43))
* configure the feature stack and document hosted setup ([c81ebfe](https://github.com/Baltii/Subloom/commit/c81ebfe533fbdc7a2317f50798bc5d86bf40e3a6))
* durable recorded subscription price history ([9d3dde1](https://github.com/Baltii/Subloom/commit/9d3dde1546f12f9607b1f7742d78369726e0f22c))
* Enhance Subscription Form and PickerSheet with improved state m… ([9212dae](https://github.com/Baltii/Subloom/commit/9212daee45ad12f9e0d2d6d6a6ffa9f4cadfa244))
* Enhance Subscription Form and PickerSheet with improved state management and user feedback ([837e7a7](https://github.com/Baltii/Subloom/commit/837e7a7ec90794067dac408448e82e96359ac9ea))
* expand searchable service catalog with bundled logos ([c787bd1](https://github.com/Baltii/Subloom/commit/c787bd1bddc21d9746290fba3170b632b5e29ad6))
* family workspaces with invitations and exact cost splits ([0be8b75](https://github.com/Baltii/Subloom/commit/0be8b750bfb229fc6ceff49e3c319653927fe23e))
* Gmail and Outlook receipt discovery with explicit consent ([28df19d](https://github.com/Baltii/Subloom/commit/28df19d3f70e6178f3d84a0d5e725c3400805635))
* Google and Apple login with PKCE callbacks ([45a355b](https://github.com/Baltii/Subloom/commit/45a355bb3556c16d8bd8fa100f113f228962497f))
* Mac reminders, email templates and feature setup ([2960a7e](https://github.com/Baltii/Subloom/commit/2960a7ea22c26f8deb041be0f23432b7491f8907))
* private renewal calendar export ([adc09af](https://github.com/Baltii/Subloom/commit/adc09af953761db794080f1354bca2e5b9baf206))
* reviewed CSV import and subscription export ([29e89d1](https://github.com/Baltii/Subloom/commit/29e89d10c8b10b5504e8f2fedf68c1127ec15cff))
* subscription savings simulator ([b8f8d7b](https://github.com/Baltii/Subloom/commit/b8f8d7b97ff19ed25e1af25fd521d6dc42bb372d))
* team workspaces with organization SAML SSO ([5f3ba13](https://github.com/Baltii/Subloom/commit/5f3ba1394691b29923c11680b58d87b03887f1cf))


### Bug Fixes

* clarify currencies, accessible controls and receipt consent ([9cdf774](https://github.com/Baltii/Subloom/commit/9cdf77467076972f681879d2c30e3a886987496b))
* clarify currencies, accessible controls and receipt consent ([c01d0c0](https://github.com/Baltii/Subloom/commit/c01d0c03d2e857d891bb3ecd320b01a116dc008f))
* clarify currencies, accessible controls and receipt consent ([471be51](https://github.com/Baltii/Subloom/commit/471be51c07c94cd7f7fe361d309f94f2e4f40162))
* clarify currencies, accessible controls and receipt consent ([18aff2b](https://github.com/Baltii/Subloom/commit/18aff2b15c6cdf3c283df60a95e0962ba322cd9a))
* clarify currencies, accessible controls and receipt consent ([19abf2a](https://github.com/Baltii/Subloom/commit/19abf2a30282f56b394c3ca9c986fe1e28087409))
* clarify currencies, accessible controls and receipt consent ([b75c4d3](https://github.com/Baltii/Subloom/commit/b75c4d37b624374ffe7c0d76a44c154ea20e0411))
* clarify currencies, accessible controls and receipt consent ([c57e64c](https://github.com/Baltii/Subloom/commit/c57e64c2f5e7c2810a80237e46162f69eccdf089))
* clarify currencies, accessible controls and receipt consent ([f502c74](https://github.com/Baltii/Subloom/commit/f502c745acba430d3b412eef9dc895f9024c3b0a))
* expose settings reload after conflicting writes ([a3eb40c](https://github.com/Baltii/Subloom/commit/a3eb40cc9435cf43aaa4a37afd6b9f07f7bcaaa8))
* show price and status in CSV import review ([3e3b384](https://github.com/Baltii/Subloom/commit/3e3b384bc81935de341cdf4548f7d931eb2bd390))

## 1.0.0

Initial Subloom application.

# Releasing MainLine to TestFlight and Google Play

**Day to day:** bump nothing, just tag.
```sh
git tag v1.0.1 && git push origin v1.0.1
```
`.github/workflows/release.yml` then:
- builds iOS and uploads it to **TestFlight**;
- builds Android and uploads it to the **Play internal testing** track.

Version numbers:
- **Marketing version:** the tag (`1.0.1`).
- **Build number:** whatever the store has, plus 1.
- **"What's new":** the newest `PROGRESS.md` entry.

`native.yml` runs on the same tag and attaches desktop builds to a draft GitHub release.

Everything below is one-time setup, in order. Steps marked **(you)** need your accounts. Everything else is done already.

---

## What's already done (on this Mac)

- **Bundle ID:** `app.mainline.chess` is registered in your Apple Developer account (team `NNFD7CKGLG`).
- **App Store profile:** "MainLine App Store" was created with your existing App Store Connect API key `28AUQ58BDS`.
- **Android upload key:**
  - Created at `secrets/mainline-upload.jks`. Its passwords are in `secrets/android-upload.properties`. Both are git-ignored.
  - **Back both files up** somewhere safe, such as a password manager. Google can reset a lost upload key, but it takes days.
- **First builds:** signed **1.0.0 (1)** builds are ready:
  - iOS: `apps/mobile/build/ios/MainLine.ipa`
  - Android: `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`
- **Listing and screenshots:** listing text is in `store/ios`, `store/android`. Screenshots are in `store/screenshots` (regenerate with `STORE_SHOTS=1 pnpm e2e store --project=desktop`).
- **Compliance answers:** in `store/compliance.md`.

---

## 1. App Store Connect (you, ~10 min)

1. Open **appstoreconnect.apple.com → Apps → "+" → New App**, then fill in:
   - Platforms: **iOS**
   - Name: **MainLine: Chess Openings**. If it's taken, try *MainLine – Opening Trainer*. The name can change later.
   - Primary Language: **English (U.S.)**
   - Bundle ID: **MainLine – app.mainline.chess**
   - SKU: **mainline-ios**
   - User Access: **Full Access** → **Create**
2. **App Information** (left sidebar):
   - Category: **Education**; Secondary: **Games → Board**.
   - Content Rights: **Yes, it contains third-party content, and I have the necessary rights**. That content is Lichess's CC0 opening statistics.
   - Age Rating → **Edit** → answer as in `compliance.md` → **4+**.
3. **App Privacy:**
   - Privacy Policy URL: `https://<your API host>/privacy`.
   - **Get Started** → answer the data types from `compliance.md` → **Publish**.
4. **TestFlight → Internal Testing → "+"**:
   - Create a group named **Team**.
   - Turn on **Enable automatic distribution**.
   - Add yourself as a tester.
5. Tell me it's done. I'll then run `fastlane ios beta` from this Mac, which uploads the first build. You can also run it yourself:
   ```sh
   cd apps/mobile && MAINLINE_API_URL=https://<your API host> fastlane ios beta
   ```
   Apple processes the build in 5–30 minutes. It then appears in the TestFlight app on your iPhone.

## 2. Google Play Console (you, ~30 min, mostly forms)

1. Open **play.google.com/console → Create app** and fill in:
   - App name: **MainLine: Chess Openings**
   - Default language: **English (United States)**
   - App or game: **App**; Free or paid: **Free**
   - Tick the two declarations → **Create app**.
2. **Dashboard → "Set up your app"**: complete every task under *Let us know about the content of your app*, using the answers in `compliance.md`:
   - privacy policy
   - app access
   - ads
   - content rating
   - target audience
   - data safety
   - government apps
   - financial features
   - health
3. **Grow users → Store presence → Main store listing:**
   - Paste the texts from `store/android/en-US`.
   - Upload `store/android/images/icon.png`, `featureGraphic.png` and the phone screenshots from `store/screenshots/android`.
   - Later changes can go through `fastlane android metadata`.
4. **Store settings:**
   - Category: **Education**.
   - Contact details: an email address is required, and it's shown publicly.
5. **Test and release → Testing → Internal testing:**
   - **Testers** tab → **Create email list** named "Team" → add your Google account → **Save** → copy the **opt-in link**.
   - **Releases** tab → **Create new release**. At *App integrity*, keep **Use a Google-generated key** (Play App Signing; our key is only the *upload* key).
   - Upload `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`. Google requires the very first bundle to be uploaded by hand.
   - **Next → Save and publish**.
   - Open the opt-in link on your Android phone → **Accept** → install from Play.
6. **API access for CI:** reuse ClassMate's service account.
   1. Open `~/Dev/classmate/apps/classmate_mobile/fastlane/play-service-account.json` and copy its `client_email`.
   2. Play Console → **Users and permissions**. If that email is already listed with account-wide permissions, skip to step 5. Otherwise continue.
   3. Choose **Invite new users**, and paste the email.
   4. Under **App permissions → Add app → MainLine**, tick:
      - *Release apps to testing tracks*
      - *Release to production, exclude devices, and use Play App Signing*
      - *Manage testing tracks and edit tester lists*

      Then choose **Invite user**.
   5. Copy the JSON so local uploads work:
      ```sh
      cp ~/Dev/classmate/apps/classmate_mobile/fastlane/play-service-account.json ~/Dev/mainline/secrets/play-service-account.json
      ```

Later: Play needs **12 testers for 14 days on a closed track** before you can apply for production. Internal testing isn't affected.

## 3. GitHub (you, ~10 min)

1. **Create the repo** `Tony11-dot/mainline`.
   - **Public** gets free macOS minutes for iOS builds.
   - **Private** gets 2,000 free minutes a month at a 10× macOS rate, about 12 iOS builds.
   - Push `main`. I can do the push once the repo exists.
2. **Signing storage for CI** (iOS):
   1. Create an **empty private repo**, e.g. `Tony11-dot/mainline-certificates`.
   2. Create a fine-grained **personal access token** with *Contents: read/write* on that repo only.
   3. Run once on this Mac:
      ```sh
      cd apps/mobile
      export MATCH_GIT_URL=https://github.com/Tony11-dot/mainline-certificates.git
      export MATCH_PASSWORD='<choose a long passphrase>'
      fastlane ios certificates
      ```
      This creates a CI-only Apple Distribution certificate and profile, encrypts them with the passphrase and pushes them to that repo. Your account allows several distribution certificates, and your existing one isn't touched.
3. **Settings → Secrets and variables → Actions:**

   **Variables:**

   | Name | Value |
   |---|---|
   | `PUBLIC_API_URL` | `https://<your API host>` (no trailing slash) |

   **Secrets:**

   | Name | Value (command copies it to the clipboard) |
   |---|---|
   | `ASC_KEY_ID` | `28AUQ58BDS` |
   | `ASC_ISSUER_ID` | `echo -n $ASC_ISSUER_ID \| pbcopy` |
   | `ASC_KEY_P8` | `pbcopy < ~/.appstoreconnect/private_keys/AuthKey_28AUQ58BDS.p8` |
   | `MATCH_GIT_URL` | `https://github.com/Tony11-dot/mainline-certificates.git` |
   | `MATCH_PASSWORD` | the passphrase from step 2 |
   | `MATCH_GIT_BASIC_AUTHORIZATION` | `echo -n 'Tony11-dot:<token>' \| base64 \| pbcopy` |
   | `ANDROID_KEYSTORE_BASE64` | `base64 -i secrets/mainline-upload.jks \| pbcopy` |
   | `ANDROID_KEYSTORE_PASSWORD` | `storePassword` in `secrets/android-upload.properties` |
   | `ANDROID_KEY_PASSWORD` | `keyPassword` in the same file |
   | `ANDROID_KEY_ALIAS` | `upload` |
   | `PLAY_SERVICE_ACCOUNT_JSON` | `pbcopy < secrets/play-service-account.json` |
   | `TAURI_SIGNING_PRIVATE_KEY` | `pbcopy < secrets/tauri-updater.key` (desktop updater; `…_PASSWORD` stays empty) |

4. Tag a release. Both store jobs should turn green in about 20 minutes.

---

## Promoting builds
- **TestFlight → external testers:**
  1. TestFlight → **External Testing → "+"** → create a group.
  2. Add the build. The first external build gets a short Beta App Review.
- **App Store:**
  1. Open the version page → **Build → "+"** → pick the TestFlight build.
  2. Add screenshots (`fastlane ios metadata` uploads the listing and screenshots).
  3. Paste the review notes from `compliance.md` → **Submit for Review**.
- **Play:**
  1. Internal testing → the release → **Promote release → Closed testing**.
  2. Once 12 testers have been opted in for 14 days, apply for production access on the Dashboard.

## Troubleshooting
- **`Only releases with status draft may be created on draft app`:** the lane retries as a draft automatically. Roll out that one release in the Console once.
- **`No profiles for 'app.mainline.chess'` on CI:** `MATCH_*` secrets are missing, or `fastlane ios certificates` wasn't run.
- **Build number already used:** set `BUILD_NUMBER` explicitly when running the lane.
- **Local runs** need Node 22, which is what CI uses:
  - `nvm use 22` works.
  - Or prefix commands with `PATH=~/.nvm/versions/node/v22.23.3/bin:$PATH`.

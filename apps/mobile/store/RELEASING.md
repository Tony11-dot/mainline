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
   - Privacy Policy URL: `https://api-production-8afb.up.railway.app/privacy`.
   - **Get Started** → answer the data types from `compliance.md` → **Publish**.
4. **TestFlight → Internal Testing → "+"**:
   - Create a group named **Team**.
   - Turn on **Enable automatic distribution**.
   - Add yourself as a tester.
5. Tell me it's done. I'll then run `fastlane ios beta` from this Mac, which uploads the first build. You can also run it yourself:
   ```sh
   cd apps/mobile && MAINLINE_API_URL=https://api-production-8afb.up.railway.app fastlane ios beta
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
   5. On this Mac, run `bash scripts/apply-secrets.sh`. It copies the account's key into `secrets/` and into GitHub, then prints the email address to invite.

Later: Play needs **12 testers for 14 days on a closed track** before you can apply for production. Internal testing isn't affected.

## 3. GitHub (done)

- **Repos:**
  - `Tony11-dot/mainline` holds the code.
  - `Tony11-dot/mainline-certificates` is private and holds the iOS signing files, encrypted.
- **iOS signing for CI:**
  - `fastlane ios certificates` has been run. The certificate and profile are stored, encrypted with `secrets/match-password.txt`.
  - CI reaches the certificates repo through a deploy key, `secrets/match-deploy-key`, so no personal access token is needed.
- **Actions variable:** `PUBLIC_API_URL` is `https://api-production-8afb.up.railway.app`.
- **Actions secrets set:**
  - `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`
  - `MATCH_PASSWORD`, `MATCH_SSH_KEY`
  - `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, `ANDROID_KEY_ALIAS`
  - `TAURI_SIGNING_PRIVATE_KEY`
  - `PLAY_SERVICE_ACCOUNT_JSON`, set by `bash scripts/apply-secrets.sh`
- **To re-create a secret,** take it from the matching file in `secrets/`. For example:
  ```sh
  gh secret set MATCH_PASSWORD -R Tony11-dot/mainline < secrets/match-password.txt
  ```

**Server:** Railway project **mainline** (services `api` and `Postgres`), at https://api-production-8afb.up.railway.app.
- Production secrets were generated straight into Railway. They're separate from the local `.env`.
- API keys go in through `secrets/paste-here.env`, then `bash scripts/apply-secrets.sh`.
- To redeploy by hand: `railway up --service api`.

---|---|
   | `PUBLIC_API_URL` | `https://api-production-8afb.up.railway.app` (no trailing slash) |

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
- **App Store:** `fastlane ios release` (with `VERSION` and `MAINLINE_API_URL`):
  - uploads the listing, screenshots, category, age rating (`store/ios/age_rating.json`) and review notes (`store/ios/review/notes.txt`);
  - attaches the newest TestFlight build and submits it for review, releasing automatically once approved.
  - It needs `secrets/app-review-contact.json` (git-ignored; Apple shows it only to reviewers):
    ```json
    { "first_name": "…", "last_name": "…", "phone_number": "+44 …", "email_address": "…" }
    ```
  - App Privacy can't be set through the API: answer it once in App Store Connect from `compliance.md`.
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

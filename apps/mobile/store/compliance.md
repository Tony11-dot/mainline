# Store compliance answers

Drafted from what the code actually does (see `/privacy`). If a feature changes what data leaves the device, update this file, `/privacy` (apps/api/src/routes/legal.ts) and `ios/App/App/PrivacyInfo.xcprivacy` together.

**What leaves the device, for reference:**
- **Guests (no sign-in):** only chess positions and the usernames they type for game imports. Neither is tied to them or stored.
- **Lichess sign-in (optional):** username and ratings, plus an encrypted read-only token. Repertoires, notes, training cards and review history are synced.
- **Web push only:** the subscription endpoint, reminder time, time zone and due count. Native apps schedule reminders on the device.
- **AI coach:** positions and moves go to Google Gemini or Groq, with nothing that identifies the user.
- No ads, analytics, crash-reporting or tracking SDKs.

---

## Apple — App Privacy ("nutrition label")

App Store Connect → your app → **App Privacy** → Get Started.

**Do you or your third-party partners collect data from this app?** Yes.

| Data type | Collected | Linked to user | Tracking | Purpose |
|---|---|---|---|---|
| Identifiers → **User ID** (Lichess username) | Yes | Yes | No | App Functionality |
| User Content → **Other User Content** (repertoires, notes) | Yes | Yes | No | App Functionality |
| Usage Data → **Product Interaction** (training history) | Yes | Yes | No | App Functionality |

Everything else is **Not collected**, including contact info, location, health, financial info, contacts, browsing and search history, diagnostics, purchases and device ID.

- For each collected type, Apple asks whether it's used for tracking: **No**.
- These three types are collected only when the user signs in. Apple has no "optional" flag, so declare them as collected.
- **Privacy Policy URL:** `https://<your API host>/privacy`

### Other App Store Connect answers
- **Age rating:** answer **None** to every content question → **4+**. Unrestricted web access: **No**. The only web view is the Lichess sign-in page, in the system browser. Gambling or contests: **No**.
- **Export compliance:** handled by `ITSAppUsesNonExemptEncryption = false` in Info.plist. The app only uses HTTPS (exempt), so there's no question per build.
- **Sign in with Apple (4.8):** not required. Lichess sign-in is optional, links a chess account, and every feature works without it.
- **Account deletion (5.1.1(v)):** Settings → Your data → Delete my account & data.
- **Minimum functionality (4.2):**
  - What's native: local notifications, haptics, share-sheet PGN import ("Open in MainLine"), the native Liquid Glass tab bar, offline training and an on-device engine.
  - Put these in the review notes (below).
- **Content rights:** the app shows no third-party content except public game statistics from Lichess (CC0 database) and opening names (CC0).

### App Review notes (paste into "Notes")
```
MainLine is a chess opening trainer. No account is needed: every feature works as a guest.
Optional "Sign in with Lichess" (Settings) only syncs data between devices; no demo account is required.
Try it: Today → "Learn new moves" after picking a starter repertoire on first launch,
or Repertoire → New → Import PGN. Reminders use local notifications (Settings → Reminders).
Native features: local notifications, haptics, share-sheet PGN import ("Open in MainLine"), offline training with an on-device Stockfish engine.
```

---

## Google Play — App content (Policy → App content)

| Declaration | Answer |
|---|---|
| **Privacy policy** | `https://<your API host>/privacy` |
| **App access** | *All functionality is available without special access.* (Sign-in is optional; no credentials needed for review.) |
| **Ads** | No, my app does not contain ads. |
| **Content rating** (IARC questionnaire) | Category: **Reference, News, or Educational**. Answer **No** to violence, sexuality, language, controlled substances, gambling, user interaction/chat, sharing location, and digital purchases. Expected result: **Everyone / PEGI 3**. |
| **Target audience and content** | Age groups: **13–15, 16–17, 18+**. Leaving out under-13 avoids the Families policy; the app isn't designed for children. *Appeals to children?* **No**. |
| **News app** | No. |
| **COVID-19 contact tracing** | No. |
| **Data safety** | See below. |
| **Government app** | No. |
| **Financial features** | None. |
| **Health** | None. |
| **Advertising ID** | No, the app doesn't use the advertising ID. |

### Data safety form

**Overview**
- Does your app collect or share any of the required user data types? **Yes**
- Is all user data collected by your app encrypted in transit? **Yes**
- Which account creation methods does your app support? **OAuth** ("Sign in with Lichess")
- **Delete account URL:** `https://<your API host>/privacy#delete`
- Do you provide a way for users to request that some or all of their data is deleted? **Yes**

**Data types**

| Category → type | Collected | Shared | Ephemeral | Required or optional | Purposes |
|---|---|---|---|---|---|
| Personal info → **User IDs** (Lichess username) | Yes | No | No | **Optional** | App functionality, Account management |
| App activity → **Other user-generated content** (repertoires, notes) | Yes | No | No | **Optional** | App functionality |
| App activity → **App interactions** (training history) | Yes | No | No | **Optional** | App functionality |

Everything else: **not collected**.

**Why these answers:**
- **Shared = No.** Positions sent to the AI provider and usernames typed for game imports aren't personal data about the user. They're sent to a service provider, or at the user's request, which Google's definitions don't count as "sharing".
- **Crash logs and diagnostics = not collected.** No crash reporting SDK is included.

---

## Both stores
- **Category:**
  - App Store: primary **Education**, secondary **Games → Board**.
  - Play: **Education**.
  - Chess trainers like Chessable list under Education, which fits a study tool better than Games.
- **Support URL:** `https://github.com/Tony11-dot/mainline/issues`, or set `LEGAL_CONTACT` on the server to an email and use a mailto page.
- **Copyright:** `2026 MainLine`

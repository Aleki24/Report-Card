# Shipping app changes

Most changes (screens, text, logic, styles, images) reach phones as an
**over-the-air update**, with no new APK, and this now happens by itself:

- **On merge to `main`**, `.github/workflows/mobile-update.yml` type-checks
  the app and publishes an update to both the `preview` and `production`
  channels. It runs when anything under `mobile/` changes, or the web's
  `src/lib/` or `src/types/` (the app imports them as `@shared/*`). It can
  also be run by hand from the Actions tab (*Mobile update → Run workflow*).
  It needs an `EXPO_TOKEN` repository secret (expo.dev → Account settings →
  Access tokens).
- **On the phone** (`lib/useLiveUpdates.ts`), the app checks at launch and
  each time it comes back to the foreground (at most every 15 minutes), and
  downloads quietly. An update found while the app is in use is offered with
  a *Restart now* toast; otherwise it opens at the next start, or as soon as
  someone returns after 5 minutes or more away. Profile → *Check for
  updates* still fetches one on demand.

Pull requests type-check the app in CI (`ci.yml`, job `mobile`), so a change
that would break phones fails before it can merge.

To publish by hand (e.g. from a branch for testing):

```sh
cd mobile
npx eas-cli update --channel preview --environment preview --message "What changed"
```

A **new build** is needed only when native code changes: adding or upgrading
a package with native parts (camera, maps, notifications…), or changing
app.json fields such as the icon, permissions or app ID. The runtime version
uses the `fingerprint` policy, so an update is only ever offered to builds
whose native code matches it; an update can't crash an older build, but
phones on an older build won't get it until they install the new one.

Builds: `npx eas-cli build -p android --profile preview` on EAS, or add
`--local` to build on this machine (see the build notes in the session log).

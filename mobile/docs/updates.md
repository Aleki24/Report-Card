# Shipping app changes

Most changes (screens, text, logic, styles, images) reach phones as an
**over-the-air update**, with no new APK.

**Publishing** is done by hand for now. From your computer:

```sh
cd mobile
npx eas-cli update --channel preview --environment preview --message "What changed"
npx eas-cli update --channel production --environment production --message "What changed"
```

The first goes to the preview (internal APK) app, the second to the Play
Store app. Or, once an `EXPO_TOKEN` repository secret is set (expo.dev →
Account settings → Access tokens), run *Actions → Mobile update → Run
workflow* on GitHub, which type-checks the app and publishes to both. To
publish on every merge instead, add a `push` trigger to
`.github/workflows/mobile-update.yml` (its header says which paths).

**On the phone**, people update themselves; the app never restarts on its
own (`lib/useLiveUpdates.ts`):

- It checks at launch and each time it comes back to the foreground (at most
  every 15 minutes), and downloads a new update quietly.
- It then offers it with a *Restart now* toast. Without that, the update
  opens the next time the app is started.
- Profile → *Check for updates* fetches and opens the latest at any time.

Pull requests type-check the app in CI (`ci.yml`, job `mobile`), so a change
that would break phones fails before it can merge.

A **new build** is needed only when native code changes: adding or upgrading
a package with native parts (camera, maps, notifications…), or changing
app.json fields such as the icon, permissions or app ID. The runtime version
uses the `fingerprint` policy, so an update is only ever offered to builds
whose native code matches it; an update can't crash an older build, but
phones on an older build won't get it until they install the new one.

Builds: `npx eas-cli build -p android --profile preview` on EAS, or add
`--local` to build on this machine (see the build notes in the session log).

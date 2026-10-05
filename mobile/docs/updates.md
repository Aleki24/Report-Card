# Shipping app changes

Most changes (screens, text, logic, styles, images) reach phones as an
**over-the-air update**, with no new APK:

```sh
cd mobile
npx eas-cli update --channel preview --environment preview --message "What changed"
```

Phones download it in the background the next time the app opens and switch
to it on the following launch (close and reopen the app twice to see it at
once). Use `--channel production --environment production` for the Play Store
build.

A **new build** is needed only when native code changes: adding or upgrading
a package with native parts (camera, maps, notifications…), or changing
app.json fields such as the icon, permissions or app ID. The runtime version
uses the `fingerprint` policy, so an update is only ever offered to builds
whose native code matches it; an update can't crash an older build.

Builds: `npx eas-cli build -p android --profile preview` on EAS, or add
`--local` to build on this machine (see the build notes in the session log).

# Release signing key

`sc-release.p12` — RSA 3072, self-signed, valid until 2055.

- Alias: `sc-release`
- Store/key password: `sc-step-reminder-2026` (also in `../keystore.properties`)
- SHA-256 fingerprint: `17:12:B8:6B:8C:1E:3F:47:DE:60:CC:CE:65:F6:00:D3:B4:0F:1D:46:34:41:60:CB:01:34:EA:22:6F:6B:77:13`

It is committed deliberately: GitHub Actions has no access to repository secrets
in this project, and a stable key means each release upgrades over the last one
instead of demanding an uninstall.

**This key is public.** Anyone can sign an APK that Android will treat as the same
app. That is acceptable for sideloaded builds shared straight from Releases, and
unacceptable for the Play Store — for a store release, generate a private key
(`keytool -genkeypair -keystore my-release.jks -alias upload …`), keep it secret,
and point `../keystore.properties` at it.

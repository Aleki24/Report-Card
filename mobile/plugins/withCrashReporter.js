// @ts-check
// Adds a native crash reporter to the Android app: it saves a crash and shows it
// on the next launch in its own screen, since a release build that crashes on
// launch otherwise closes with nothing to read. See plugins/crash-reporter/.
const fs = require('fs');
const path = require('path');
const {
    AndroidConfig,
    withAndroidManifest,
    withDangerousMod,
    withMainActivity,
    withMainApplication,
} = require('expo/config-plugins');

const SOURCE_DIR = path.join(__dirname, 'crash-reporter');
const SOURCE_FILES = ['CrashReporter.kt', 'CrashReportActivity.kt'];
const ACTIVITY_NAME = '.CrashReportActivity';

/** @param {import('expo/config').ExpoConfig} config */
function androidPackage(config) {
    const pkg = config.android?.package;
    if (!pkg) throw new Error('withCrashReporter: expo.android.package is required');
    return pkg;
}

/**
 * Inserts `insertion` next to `anchor` once; fails the build if the anchor is
 * missing so a template change cannot silently drop the reporter.
 * @param {string} contents
 * @param {string} anchor
 * @param {string} insertion
 * @param {'before' | 'after'} position
 * @param {string} fileName
 */
function insertOnce(contents, anchor, insertion, position, fileName) {
    if (contents.includes(insertion.trim())) return contents;
    if (!contents.includes(anchor)) {
        throw new Error(`withCrashReporter: could not find "${anchor.trim()}" in ${fileName}`);
    }
    return contents.replace(anchor, position === 'before' ? insertion + anchor : anchor + insertion);
}

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withCrashReporter = (config) => {
    config = withDangerousMod(config, [
        'android',
        (cfg) => {
            const pkg = androidPackage(cfg);
            const targetDir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/java', ...pkg.split('.'));
            fs.mkdirSync(targetDir, { recursive: true });
            for (const file of SOURCE_FILES) {
                const source = fs.readFileSync(path.join(SOURCE_DIR, file), 'utf8');
                fs.writeFileSync(path.join(targetDir, file), source.replace('package __PACKAGE__', `package ${pkg}`));
            }
            return cfg;
        },
    ]);

    config = withMainApplication(config, (cfg) => {
        const file = 'MainApplication.kt';
        let src = cfg.modResults.contents;
        src = insertOnce(src, 'import android.app.Application\n', 'import android.content.Context\n', 'after', file);
        src = insertOnce(
            src,
            '  override fun onCreate() {\n',
            '  override fun attachBaseContext(base: Context) {\n    super.attachBaseContext(base)\n    CrashReporter.install(this)\n  }\n\n',
            'before',
            file,
        );
        src = insertOnce(
            src,
            '  override fun onCreate() {\n    super.onCreate()\n',
            '    if (CrashReporter.isCrashProcess()) return\n',
            'after',
            file,
        );
        cfg.modResults.contents = src;
        return cfg;
    });

    config = withMainActivity(config, (cfg) => {
        cfg.modResults.contents = insertOnce(
            cfg.modResults.contents,
            '    super.onCreate(null)\n',
            '    CrashReporter.launchPending(this)\n',
            'after',
            'MainActivity.kt',
        );
        return cfg;
    });

    config = withAndroidManifest(config, (cfg) => {
        const application = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
        const activities = (application.activity ??= []);
        if (!activities.some((activity) => activity.$['android:name'] === ACTIVITY_NAME)) {
            activities.push({
                $: {
                    'android:name': ACTIVITY_NAME,
                    'android:process': ':crash',
                    'android:taskAffinity': `${androidPackage(cfg)}.crash`,
                    'android:launchMode': 'singleTask',
                    'android:exported': 'false',
                    'android:theme': '@android:style/Theme.Material.Light.NoActionBar',
                },
            });
        }
        return cfg;
    });

    return config;
};

module.exports = withCrashReporter;

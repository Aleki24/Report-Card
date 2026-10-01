// Metro setup for sharing the web app's platform-neutral definitions
// (modules, permissions, record schemas, form helpers) from `../src/lib`,
// imported here as `@shared/*` (see tsconfig.json). Mirrors Expo's monorepo
// guide: watch the shared folder and resolve its packages (zod) from this
// app's node_modules when the web app's are not installed (the mobile
// Vercel build installs only mobile/).
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '../src/lib');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [...(config.watchFolders ?? []), sharedRoot];
config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(projectRoot, '../node_modules'),
];

// The tsconfig.json aliases, resolved here: Expo's own tsconfig-paths
// support resolves an alias that leaves the project root relative to the
// importing file, so it is switched off in app.json.
const ALIASES = [
    ['@shared/', sharedRoot],
    ['@/', projectRoot],
];
config.resolver.resolveRequest = (context, moduleName, platform) => {
    const alias = ALIASES.find(([prefix]) => moduleName.startsWith(prefix));
    const target = alias ? path.join(alias[1], moduleName.slice(alias[0].length)) : moduleName;
    return context.resolveRequest(context, target, platform);
};

module.exports = config;

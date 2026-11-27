// Metro for the phone app (TOKI-146). Expo's default configuration finds the
// pnpm workspace by itself; this file adds one thing (R9): the workspace
// packages import their `.ts` files with `.js` specifiers ("./email.js"),
// which TypeScript and Vite accept and Metro does not. When the default
// resolver fails on a relative `.js` import from a file under packages/, the
// same path is tried with `.ts`, then `.tsx`. Imports that resolve today are
// not touched, and no file of packages/ is changed for it.
// The project is an ES module ("type": "module"), so this file is one too
// (TOKI-146, R24): Expo loads it with import, and it needs no lint exception.
import path from "node:path";
import expoMetroConfig from "expo/metro-config";

const { getDefaultConfig } = expoMetroConfig;
const here = import.meta.dirname;
const config = getDefaultConfig(here);
const packagesDir = path.resolve(here, "../../packages") + path.sep;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    return context.resolveRequest(context, moduleName, platform);
  } catch (error) {
    const fromPackage = context.originModulePath.startsWith(packagesDir);
    if (
      !fromPackage ||
      !moduleName.startsWith(".") ||
      !moduleName.endsWith(".js")
    ) {
      throw error;
    }
    const stem = moduleName.slice(0, -".js".length);
    for (const extension of [".ts", ".tsx"]) {
      try {
        return context.resolveRequest(context, stem + extension, platform);
      } catch {
        // Try the next extension.
      }
    }
    throw error;
  }
};

export default config;

import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/"))
      return nextResolve(
        pathToFileURL(resolve("src", specifier.slice(2) + ".ts")).href,
        context,
      );
    if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier))
      return nextResolve(specifier + ".ts", context);
    return nextResolve(specifier, context);
  },
});

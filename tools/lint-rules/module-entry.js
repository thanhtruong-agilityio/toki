// Local ESLint rule: a server module is imported only through its entry file.
//
// Option `modulesDirs`: the folders whose sub-folders are modules, relative to
// the repository root. An import that resolves into <modulesDir>/<name>/ from
// a file that is not inside that same module must resolve to the module's
// entry: <name>, <name>/index, <name>/index.ts or <name>/index.js.
//
// The rule decides on the resolved path, not on the import text, and reads no
// file, so the target need not exist. Paths are compared without case, because
// the file system of macOS and Windows ignores case. Only relative specifiers
// are resolved; apps/server has no path alias.
import path from "node:path";

const ENTRY = new Set(["", "index", "index.ts", "index.js"]);

function moduleOf(file, modulesDirs) {
  for (const dir of modulesDirs) {
    const rest = path.relative(dir, file.toLowerCase());
    if (rest === "" || rest.startsWith("..") || path.isAbsolute(rest)) continue;
    const [name, ...inside] = rest.split(path.sep);
    return { id: path.join(dir, name), name, inside: inside.join("/") };
  }
  return null;
}

export default {
  meta: {
    type: "problem",
    schema: [
      {
        type: "object",
        properties: {
          modulesDirs: { type: "array", items: { type: "string" } },
        },
        required: ["modulesDirs"],
        additionalProperties: false,
      },
    ],
    messages: {
      internal:
        "server module boundary: '{{source}}' reaches inside the module '{{name}}'. " +
        "Import a module only through its entry file ({{name}}/index.ts).",
    },
  },
  create(context) {
    const modulesDirs = context.options[0].modulesDirs.map((dir) =>
      path.resolve(context.cwd, dir).toLowerCase(),
    );
    const from = moduleOf(context.filename, modulesDirs);

    function check(node, source) {
      if (typeof source !== "string" || !source.startsWith(".")) return;
      const target = path.resolve(path.dirname(context.filename), source);
      const to = moduleOf(target, modulesDirs);
      if (!to || to.id === from?.id || ENTRY.has(to.inside)) return;
      context.report({
        node,
        messageId: "internal",
        data: { source, name: to.name },
      });
    }

    return {
      ImportDeclaration: (node) => check(node, node.source.value),
      ExportNamedDeclaration: (node) => check(node, node.source?.value),
      ExportAllDeclaration: (node) => check(node, node.source.value),
      ImportExpression: (node) => check(node, node.source.value),
      TSImportType: (node) => check(node, node.source.value),
      TSExternalModuleReference: (node) => check(node, node.expression.value),
      'CallExpression[callee.name="require"]': (node) =>
        check(node, node.arguments[0]?.value),
    };
  },
};

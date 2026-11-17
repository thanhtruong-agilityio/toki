// Local ESLint rule: ui-web does not use a platform API directly.
//
// Options: `globals`, the banned names, as a bare global or as a property of
// window, globalThis or self; `properties`, the banned [object, property]
// pairs, where the object is a global or a property of window, globalThis or
// self (["navigator", "serviceWorker"]).
//
// The rule reports a bare name, member access (window.localStorage,
// window["localStorage"]) and destructuring, nested or not. It follows a chain
// from the global through .window, .self and .globalThis, and looks through
// the wrappers of TypeScript (`as`, `!`, `satisfies`, <T>x) and an optional
// chain. It respects shadowing: a parameter or variable named `window` or
// `localStorage` is not the global, and a property of another object
// (props.document.cookie) is not reported.
//
// Not caught: a copy under another name (const w = window; w.localStorage), a
// name built at run time (window["local" + "Storage"]), and a use in a type
// only (let n: Notification).
const WINDOW = new Set(["window", "globalThis", "self"]);
const WRAPPERS = new Set([
  "TSAsExpression",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
  "TSTypeAssertion",
  "ChainExpression",
]);

function unwrap(node) {
  while (node && WRAPPERS.has(node.type)) node = node.expression;
  return node;
}

// The fixed name of a member property or of a pattern key, or undefined.
function keyName(node, computed) {
  if (node.type === "Identifier" && !computed) return node.name;
  if (node.type === "Literal") return String(node.value);
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis[0].value.cooked;
  }
  return undefined;
}

export default {
  meta: {
    type: "problem",
    schema: [
      {
        type: "object",
        properties: {
          globals: { type: "array", items: { type: "string" } },
          properties: {
            type: "array",
            items: {
              type: "array",
              items: { type: "string" },
              minItems: 2,
              maxItems: 2,
            },
          },
        },
        required: ["globals", "properties"],
        additionalProperties: false,
      },
    ],
    messages: {
      direct:
        "ui-web boundary: '{{name}}' is a platform API. " +
        "ui-web reaches notifications, storage, the service worker and audio only through the platform package.",
    },
  },
  create(context) {
    const { sourceCode } = context;
    const globals = new Set(context.options[0].globals);
    const pairs = new Set(
      context.options[0].properties.map((pair) => pair.join(".")),
    );

    function report(node, name) {
      context.report({ node, messageId: "direct", data: { name } });
    }

    // False when a declaration in the file gives the name another meaning.
    function isGlobal(identifier) {
      let scope = sourceCode.getScope(identifier);
      for (; scope; scope = scope.upper) {
        const variable = scope.set.get(identifier.name);
        if (variable?.defs.length > 0 && variable.isValueVariable !== false) {
          return false;
        }
      }
      return true;
    }

    // The name of the global an expression stands for: `navigator` for
    // navigator, window.navigator and self.window.navigator. Undefined for
    // anything else.
    function globalName(expression) {
      const node = unwrap(expression);
      if (node?.type === "Identifier") {
        return isGlobal(node) ? node.name : undefined;
      }
      if (node?.type === "MemberExpression") {
        return WINDOW.has(globalName(node.object))
          ? keyName(node.property, node.computed)
          : undefined;
      }
      return undefined;
    }

    // The same for the value an object pattern takes apart.
    function patternSource(pattern) {
      const parent = pattern.parent;
      if (parent.type === "VariableDeclarator") return globalName(parent.init);
      // A nested pattern, with or without a default value:
      // { navigator: { serviceWorker } = other } = window.
      const holder = parent.type === "AssignmentPattern" ? parent : pattern;
      const property = holder.parent;
      if (property.type === "Property" && property.value === holder) {
        const outer = patternSource(property.parent);
        if (WINDOW.has(outer)) return keyName(property.key, property.computed);
      }
      // An assignment, or a default value: ({ a } = window) => a.
      if (parent.left === pattern) return globalName(parent.right);
      return undefined;
    }

    function check(node, object, property) {
      if (object === undefined || property === undefined) return;
      if (WINDOW.has(object) && globals.has(property)) report(node, property);
      if (pairs.has(`${object}.${property}`)) {
        report(node, `${object}.${property}`);
      }
    }

    return {
      MemberExpression(node) {
        check(
          node,
          globalName(node.object),
          keyName(node.property, node.computed),
        );
      },
      ObjectPattern(node) {
        const object = patternSource(node);
        for (const property of node.properties) {
          if (property.type !== "Property") continue;
          check(property, object, keyName(property.key, property.computed));
        }
      },
      // A bare name: every value reference to a banned global that no
      // declaration in the file resolves.
      "Program:exit"(node) {
        const scope = sourceCode.getScope(node);
        const references = [
          ...scope.through,
          ...scope.variables
            .filter((variable) => variable.defs.length === 0)
            .flatMap((variable) => variable.references),
        ];
        for (const { identifier, isValueReference } of references) {
          if (globals.has(identifier.name) && isValueReference !== false) {
            report(identifier, identifier.name);
          }
        }
      },
    };
  },
};

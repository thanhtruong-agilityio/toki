// Local ESLint rule: reports every global that the configuration does not
// declare (languageOptions.globals). It is the core no-undef rule with these
// differences: the message names the boundary; `typeof window` is reported
// too, also in a type (`type T = typeof window` reads the value); and a name
// used as a type only is reported only when it is a DOM type name.
//
// Options: `domTypes`, the banned type names, and `domTypePrefixes`, the
// prefixes of banned type names. Any other type that the file does not declare
// (RequestInit, MessageEvent, Storage) passes: a type alone loads nothing at
// run time, and telling such types apart relies on review.
const message =
  "client-core boundary: '{{name}}' is not in the allow list of globals. " +
  "client-core, shared, i18n and tokens use no DOM or browser API, so React Native can reuse them. " +
  "The allow list is in eslint.config.js.";
const typeMessage =
  "client-core boundary: '{{name}}' is a DOM type. " +
  "client-core, shared, i18n and tokens use no DOM or browser API, so React Native can reuse them.";

const names = { type: "array", items: { type: "string" } };

export default {
  meta: {
    type: "problem",
    schema: [
      {
        type: "object",
        properties: { domTypes: names, domTypePrefixes: names },
        required: ["domTypes", "domTypePrefixes"],
        additionalProperties: false,
      },
    ],
    messages: { notAllowed: message, domType: typeMessage },
  },
  create(context) {
    const { domTypes, domTypePrefixes } = context.options[0];
    const isDomType = (name) =>
      domTypes.includes(name) ||
      domTypePrefixes.some((prefix) => name.startsWith(prefix));

    return {
      "Program:exit"(node) {
        // The references that no declaration in the file, and no declared
        // global, resolves.
        const globalScope = context.sourceCode.getScope(node);
        for (const reference of globalScope.through) {
          const { name } = reference.identifier;
          // The parser marks a reference as a value, as a type, or as both
          // (`export { name }`). Only "not a value" is a type alone.
          const typeOnly = reference.isValueReference === false;
          if (typeOnly && !isDomType(name)) continue;
          context.report({
            node: reference.identifier,
            messageId: typeOnly ? "domType" : "notAllowed",
            data: { name },
          });
        }
      },
    };
  },
};

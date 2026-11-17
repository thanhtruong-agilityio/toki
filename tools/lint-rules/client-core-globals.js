// Local ESLint rule: reports every global that the configuration does not
// declare (languageOptions.globals), as a value or as a type. It is the core
// no-undef rule with two differences: the message names the boundary, and
// `typeof window` is reported too.
const message =
  "client-core boundary: '{{name}}' is not in the allow list of globals. " +
  "client-core, shared, i18n and tokens use no DOM or browser API, so React Native can reuse them. " +
  "The allow list is in eslint.config.js.";

export default {
  meta: {
    type: "problem",
    schema: [],
    messages: { notAllowed: message },
  },
  create(context) {
    return {
      "Program:exit"(node) {
        const globalScope = context.sourceCode.getScope(node);
        for (const reference of globalScope.through) {
          context.report({
            node: reference.identifier,
            messageId: "notAllowed",
            data: { name: reference.identifier.name },
          });
        }
      },
    };
  },
};

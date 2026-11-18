// Local ESLint rule: a button that holds only icons has a name (D-075).
//
// Options: `uiWebSrc`, the absolute folder packages/ui-web/src. A relative
// import that resolves into it counts as an import from @toki/ui-web.
//
// It reports (R22, R23):
//  - a button (the host element <button>, or `Button` imported from
//    @toki/ui-web or from a path inside ui-web, under any local name) whose
//    children are only icons, when it has no name;
//  - an `IconButton` from the same sources that has no `label`, or a label that
//    is an empty or white-space string.
// An icon is an element whose local name is bound by an import of `Icon`, or of
// a name ending in `Icon`, from the same sources (also under another local
// name, and as a member of a namespace import). A name is an `aria-label` or
// `aria-labelledby` whose value is not an empty or white-space string.
// `title` is not a name: it shows on hover only (D-067).
//
// Limits, accepted (spec concern 10): when the rule cannot tell, it does not
// report. A button whose child may be text (a string, a call, a component that
// is not an icon, `a || <Icon />`) or whose attributes are spread passes; an
// expression `aria-label` counts as a name without being evaluated; icons are
// recognised only from @toki/ui-web; `Switch` and a button with no children
// are not covered (the types cover Switch).
import path from "node:path";

const MESSAGE =
  "icon-only-button-name: a button that holds only an icon needs a name. Add aria-label, aria-labelledby or label (title is not a name).";
const SOURCE = "@toki/ui-web";

const isBlank = (value) => typeof value !== "string" || value.trim() === "";

// The value of a JSX attribute when it is a plain string, `undefined` when it is
// an expression we cannot read, `null` when the attribute has no value.
function literalValue(attr) {
  if (attr.value === null) return null;
  if (attr.value.type === "Literal") return attr.value.value;
  if (
    attr.value.type === "JSXExpressionContainer" &&
    attr.value.expression.type === "Literal" &&
    typeof attr.value.expression.value === "string"
  ) {
    return attr.value.expression.value;
  }
  if (
    attr.value.type === "JSXExpressionContainer" &&
    attr.value.expression.type === "TemplateLiteral" &&
    attr.value.expression.expressions.length === 0
  ) {
    return attr.value.expression.quasis[0].value.cooked;
  }
  return undefined;
}

// true: the attribute gives a name; false: it is empty or missing a value.
function attributeGivesName(attr) {
  const value = literalValue(attr);
  if (value === undefined) return true; // an expression: counts as a name
  return !isBlank(value);
}

const isWhitespaceText = (node) =>
  node.type === "JSXText" && node.value.trim() === "";

export default {
  meta: {
    type: "problem",
    schema: [
      {
        type: "object",
        properties: { uiWebSrc: { type: "string" } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = context.options[0] ?? {};
    const uiWebSrc =
      options.uiWebSrc ?? path.join(context.cwd, "packages/ui-web/src");
    const fromUiWeb = (source) => {
      if (source === SOURCE || source.startsWith(`${SOURCE}/`)) return true;
      if (!source.startsWith(".")) return false;
      const resolved = path.resolve(path.dirname(context.filename), source);
      const relative = path.relative(uiWebSrc, resolved);
      return !relative.startsWith("..") && !path.isAbsolute(relative);
    };

    // local name -> "button" | "iconbutton" | "icon"
    const bindings = new Map();
    const namespaces = new Set();
    const kindOf = (imported) => {
      if (imported === "Button") return "button";
      if (imported === "IconButton") return "iconbutton";
      if (imported === "Icon" || imported.endsWith("Icon")) return "icon";
      return undefined;
    };

    const isIconElement = (node) => {
      if (!node || node.type !== "JSXElement") return false;
      const name = node.openingElement.name;
      if (name.type === "JSXIdentifier")
        return bindings.get(name.name) === "icon";
      if (name.type === "JSXMemberExpression") {
        return (
          name.object.type === "JSXIdentifier" &&
          namespaces.has(name.object.name) &&
          kindOf(name.property.name) === "icon"
        );
      }
      return false;
    };

    // `a ? <Icon /> : null` and `cond && <Icon />` count as icon children.
    const isIconChild = (child) => {
      if (isIconElement(child)) return true;
      if (child.type !== "JSXExpressionContainer") return false;
      const expression = child.expression;
      if (
        expression.type === "LogicalExpression" &&
        expression.operator === "&&"
      ) {
        return isIconElement(expression.right);
      }
      if (expression.type === "ConditionalExpression") {
        const branches = [expression.consequent, expression.alternate];
        const empty = (b) =>
          (b.type === "Literal" && (b.value === null || b.value === false)) ||
          (b.type === "Identifier" && b.name === "undefined");
        return (
          branches.every((b) => isIconElement(b) || empty(b)) &&
          branches.some(isIconElement)
        );
      }
      return false;
    };

    const holdsOnlyIcons = (children) => {
      const meaningful = children.filter((c) => !isWhitespaceText(c));
      if (
        !meaningful.some(isIconChild) &&
        !meaningful.some(isWrapperWithIcons)
      ) {
        return false;
      }
      return meaningful.every(
        (c) => isIconChild(c) || isWrapperWithIcons(c) || isEmptyExpression(c),
      );
    };
    const isEmptyExpression = (c) =>
      c.type === "JSXExpressionContainer" &&
      c.expression.type === "JSXEmptyExpression";
    // A lower-case element or a fragment whose own children are only icons.
    function isWrapperWithIcons(c) {
      if (c.type === "JSXFragment") return holdsOnlyIcons(c.children);
      if (c.type === "JSXElement") {
        const name = c.openingElement.name;
        return (
          name.type === "JSXIdentifier" &&
          /^[a-z]/.test(name.name) &&
          holdsOnlyIcons(c.children)
        );
      }
      return false;
    }

    return {
      ImportDeclaration(node) {
        if (!fromUiWeb(node.source.value)) return;
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportNamespaceSpecifier") {
            namespaces.add(specifier.local.name);
          } else if (specifier.type === "ImportSpecifier") {
            const imported =
              specifier.imported.type === "Identifier"
                ? specifier.imported.name
                : String(specifier.imported.value);
            const kind = kindOf(imported);
            if (kind) bindings.set(specifier.local.name, kind);
          }
        }
      },
      JSXElement(node) {
        const opening = node.openingElement;
        const name = opening.name;
        if (name.type !== "JSXIdentifier") return;
        const kind =
          name.name === "button" ? "button" : bindings.get(name.name);
        if (kind !== "button" && kind !== "iconbutton") return;
        const attributes = opening.attributes;
        if (attributes.some((a) => a.type === "JSXSpreadAttribute")) return;
        const named = (attrName) =>
          attributes.find(
            (a) => a.type === "JSXAttribute" && a.name.name === attrName,
          );

        if (kind === "iconbutton") {
          const label = named("label");
          if (!label || !attributeGivesName(label)) {
            context.report({ node: opening, message: MESSAGE });
          }
          return;
        }
        if (!holdsOnlyIcons(node.children)) return;
        const hasName = ["aria-label", "aria-labelledby"].some((n) => {
          const attr = named(n);
          return attr !== undefined && attributeGivesName(attr);
        });
        if (!hasName) context.report({ node: opening, message: MESSAGE });
      },
    };
  },
};

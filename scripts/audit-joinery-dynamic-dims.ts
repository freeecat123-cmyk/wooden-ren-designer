/**
 * audit-joinery-dynamic-dims.ts
 *
 * Detect hardcoded mm dimension labels in lib/joinery/details.tsx.
 * All <text> children, DimLine `label`, and DimChain `label` (incl. segments[].label)
 * must derive from props/variables — never from a string/number literal containing digits.
 *
 * Allowlist: ALLOWED_LITERALS (section letters, ratios, angles, symbols)
 * Per-line escape: add `// @joinery-dim-allow` on the same or previous line.
 */
import { Project, SyntaxKind, type SourceFile, type Node } from "ts-morph";
import path from "path";

const TARGET = path.resolve(__dirname, "../lib/joinery/details.tsx");

// Hardcoded text literals allowed to appear (no mm dims): section labels, ratios, angles, symbols
const ALLOWED_LITERALS = new Set<string>([
  "A-A", "B-B", "C-C", "A", "B", "C",
  "1:1", "1:2", "1:6", "1:8",
  "45°", "15°", "30°", "60°", "90°",
  "0", "—", "·", "↕", "⇕",
]);

const ALLOWED_LINE_REGEX = /\/\/\s*@joinery-dim-allow/;

interface Violation {
  file: string;
  line: number;
  col: number;
  text: string;
  context: string;
}

function isHardcodedDimLabel(value: string): boolean {
  // No digits at all → harmless decoration text
  if (!/[0-9]/.test(value)) return false;
  // Explicit allowlist (e.g. "1:2", "45°")
  if (ALLOWED_LITERALS.has(value.trim())) return false;
  // Otherwise: contains digits and not whitelisted → treat as hardcoded mm
  return true;
}

function isLineAllowedByMagicComment(sourceFile: SourceFile, lineNumber: number): boolean {
  const lines = sourceFile.getFullText().split("\n");
  // Same line uses index lineNumber-1; previous line uses lineNumber-2
  for (const i of [lineNumber - 1, lineNumber - 2]) {
    if (i >= 0 && i < lines.length && ALLOWED_LINE_REGEX.test(lines[i])) {
      return true;
    }
  }
  return false;
}

function getLineCol(sourceFile: SourceFile, pos: number): { line: number; column: number } {
  // ts-morph exposes getLineAndColumnAtPos via SourceFile
  const lc = (sourceFile as any).getLineAndColumnAtPos(pos);
  return { line: lc.line, column: lc.column };
}

const project = new Project({
  tsConfigFilePath: path.resolve(__dirname, "../tsconfig.json"),
  skipAddingFilesFromTsConfig: true,
});
const sourceFile = project.addSourceFileAtPath(TARGET);

const violations: Violation[] = [];

// Scan 1: <text>...</text> JSX text children
sourceFile.getDescendantsOfKind(SyntaxKind.JsxElement).forEach((el) => {
  const tagName = el.getOpeningElement().getTagNameNode().getText();
  if (tagName !== "text") return;
  el.getJsxChildren().forEach((child) => {
    if (child.getKind() === SyntaxKind.JsxText) {
      const text = child.getText().trim();
      if (text && isHardcodedDimLabel(text)) {
        const { line, column } = getLineCol(sourceFile, child.getStart());
        if (!isLineAllowedByMagicComment(sourceFile, line)) {
          violations.push({ file: TARGET, line, col: column, text, context: "<text> child" });
        }
      }
    } else if (child.getKind() === SyntaxKind.JsxExpression) {
      // <text>{"30"}</text> or <text>{30}</text> — also hardcoded if literal
      const expr = (child as any).getExpression?.();
      if (!expr) return;
      if (expr.getKind() === SyntaxKind.StringLiteral) {
        const value = expr.getLiteralValue() as string;
        if (isHardcodedDimLabel(value)) {
          const { line, column } = getLineCol(sourceFile, child.getStart());
          if (!isLineAllowedByMagicComment(sourceFile, line)) {
            violations.push({ file: TARGET, line, col: column, text: `{"${value}"}`, context: "<text> expr" });
          }
        }
      } else if (expr.getKind() === SyntaxKind.NumericLiteral) {
        const value = expr.getLiteralValue();
        const { line, column } = getLineCol(sourceFile, child.getStart());
        if (!isLineAllowedByMagicComment(sourceFile, line)) {
          violations.push({ file: TARGET, line, col: column, text: `{${value}}`, context: "<text> expr" });
        }
      }
    }
  });
});

// Scan 2: DimLine / DimChain `label` JSX attribute (covers segments[].label via object literals below)
sourceFile.getDescendantsOfKind(SyntaxKind.JsxAttribute).forEach((attr) => {
  const name = attr.getNameNode().getText();
  if (name !== "label") return;

  const parent = attr.getParent();
  if (!parent) return;
  let tagName = "";
  const pk = parent.getKind();
  if (pk === SyntaxKind.JsxOpeningElement || pk === SyntaxKind.JsxSelfClosingElement) {
    tagName = (parent as any).getTagNameNode().getText();
  }
  if (!["DimLine", "DimChain"].includes(tagName)) return;

  const init = attr.getInitializer();
  if (!init) return;

  if (init.getKind() === SyntaxKind.StringLiteral) {
    const value = (init as any).getLiteralValue() as string;
    if (isHardcodedDimLabel(value)) {
      const { line, column } = getLineCol(sourceFile, attr.getStart());
      if (!isLineAllowedByMagicComment(sourceFile, line)) {
        violations.push({ file: TARGET, line, col: column, text: `label="${value}"`, context: `<${tagName}>` });
      }
    }
  } else if (init.getKind() === SyntaxKind.JsxExpression) {
    const expr = (init as any).getExpression?.();
    if (!expr) return;
    if (expr.getKind() === SyntaxKind.StringLiteral) {
      const value = expr.getLiteralValue() as string;
      if (isHardcodedDimLabel(value)) {
        const { line, column } = getLineCol(sourceFile, attr.getStart());
        if (!isLineAllowedByMagicComment(sourceFile, line)) {
          violations.push({ file: TARGET, line, col: column, text: `label={"${value}"}`, context: `<${tagName}>` });
        }
      }
    } else if (expr.getKind() === SyntaxKind.NumericLiteral) {
      const value = expr.getLiteralValue();
      const { line, column } = getLineCol(sourceFile, attr.getStart());
      if (!isLineAllowedByMagicComment(sourceFile, line)) {
        violations.push({ file: TARGET, line, col: column, text: `label={${value}}`, context: `<${tagName}>` });
      }
    }
    // TemplateExpression / Identifier / CallExpression / PropertyAccess → assumed dynamic, allowed
  }
});

// Scan 3: object literal `label: "30"` / `label: 30` (covers DimChain segments=[{label:"30"}])
sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).forEach((prop) => {
  const nameNode = prop.getNameNode();
  if (nameNode.getText() !== "label") return;

  const init = prop.getInitializer();
  if (!init) return;

  let value: string | null = null;
  let display = "";
  if (init.getKind() === SyntaxKind.StringLiteral) {
    value = (init as any).getLiteralValue() as string;
    display = `label: "${value}"`;
  } else if (init.getKind() === SyntaxKind.NumericLiteral) {
    const num = (init as any).getLiteralValue();
    value = String(num);
    display = `label: ${num}`;
  } else {
    return; // dynamic expression → allowed
  }

  if (value !== null && isHardcodedDimLabel(value)) {
    const { line, column } = getLineCol(sourceFile, prop.getStart());
    if (!isLineAllowedByMagicComment(sourceFile, line)) {
      violations.push({ file: TARGET, line, col: column, text: display, context: "segments[].label" });
    }
  }
});

// Report
if (violations.length === 0) {
  console.log("✅ audit-joinery-dynamic-dims: all dim labels derive from props (0 hardcoded violations)");
  process.exit(0);
} else {
  console.error(`❌ audit-joinery-dynamic-dims: ${violations.length} hardcoded mm numbers in details.tsx`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}:${v.col}  ${v.context}  →  ${v.text}`);
  }
  console.error("");
  console.error("Fix: bind label to props variable, e.g. label={`${tl}`} instead of label=\"30\"");
  console.error("Allow: add `// @joinery-dim-allow` on the same or previous line");
  process.exit(1);
}

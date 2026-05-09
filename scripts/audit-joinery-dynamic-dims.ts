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

// 教學文字白名單（含中文+數字的說明性文字，非真正尺寸標註）
// 這些 pattern 出現代表是教學註解（角度/比例/常用值/警示），放行
const EDUCATIONAL_PATTERNS: RegExp[] = [
  /ISO/i,                       // ISO 30° 等角圖
  /等角/,                        // 等角圖（30° 軸測）
  /軸測/,                        // 軸測投影
  /建議/,                        // mm（建議 = 板厚 1/3）
  /常用/,                        // 指厚常用 = 板厚 1/2
  /標準/,                        // 標準角度：硬木 1:8
  /漲縮/,                        // 1mm 漲縮餘量
  /餘量/,                        // 餘量說明
  /[×x]\s*\d+/,                 // × 2、x2、×1.5
  /\d+\s*[×x]\s*\d+/,           // 徑×1.5
  /1\s*[:：]\s*[68]/,           // 硬木 1:8、軟木 1:6
  /1\s*[:：]\s*[12]/,           // 比例 1:1 / 1:2
  /[1-9]\/[2-9]/,                // 1/2、1/3、2/3 分數
  /\d+\.?\d*\s*[°]/,            // 角度（30°、7.1°、9.5°）
  /R\s*\d+(\.\d+)?/,            // R0.5、R1 倒角
  /≈/,                          // 約等於符號
  /[±]\s*\d/,                   // ±0.3
  /<\s*\d/,                     // < 0.3mm
  /≤\s*\d/,                     // ≤ 0.5
  /誤差/,                        // 位置誤差
  /鎖死/,                        // 楔片鎖死
  /分解/,                        // 等角圖（ISO，分解）
];

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
  // 教學註解文字（含中文+教學關鍵字 pattern）→ 放行
  for (const re of EDUCATIONAL_PATTERNS) {
    if (re.test(value)) return false;
  }
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

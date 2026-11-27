export const calculationTemplates = [
  ['quotient', 'Cociente'], ['difference', 'Diferencia'], ['change', 'Variación porcentual'],
  ['if', 'Valor condicionado mediante IF'], ['case', 'Asignación mediante CASE'], ['custom', 'Fórmula personalizada'],
] as const;
export type Template = typeof calculationTemplates[number][0];
export type Operand = { field: string; aggregation: string };
export type ResultValue = { kind: 'number' | 'text' | 'field' | 'null'; value: string };
export type Clause = { field: string; comparison: string; value: ResultValue; result: ResultValue };
export const quotedField = (field: string) => `[${field.replace(/]/g, ']]')}]`;
export const operandExpression = (operand: Operand) => operand.aggregation === 'row' ? quotedField(operand.field) : `${operand.aggregation}(${quotedField(operand.field)})`;
export const resultExpression = (result: ResultValue) => result.kind === 'null' ? 'NULL' : result.kind === 'field' ? quotedField(result.value)
  : result.kind === 'text' ? JSON.stringify(result.value) : result.value.trim() || '0';
const conditionExpression = (clause: Clause) => `${quotedField(clause.field)} ${clause.comparison}${clause.comparison.startsWith('IS ') ? '' : ` ${resultExpression(clause.value)}`}`;
export function templateExpression(template: Template, first: Operand, second: Operand, clauses: Clause[], fallback: ResultValue) {
  const left = operandExpression(first), right = operandExpression(second);
  if (template === 'quotient') return `${left} / ${right}`;
  if (template === 'difference') return `${left} - ${right}`;
  if (template === 'change') return `(${left} - ${right}) / ${right}`;
  if (template === 'if') return `IF(${conditionExpression(clauses[0])}, ${resultExpression(clauses[0].result)}, ${resultExpression(fallback)})`;
  return `CASE\n${clauses.map(clause => `WHEN ${conditionExpression(clause)} THEN ${resultExpression(clause.result)}`).join('\n')}\nELSE ${resultExpression(fallback)}\nEND`;
}

export function recognizeArithmetic(expression: string): { template: Template; first: Operand; second: Operand } | null {
  const operand = String.raw`(?:\[(?:[^\]]|\]\])*\]|(?:SUM|AVG|MIN|MAX|MEDIAN|COUNT|COUNT_DISTINCT)\(\[(?:[^\]]|\]\])*\]\))`;
  const decode = (text: string): Operand => {
    const aggregate = text.match(/^(\w+)\((.*)\)$/);
    return { aggregation: aggregate?.[1] || 'row', field: (aggregate?.[2] || text).slice(1, -1).replace(/\]\]/g, ']') };
  };
  const change = expression.trim().match(new RegExp(`^\\((${operand}) - (${operand})\\) / (${operand})$`, 'i'));
  if (change && change[2] === change[3]) return { template: 'change', first: decode(change[1]), second: decode(change[2]) };
  const simple = expression.trim().match(new RegExp(`^(${operand})\\s*([/-])\\s*(${operand})$`, 'i'));
  return simple ? { template: simple[2] === '/' ? 'quotient' : 'difference', first: decode(simple[1]), second: decode(simple[3]) } : null;
}

import { gateway, jsonSchema, tool } from 'ai';

const calculatorInputSchema = {
  type: 'object',
  properties: {
    expression: {
      type: 'string',
      description: 'A mathematical expression using numbers, +, -, *, /, %, decimals, and parentheses.',
    },
  },
  required: ['expression'],
  additionalProperties: false,
} as const;

type Token = { kind: 'number' | 'operator' | 'left' | 'right'; value: string };

function tokenize(expression: string): Token[] {
  const cleaned = expression.replace(/\s+/g, '');
  if (!cleaned || cleaned.length > 120) throw new Error('Expression is empty or too long.');

  const tokens: Token[] = [];
  let i = 0;
  while (i < cleaned.length) {
    const char = cleaned[i];
    if (/\d|\./.test(char)) {
      let number = char;
      i += 1;
      while (i < cleaned.length && /[\d.]/.test(cleaned[i])) number += cleaned[i++];
      if ((number.match(/\./g) ?? []).length > 1 || number === '.') throw new Error('Invalid number.');
      tokens.push({ kind: 'number', value: number });
      continue;
    }
    if ('+-*/%'.includes(char)) {
      tokens.push({ kind: 'operator', value: char });
      i += 1;
      continue;
    }
    if (char === '(') {
      tokens.push({ kind: 'left', value: char });
      i += 1;
      continue;
    }
    if (char === ')') {
      tokens.push({ kind: 'right', value: char });
      i += 1;
      continue;
    }
    throw new Error(`Unsupported character: ${char}`);
  }

  return tokens;
}

function evaluateExpression(expression: string): number {
  const tokens = tokenize(expression);
  const values: number[] = [];
  const operators: string[] = [];
  const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2 };

  function applyTop() {
    const op = operators.pop();
    if (!op || op === '(') throw new Error('Invalid expression.');
    const right = values.pop();
    const left = values.pop();
    if (left === undefined || right === undefined) throw new Error('Invalid expression.');
    let result: number;
    switch (op) {
      case '+': result = left + right; break;
      case '-': result = left - right; break;
      case '*': result = left * right; break;
      case '/':
        if (right === 0) throw new Error('Cannot divide by zero.');
        result = left / right;
        break;
      case '%':
        if (right === 0) throw new Error('Cannot divide by zero.');
        result = left % right;
        break;
      default: throw new Error('Unsupported operator.');
    }
    if (!Number.isFinite(result)) throw new Error('The result is not finite.');
    values.push(result);
  }

  let expectValue = true;
  for (const token of tokens) {
    if (token.kind === 'number') {
      if (!expectValue) throw new Error('Missing operator.');
      values.push(Number(token.value));
      expectValue = false;
    } else if (token.kind === 'left') {
      if (!expectValue) throw new Error('Missing operator before parenthesis.');
      operators.push(token.value);
      expectValue = true;
    } else if (token.kind === 'right') {
      if (expectValue) throw new Error('Incomplete parenthesized expression.');
      while (operators.length && operators[operators.length - 1] !== '(') applyTop();
      if (operators.pop() !== '(') throw new Error('Mismatched parenthesis.');
      expectValue = false;
    } else {
      if (expectValue) {
        if (token.value === '+' || token.value === '-') {
          values.push(0);
        } else {
          throw new Error('Operator is missing a left value.');
        }
      }
      while (
        operators.length &&
        operators[operators.length - 1] !== '(' &&
        precedence[operators[operators.length - 1]] >= precedence[token.value]
      ) {
        applyTop();
      }
      operators.push(token.value);
      expectValue = true;
    }
  }

  if (expectValue) throw new Error('Expression ends with an operator.');
  while (operators.length) {
    if (operators[operators.length - 1] === '(') throw new Error('Mismatched parenthesis.');
    applyTop();
  }
  if (values.length !== 1) throw new Error('Invalid expression.');
  return values[0];
}

export const calculatorTool = tool({
  title: 'Calculator',
  description: 'Solve arithmetic accurately. Use this instead of doing multi-step numerical arithmetic mentally.',
  inputSchema: jsonSchema<{ expression: string }>(calculatorInputSchema),
  execute: async (input) => {
    const expression = typeof input === 'object' && input && 'expression' in input ? String(input.expression) : '';
    try {
      const value = evaluateExpression(expression);
      return { expression, value, formatted: Number.isInteger(value) ? String(value) : String(Number(value.toFixed(10))) };
    } catch (error) {
      return { expression, error: error instanceof Error ? error.message : 'Could not evaluate expression.' };
    }
  },
});

export const webSearchTool = gateway.tools.takoSearch();

export const nexaTools = {
  tako_search: webSearchTool,
  calculator: calculatorTool,
};

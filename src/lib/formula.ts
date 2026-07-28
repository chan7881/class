/**
 * 데이터표(dataTable) 문항의 계산 열 수식 파서 — eval·Function 생성자를 쓰지 않는
 * 재귀하강 파서 + 트리 워커. 지원: `+ - * / ^ ( )`, 열 참조(식별자), 열 전체를 보는
 * 집계 함수(avg/sum/min/max/count/stdev — 인자는 열 이름 하나), 스칼라 함수
 * (abs/sqrt/log/ln — 인자는 수식). (docs/PLAN.md 6번 항목 "eval 금지")
 */

export class FormulaError extends Error {}

type Node =
  | { t: 'num'; v: number }
  | { t: 'ref'; name: string }
  | { t: 'unary'; op: '-'; arg: Node }
  | { t: 'binary'; op: '+' | '-' | '*' | '/' | '^'; left: Node; right: Node }
  | { t: 'call'; name: string; args: Node[] }

const AGGREGATE_FNS = new Set(['avg', 'sum', 'min', 'max', 'count', 'stdev'])
const SCALAR_FNS = new Set(['abs', 'sqrt', 'log', 'ln'])

interface Token {
  type: 'num' | 'ident' | 'op' | 'lparen' | 'rparen' | 'comma'
  value: string
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (/[0-9.]/.test(c)) {
      let j = i
      while (j < src.length && /[0-9.]/.test(src[j])) j++
      tokens.push({ type: 'num', value: src.slice(i, j) })
      i = j
      continue
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++
      tokens.push({ type: 'ident', value: src.slice(i, j) })
      i = j
      continue
    }
    if (c === '(') {
      tokens.push({ type: 'lparen', value: c })
      i++
      continue
    }
    if (c === ')') {
      tokens.push({ type: 'rparen', value: c })
      i++
      continue
    }
    if (c === ',') {
      tokens.push({ type: 'comma', value: c })
      i++
      continue
    }
    if ('+-*/^'.includes(c)) {
      tokens.push({ type: 'op', value: c })
      i++
      continue
    }
    throw new FormulaError(`알 수 없는 문자: ${c}`)
  }
  return tokens
}

class Parser {
  private pos = 0
  private tokens: Token[]
  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos]
  }
  private next(): Token {
    const t = this.tokens[this.pos++]
    if (!t) throw new FormulaError('식이 예상보다 일찍 끝났습니다')
    return t
  }
  private expect(type: Token['type']): Token {
    const t = this.next()
    if (t.type !== type) throw new FormulaError(`구문 오류 (예상: ${type}, 실제: ${t.value})`)
    return t
  }

  parse(): Node {
    const node = this.parseAddSub()
    if (this.pos !== this.tokens.length) throw new FormulaError(`식 끝에 불필요한 내용이 있습니다: ${this.peek()?.value}`)
    return node
  }

  private parseAddSub(): Node {
    let node = this.parseMulDiv()
    while (this.peek()?.type === 'op' && (this.peek()!.value === '+' || this.peek()!.value === '-')) {
      const op = this.next().value as '+' | '-'
      node = { t: 'binary', op, left: node, right: this.parseMulDiv() }
    }
    return node
  }

  private parseMulDiv(): Node {
    let node = this.parsePow()
    while (this.peek()?.type === 'op' && (this.peek()!.value === '*' || this.peek()!.value === '/')) {
      const op = this.next().value as '*' | '/'
      node = { t: 'binary', op, left: node, right: this.parsePow() }
    }
    return node
  }

  private parsePow(): Node {
    const node = this.parseUnary()
    if (this.peek()?.type === 'op' && this.peek()!.value === '^') {
      this.next()
      return { t: 'binary', op: '^', left: node, right: this.parsePow() } // 오른쪽 결합
    }
    return node
  }

  private parseUnary(): Node {
    if (this.peek()?.type === 'op' && this.peek()!.value === '-') {
      this.next()
      return { t: 'unary', op: '-', arg: this.parseUnary() }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): Node {
    const t = this.peek()
    if (!t) throw new FormulaError('식이 예상보다 일찍 끝났습니다')

    if (t.type === 'num') {
      this.next()
      return { t: 'num', v: Number(t.value) }
    }
    if (t.type === 'lparen') {
      this.next()
      const node = this.parseAddSub()
      this.expect('rparen')
      return node
    }
    if (t.type === 'ident') {
      this.next()
      if (this.peek()?.type === 'lparen') {
        this.next()
        const args: Node[] = []
        if (this.peek()?.type !== 'rparen') {
          args.push(this.parseAddSub())
          while (this.peek()?.type === 'comma') {
            this.next()
            args.push(this.parseAddSub())
          }
        }
        this.expect('rparen')
        return { t: 'call', name: t.value, args }
      }
      return { t: 'ref', name: t.value }
    }
    throw new FormulaError(`예상치 못한 토큰: ${t.value}`)
  }
}

export function parseFormula(src: string): Node {
  return new Parser(tokenize(src)).parse()
}

export interface FormulaContext {
  /** 현재 행의 열 이름 → 값 (스칼라 계산용) */
  row: Record<string, number>
  /** 열 이름 → 전체 행의 값 배열 (집계 함수용) */
  columns: Record<string, number[]>
}

function aggregate(name: string, values: number[]): number {
  const clean = values.filter((v) => Number.isFinite(v))
  if (clean.length === 0) return name === 'count' ? 0 : NaN
  switch (name) {
    case 'avg':
      return clean.reduce((a, b) => a + b, 0) / clean.length
    case 'sum':
      return clean.reduce((a, b) => a + b, 0)
    case 'min':
      return Math.min(...clean)
    case 'max':
      return Math.max(...clean)
    case 'count':
      return clean.length
    case 'stdev': {
      const m = clean.reduce((a, b) => a + b, 0) / clean.length
      const variance = clean.reduce((a, b) => a + (b - m) ** 2, 0) / clean.length
      return Math.sqrt(variance)
    }
    default:
      throw new FormulaError(`알 수 없는 함수: ${name}`)
  }
}

export function evaluateFormula(node: Node, ctx: FormulaContext): number {
  switch (node.t) {
    case 'num':
      return node.v
    case 'ref': {
      if (!Object.hasOwn(ctx.row, node.name)) throw new FormulaError(`정의되지 않은 열: ${node.name}`)
      return ctx.row[node.name]
    }
    case 'unary':
      return -evaluateFormula(node.arg, ctx)
    case 'binary': {
      const l = evaluateFormula(node.left, ctx)
      const r = evaluateFormula(node.right, ctx)
      if (node.op === '+') return l + r
      if (node.op === '-') return l - r
      if (node.op === '*') return l * r
      if (node.op === '/') return l / r
      return Math.pow(l, r)
    }
    case 'call': {
      if (AGGREGATE_FNS.has(node.name)) {
        if (node.args.length !== 1 || node.args[0].t !== 'ref') {
          throw new FormulaError(`${node.name}()는 열 이름 하나만 인자로 받습니다`)
        }
        if (!Object.hasOwn(ctx.columns, node.args[0].name)) throw new FormulaError(`정의되지 않은 열: ${node.args[0].name}`)
        return aggregate(node.name, ctx.columns[node.args[0].name])
      }
      if (SCALAR_FNS.has(node.name)) {
        if (node.args.length !== 1) throw new FormulaError(`${node.name}()는 인자 1개가 필요합니다`)
        const v = evaluateFormula(node.args[0], ctx)
        if (node.name === 'abs') return Math.abs(v)
        if (node.name === 'sqrt') return Math.sqrt(v)
        if (node.name === 'log') return Math.log10(v)
        return Math.log(v) // ln
      }
      throw new FormulaError(`알 수 없는 함수: ${node.name}`)
    }
  }
}

export function evaluateFormulaString(src: string, ctx: FormulaContext): number {
  return evaluateFormula(parseFormula(src), ctx)
}

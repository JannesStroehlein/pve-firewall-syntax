// Semantic validation: produce diagnostics from a parsed document + resolution context.

import {
  ACTION_SET,
  DIRECTION_SET,
  LOGLEVEL_SET,
  MACRO_SET,
  OPTION_KEYS,
  PROTOCOL_SET,
  RULE_FLAG_SET
} from './builtins';
import { Diagnostic, FwDocument, Range, Rule, Section } from './model';
import {
  ResolutionContext,
  ResolvedRef,
  collectSymbols,
  resolveSymbol
} from './symbols';

export interface ValidateOptions {
  /** Emit a hint when cluster.fw is missing so dc/ refs cannot be checked. */
  warnMissingCluster: boolean;
}

const DEFAULTS: ValidateOptions = { warnMissingCluster: true };

function err(range: Range, code: string, message: string): Diagnostic {
  return { range, severity: 'error', code, message };
}
function warn(range: Range, code: string, message: string): Diagnostic {
  return { range, severity: 'warning', code, message };
}

function octetsOk(ip: string): boolean {
  return ip.split('.').every((o) => {
    const n = Number(o);
    return o.length > 0 && o.length <= 3 && n >= 0 && n <= 255;
  });
}

function validIpv4(s: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(s) && octetsOk(s);
}
function validCidr(s: string): boolean {
  const m = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(s);
  if (!m) return false;
  return octetsOk(m[1]) && Number(m[2]) <= 32;
}
function validRange(s: string): boolean {
  const m = /^(\d{1,3}(?:\.\d{1,3}){3})-(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s);
  return !!m && octetsOk(m[1]) && octetsOk(m[2]);
}

export function validate(
  doc: FwDocument,
  ctx: ResolutionContext,
  options: Partial<ValidateOptions> = {}
): Diagnostic[] {
  const opts = { ...DEFAULTS, ...options };
  const diags: Diagnostic[] = [...doc.parseDiagnostics];

  // Duplicate definitions in the document under validation.
  for (const dup of ctx.local.duplicates) {
    diags.push(
      err(
        dup.range,
        `duplicate-${dup.kind}`,
        `Duplicate ${dup.kind} "${dup.name}".`
      )
    );
  }

  let needCluster = false;

  for (const section of doc.sections) {
    if (section.kind === 'unknown') {
      diags.push(
        err(
          section.headerRange,
          'unknown-section',
          `Unknown section "[${section.rawHeader}]". Expected OPTIONS, RULES, ALIASES, IPSET <name> or group <name>.`
        )
      );
      continue;
    }
    if (
      (section.kind === 'IPSET' || section.kind === 'GROUP') &&
      !section.name
    ) {
      diags.push(
        err(
          section.headerRange,
          'missing-section-name',
          `[${section.rawHeader}] requires a name.`
        )
      );
    }

    if (section.kind === 'OPTIONS') validateOptions(section, diags);
    if (section.kind === 'ALIASES') validateAliases(section, diags);
    if (section.kind === 'IPSET') {
      if (validateIpsetEntries(section, ctx, diags)) needCluster = true;
    }
    if (section.kind === 'RULES' || section.kind === 'GROUP') {
      for (const rule of section.rules) {
        if (validateRule(rule, ctx, diags)) needCluster = true;
      }
    }
  }

  if (needCluster && !ctx.hasCluster && opts.warnMissingCluster) {
    diags.push({
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 }
      },
      severity: 'hint',
      code: 'no-cluster',
      message:
        'cluster.fw not found - dc/ aliases, IP sets and security groups cannot be verified.'
    });
  }

  return diags;
}

function validateOptions(section: Section, diags: Diagnostic[]): void {
  for (const opt of section.options) {
    const kind = OPTION_KEYS[opt.key];
    if (!kind) {
      diags.push(
        err(opt.keyRange, 'unknown-option', `Unknown option "${opt.key}".`)
      );
      continue;
    }
    const v = opt.value;
    switch (kind) {
      case 'bool':
        if (v !== '0' && v !== '1')
          diags.push(
            err(
              opt.valueRange,
              'bad-option-value',
              `"${opt.key}" expects 0 or 1.`
            )
          );
        break;
      case 'policy':
        if (!ACTION_SET.has(v))
          diags.push(
            err(
              opt.valueRange,
              'bad-option-value',
              `"${opt.key}" expects ACCEPT, DROP or REJECT.`
            )
          );
        break;
      case 'policy-fwd':
        if (v !== 'ACCEPT' && v !== 'DROP')
          diags.push(
            err(
              opt.valueRange,
              'bad-option-value',
              `"${opt.key}" expects ACCEPT or DROP.`
            )
          );
        break;
      case 'loglevel':
        if (!LOGLEVEL_SET.has(v))
          diags.push(
            err(
              opt.valueRange,
              'bad-option-value',
              `"${opt.key}" expects a log level (nolog, info, warning, ...).`
            )
          );
        break;
      case 'int':
        if (!/^\d+$/.test(v))
          diags.push(
            err(
              opt.valueRange,
              'bad-option-value',
              `"${opt.key}" expects an integer.`
            )
          );
        break;
      case 'free':
        break;
    }
  }
}

function validateAliases(section: Section, diags: Diagnostic[]): void {
  for (const a of section.aliases) {
    if (!validIpv4(a.value) && !validCidr(a.value) && !validRange(a.value)) {
      diags.push(err(a.valueRange, 'bad-ip', `Invalid address "${a.value}".`));
    }
  }
}

const RE_ALIAS_NAME = /^[A-Za-z][\w.-]*$/;

/** Returns true if any entry references a dc/ alias (so a missing cluster matters). */
function validateIpsetEntries(
  section: Section,
  ctx: ResolutionContext,
  diags: Diagnostic[]
): boolean {
  let touchedDc = false;
  for (const e of section.ipsetEntries) {
    if (validIpv4(e.value) || validCidr(e.value) || validRange(e.value))
      continue;

    // IP set members may also be alias references (local or dc/ scoped).
    const dc = e.value.startsWith('dc/');
    const name = dc ? e.value.slice(3) : e.value;
    if (!RE_ALIAS_NAME.test(name)) {
      diags.push(
        err(e.valueRange, 'bad-ip', `Invalid IP set entry "${e.value}".`)
      );
      continue;
    }
    if (reportRef(resolveSymbol('alias', name, dc, ctx), e.valueRange, diags)) {
      touchedDc = true;
    }
  }
  return touchedDc;
}

/** Returns true if the rule references a dc/ symbol (so a missing cluster matters). */
function validateRule(
  rule: Rule,
  ctx: ResolutionContext,
  diags: Diagnostic[]
): boolean {
  let touchedDc = false;

  if (rule.groupRef) {
    return reportRef(
      resolveSymbol('group', rule.groupRef.name, false, ctx),
      rule.groupRef.range,
      diags
    );
  }

  if (rule.direction && !DIRECTION_SET.has(rule.direction.value)) {
    diags.push(
      err(
        rule.direction.range,
        'unknown-direction',
        `Unknown direction "${rule.direction.value}". Expected IN, OUT or FORWARD.`
      )
    );
  }
  if (rule.macro && !MACRO_SET.has(rule.macro.value)) {
    diags.push(
      err(
        rule.macro.range,
        'unknown-macro',
        `Unknown macro "${rule.macro.value}".`
      )
    );
  }
  if (!rule.action && !rule.macro) {
    const r = rule.direction?.range ?? {
      start: { line: rule.line, character: 0 },
      end: { line: rule.line, character: 0 }
    };
    diags.push(
      err(
        r,
        'missing-action',
        'Rule is missing an action (ACCEPT, DROP or REJECT).'
      )
    );
  }

  for (const f of rule.flags) {
    if (!RULE_FLAG_SET.has(f.flag)) {
      diags.push(
        err(f.range, 'unknown-flag', `Unknown rule option "${f.flag}".`)
      );
      continue;
    }
    if ((f.flag === '-p' || f.flag === '-proto') && f.value && f.valueRange) {
      if (!PROTOCOL_SET.has(f.value.toLowerCase()) && !/^\d+$/.test(f.value)) {
        diags.push(
          warn(
            f.valueRange,
            'unknown-protocol',
            `Unknown protocol "${f.value}".`
          )
        );
      }
    }
    if (
      f.flag === '-log' &&
      f.value &&
      f.valueRange &&
      !LOGLEVEL_SET.has(f.value)
    ) {
      diags.push(
        warn(f.valueRange, 'bad-loglevel', `Unknown log level "${f.value}".`)
      );
    }
  }

  for (const lit of rule.literals) {
    if (lit.context === 'ip') {
      if (
        !validIpv4(lit.text) &&
        !validCidr(lit.text) &&
        !validRange(lit.text)
      ) {
        diags.push(err(lit.range, 'bad-ip', `Invalid address "${lit.text}".`));
      }
    } else {
      if (!validatePortSpec(lit.text)) {
        diags.push(err(lit.range, 'bad-port', `Invalid port "${lit.text}".`));
      }
    }
  }

  for (const ref of rule.refs) {
    if (
      reportRef(
        resolveSymbol(ref.kind, ref.name, ref.dc, ctx),
        ref.range,
        diags
      )
    ) {
      touchedDc = true;
    }
  }

  return touchedDc;
}

const REF_CODE = {
  alias: 'unresolved-alias',
  ipset: 'unresolved-ipset',
  group: 'unresolved-group'
} as const;
const REF_NOUN = {
  alias: 'Alias',
  ipset: 'IP set',
  group: 'Security group'
} as const;

/**
 * Emit a diagnostic for an unresolved reference. Returns true when the reference
 * could not be checked because cluster.fw is unavailable (scope "unknown"), so
 * the caller can raise the single "no-cluster" hint instead of a false error.
 */
function reportRef(r: ResolvedRef, range: Range, diags: Diagnostic[]): boolean {
  if (r.scope === 'unknown') return true;
  if (r.scope === 'unresolved') {
    const where = r.label.includes('dc/') ? ' in cluster.fw' : '';
    diags.push(
      err(
        range,
        REF_CODE[r.kind],
        `${REF_NOUN[r.kind]} "${r.label}" is not defined${where}.`
      )
    );
  }
  return false;
}

function validatePortSpec(s: string): boolean {
  const portOk = (p: string) =>
    /^\d{1,5}$/.test(p) && Number(p) >= 1 && Number(p) <= 65535;
  if (s.includes(':')) {
    const [a, b] = s.split(':');
    return portOk(a) && portOk(b);
  }
  return portOk(s);
}

/** Convenience: build a local-only context (no cluster) for single-file validation. */
export function localContext(doc: FwDocument): ResolutionContext {
  const empty = collectSymbols({ ...doc, sections: [] });
  return { local: collectSymbols(doc), dc: empty, hasCluster: false };
}

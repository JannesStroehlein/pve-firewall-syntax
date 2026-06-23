// Canonical PVE firewall vocabulary.
// Ported from syntaxes/pve-firewall.tmLanguage.json; macros come from the generated
// module (resources/macros.json, the upstream proxmox-ve-config source of truth).

export { MACRO_INFO, MACROS } from './macros.generated';
import { MACROS } from './macros.generated';

export const DIRECTIONS = ['IN', 'OUT', 'FORWARD'] as const;
export const ACTIONS = ['ACCEPT', 'DROP', 'REJECT'] as const;
export const PROTOCOLS = [
  'tcp',
  'udp',
  'icmp',
  'icmpv6',
  'ipv6-icmp',
  'igmp',
  'gre',
  'esp',
  'ah'
] as const;
export const LOG_LEVELS = [
  'nolog',
  'emerg',
  'alert',
  'crit',
  'err',
  'warning',
  'notice',
  'info',
  'debug'
] as const;

// Rule option flags (with leading dash).
export const RULE_FLAGS = [
  '-p',
  '-proto',
  '-dport',
  '-sport',
  '-source',
  '-dest',
  '-i',
  '-iface',
  '-o',
  '-log',
  '-icmp-type'
] as const;

export type OptionValueKind =
  | 'bool'
  | 'policy'
  | 'policy-fwd'
  | 'loglevel'
  | 'int'
  | 'free';

// [OPTIONS] keys and the kind of value they accept (from option-line regex).
export const OPTION_KEYS: Record<string, OptionValueKind> = {
  enable: 'bool',
  ebtables: 'bool',
  policy_in: 'policy',
  policy_out: 'policy',
  policy_forward: 'policy-fwd',
  log_ratelimit: 'free',
  log_level_in: 'loglevel',
  log_level_out: 'loglevel',
  log_level_forward: 'loglevel',
  log_nf_conntrack: 'bool',
  ndp: 'bool',
  nf_conntrack_allow_invalid: 'bool',
  nf_conntrack_helpers: 'free',
  nf_conntrack_max: 'int',
  nf_conntrack_tcp_timeout_established: 'int',
  nf_conntrack_tcp_timeout_syn_recv: 'int',
  nftables: 'bool',
  nosmurfs: 'bool',
  protection_synflood: 'bool',
  protection_synflood_burst: 'int',
  protection_synflood_rate: 'int',
  smurf_log_level: 'loglevel',
  tcp_flags_log_level: 'loglevel',
  tcpflags: 'bool',
  dhcp: 'bool',
  ipfilter: 'bool',
  macfilter: 'bool',
  radv: 'bool',
  ips: 'bool',
  ips_queues: 'free'
};

export const SECTION_NAMES = [
  'OPTIONS',
  'RULES',
  'ALIASES',
  'IPSET',
  'group'
] as const;

const lc = (xs: readonly string[]) => new Set(xs.map((x) => x.toLowerCase()));

export const MACRO_SET = new Set<string>(MACROS);
export const DIRECTION_SET = new Set<string>(DIRECTIONS);
export const ACTION_SET = new Set<string>(ACTIONS);
export const PROTOCOL_SET = lc(PROTOCOLS);
export const LOGLEVEL_SET = new Set<string>(LOG_LEVELS);
export const RULE_FLAG_SET = new Set<string>(RULE_FLAGS);

export const POLICY_VALUES = ACTIONS;
export const POLICY_FWD_VALUES = ['ACCEPT', 'DROP'] as const;

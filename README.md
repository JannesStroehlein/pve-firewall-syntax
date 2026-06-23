# Proxmox VE Firewall Syntax

Syntax highlighting, **language server** (diagnostics + completion), and a **CLI checker** for [Proxmox VE firewall](https://pve.proxmox.com/wiki/Firewall) configuration files (`.fw`).

The editor integration and the CLI share one validation engine (`src/core`), so "do all aliases resolve?" is answered identically in VS Code and in CI.

## Features

### Diagnostics (error highlighting)

Live in the editor, or on demand via the CLI:

- Unknown sections, options, macros, directions and rule flags
- Invalid option values (e.g. `enable: 2`, `policy_in: BLOCK`)
- Malformed IPv4 / CIDR / IP-range / port / port-range literals
- **Unresolved alias references** (`-source myalias`, `dc/local_network`)
- **Unresolved IP set references** (`+management`, `+dc/blacklist`)
- **Unresolved security group references** (`GROUP webserver`)
- Duplicate alias / IP set / group definitions

IP set members may be literal IPs/CIDRs/ranges **or** alias references (bare or `dc/`-scoped) - both are resolved.

### Cross-file resolution

Datacenter-scoped symbols (`dc/` aliases & IP sets, security groups) live in `cluster.fw`. The checker locates it by:

1. A magic comment at the top of the file:
   ```ini
   # pve-fw: cluster=../cluster.fw
   # pve-fw: node=pve1
   ```
2. The `pveFirewall.clusterPath` setting / `--cluster` CLI flag.
3. Auto-discovery - walking up directories for `cluster.fw` or `firewall/cluster.fw` (mirrored `/etc/pve` layout).

A file named `cluster.fw` resolves its own `dc/` references. If no `cluster.fw` is found, `dc/` references are left unchecked (a hint is emitted, configurable).

### Auto-completion & hover

Context-aware completion: section names, directions, actions, macros, option keys and values, rule flags, protocols, log levels, and live alias / IP set / security group names pulled from the resolved symbol table.

Hover shows what a built-in macro opens (description, protocols, ports) and the value behind an alias or the kind of an IP set / security group reference.

Macro data is **generated at build time** from the upstream Proxmox source (`resources/macros.json`, see [Development](#development)), so it stays in sync with PVE.

### Syntax highlighting

- Highlighting for all PVE firewall constructs:
  - Section headers (`[OPTIONS]`, `[RULES]`, `[ALIASES]`, `[IPSET name]`, `[group name]`)
  - Directions (`IN`, `OUT`, `FORWARD`)
  - Actions (`ACCEPT`, `DROP`, `REJECT`)
  - All 60+ built-in macros (`SSH`, `HTTP`, `DNS`, `Ping`, `Ceph`, etc.)
  - Option keys (`enable`, `policy_in`, `log_level_in`, `nftables`, etc.)
  - Option flags (`-source`, `-dest`, `-dport`, `-sport`, `-p`, `-i`, `-log`)
  - IPv4 addresses and CIDR notation
  - IP ranges (`10.0.0.1-10.0.0.10`)
  - Port numbers and port ranges (`80:85`)
  - IPSet references (`+management`, `+dc/blacklist`)
  - Alias references (`dc/local_network`)
  - Log levels (`debug`, `info`, `warning`, `err`, `crit`, etc.)
  - Protocol names (`tcp`, `udp`, `icmp`)
  - Disabled rules (prefixed with `|`)
  - Comments (`# ...`)
  - Security group references (`GROUP webserver`)

- **Code folding** per section

- **Comment toggling** with `Ctrl+/` / `Cmd+/`

- **Snippets** for common patterns:
  - `options` - `[OPTIONS]` section
  - `rules` - `[RULES]` section
  - `ipset` - `[IPSET name]` section
  - `group` - `[group name]` section
  - `ssh`, `http`, `https`, `dns`, `ping` - common macro rules
  - `in-accept`, `in-drop`, `out-accept` - generic rules
  - `group-web` - web server security group
  - `group-mgmt` - management access security group
  - `vm-fw` - full VM/CT firewall template
  - `cluster-fw` - full cluster.fw template

## Supported files

The extension activates for any file with a `.fw` extension. This covers:

- `/etc/pve/firewall/cluster.fw`
- `/etc/pve/nodes/<node>/host.fw`
- `/etc/pve/firewall/<VMID>.fw`
- `/etc/pve/sdn/firewall/<vnet>.fw`

## Installation

### From VSIX (local install)

```bash
# Package the extension (requires vsce)
bun install -g @vscode/vsce
cd pve-firewall-syntax
vsce package

# Install the .vsix file
code --install-extension pve-firewall-syntax-0.1.0.vsix
```

### Manual install

Copy the `pve-firewall-syntax` folder to your VS Code extensions directory:

```bash
# Linux
cp -r pve-firewall-syntax ~/.vscode/extensions/

# macOS
cp -r pve-firewall-syntax ~/.vscode/extensions/

# Windows
# Copy to %USERPROFILE%\.vscode\extensions\
```

Restart VS Code after installing.

## Example

```ini
# /etc/pve/firewall/cluster.fw

[OPTIONS]
enable: 1
policy_in: DROP
policy_out: ACCEPT

[ALIASES]
local_network 192.168.178.0/24
traefik 10.10.0.102

[IPSET management]
192.168.178.0/24

[IPSET blacklist]
77.240.159.182
213.87.123.0/24

[group webserver]
IN HTTP(ACCEPT)
IN HTTPS(ACCEPT)

[group mgmt-access]
IN SSH(ACCEPT) -source +management
IN ACCEPT -p tcp -dport 8006 -source +management # PVE GUI
IN Ping(ACCEPT) -source +management

[RULES]
GROUP mgmt-access
|IN ACCEPT -p tcp -dport 3128 # SPICE - disabled
```

## CLI checker

The same engine runs standalone as `pve-fw-check` - useful in pre-commit hooks or CI.

```bash
# After building (bun run build), or once installed globally:
node dist/cli.js /etc/pve/firewall/cluster.fw
pve-fw-check /etc/pve/firewall/*.fw

# Options
pve-fw-check --format json   file.fw    # structured output
pve-fw-check --cluster ./cluster.fw  100.fw   # explicit dc/ source
pve-fw-check --no-dc-warn    host.fw    # suppress missing-cluster hint
```

Output:

```
examples/broken.fw
  4:9   error   bad-option-value     "enable" expects 0 or 1.
  21:36 error   unresolved-alias     Alias "missing_alias" is not defined.
  24:7  error   unresolved-group     Security group "no_such_group" is not defined.
```

Exit codes: `0` clean, `1` errors found, `2` bad usage.

## Extension settings

| Setting                          | Default | Description                                                           |
| -------------------------------- | ------- | --------------------------------------------------------------------- |
| `pveFirewall.clusterPath`        | `""`    | Path to `cluster.fw` for `dc/` resolution (auto-discovered if empty). |
| `pveFirewall.node`               | `""`    | Default node name for `host.fw` lookup.                               |
| `pveFirewall.warnMissingCluster` | `true`  | Hint when `cluster.fw` cannot be found.                               |
| `pveFirewall.trace.server`       | `off`   | Trace client/server communication.                                    |

## Development

```bash
bun install
bun run gen:macros   # regenerate src/core/macros.generated.ts from resources/macros.json
bun run build        # gen + bundle extension.js, server.js, cli.js into dist/ (esbuild)
bun run watch        # rebuild on change
bun run check        # gen + tsc type-check
bun run test         # gen + core engine unit tests (node:test via tsx)
```

In VS Code press `F5` to launch an Extension Development Host, then open a `.fw` file to see diagnostics, completions and hovers live.

### Updating macro data

Built-in macros are generated from `resources/macros.json`, vendored from
[`proxmox-ve-config`](https://git.proxmox.com/?p=proxmox-ve-rs.git;a=blob_plain;f=proxmox-ve-config/resources/macros.json;hb=refs/heads/master).
To refresh against upstream:

```bash
mkdir resources
curl -sL "https://git.proxmox.com/?p=proxmox-ve-rs.git;a=blob_plain;f=proxmox-ve-config/resources/macros.json;hb=refs/heads/master" -o resources/macros.json
bun run gen:macros
```

`gen:macros` runs automatically before `build`, `check` and `test`.

## License

MIT

# Proxmox VE Firewall Syntax

Syntax highlighting, snippets, and language support for [Proxmox VE firewall](https://pve.proxmox.com/wiki/Firewall) configuration files (`.fw`).

## Features

- **Syntax highlighting** for all PVE firewall constructs:
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
  - `options` — `[OPTIONS]` section
  - `rules` — `[RULES]` section
  - `ipset` — `[IPSET name]` section
  - `group` — `[group name]` section
  - `ssh`, `http`, `https`, `dns`, `ping` — common macro rules
  - `in-accept`, `in-drop`, `out-accept` — generic rules
  - `group-web` — web server security group
  - `group-mgmt` — management access security group
  - `vm-fw` — full VM/CT firewall template
  - `cluster-fw` — full cluster.fw template

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
npm install -g @vscode/vsce
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

## License

MIT

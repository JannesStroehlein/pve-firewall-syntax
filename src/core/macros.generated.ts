// AUTO-GENERATED — do not edit. Run `npm run gen:macros`.
// Source: proxmox-ve-rs proxmox-ve-config/resources/macros.json (vendored in resources/).
import { MacroInfo } from "./model";

export const MACRO_INFO: Record<string, MacroInfo> = {
  Amanda: {
    name: "Amanda",
    desc: "Amanda Backup",
    code: [
      { proto: "udp", dport: "10080" },
      { proto: "tcp", dport: "10080" },
    ],
  },
  Auth: {
    name: "Auth",
    desc: "Auth (identd) traffic",
    code: [{ proto: "tcp", dport: "113" }],
  },
  BGP: {
    name: "BGP",
    desc: "Border Gateway Protocol traffic",
    code: [{ proto: "tcp", dport: "179" }],
  },
  BitTorrent: {
    name: "BitTorrent",
    desc: "BitTorrent traffic for BitTorrent 3.1 and earlier",
    code: [
      { proto: "tcp", dport: "6881:6889" },
      { proto: "udp", dport: "6881" },
    ],
  },
  BitTorrent32: {
    name: "BitTorrent32",
    desc: "BitTorrent traffic for BitTorrent 3.2 and later",
    code: [
      { proto: "tcp", dport: "6881:6999" },
      { proto: "udp", dport: "6881" },
    ],
  },
  Ceph: {
    name: "Ceph",
    desc: "Ceph Storage Cluster traffic (Ceph Monitors, OSD & MDS Daemons)",
    code: [
      { proto: "tcp", dport: "6789" },
      { proto: "tcp", dport: "3300" },
      { proto: "tcp", dport: "6800:7300" },
    ],
  },
  Citrix: {
    name: "Citrix",
    desc: "Citrix/ICA traffic (ICA, ICA Browser, CGP)",
    code: [
      { proto: "tcp", dport: "1494" },
      { proto: "udp", dport: "1604" },
      { proto: "tcp", dport: "2598" },
    ],
  },
  CVS: {
    name: "CVS",
    desc: "Concurrent Versions System pserver traffic",
    code: [{ proto: "tcp", dport: "2401" }],
  },
  DAAP: {
    name: "DAAP",
    desc: "Digital Audio Access Protocol traffic (iTunes, Rythmbox daemons)",
    code: [
      { proto: "tcp", dport: "3689" },
      { proto: "udp", dport: "3689" },
    ],
  },
  DCC: {
    name: "DCC",
    desc: "Distributed Checksum Clearinghouse spam filtering mechanism",
    code: [{ proto: "tcp", dport: "6277" }],
  },
  DHCPfwd: {
    name: "DHCPfwd",
    desc: "Forwarded DHCP traffic",
    code: [{ proto: "udp", dport: "67:68", sport: "67:68" }],
  },
  DHCPv6: {
    name: "DHCPv6",
    desc: "DHCPv6 traffic",
    code: [{ proto: "udp", dport: "546:547", sport: "546:547" }],
  },
  Distcc: {
    name: "Distcc",
    desc: "Distributed Compiler service",
    code: [{ proto: "tcp", dport: "3632" }],
  },
  DNS: {
    name: "DNS",
    desc: "Domain Name System traffic (upd and tcp)",
    code: [
      { proto: "udp", dport: "53" },
      { proto: "tcp", dport: "53" },
    ],
  },
  Finger: {
    name: "Finger",
    desc: "Finger protocol (RFC 742)",
    code: [{ proto: "tcp", dport: "79" }],
  },
  FTP: {
    name: "FTP",
    desc: "File Transfer Protocol",
    code: [{ proto: "tcp", dport: "21" }],
  },
  Git: {
    name: "Git",
    desc: "Git distributed revision control traffic",
    code: [{ proto: "tcp", dport: "9418" }],
  },
  GNUnet: {
    name: "GNUnet",
    desc: "GNUnet secure peer-to-peer networking traffic",
    code: [
      { proto: "tcp", dport: "2086" },
      { proto: "udp", dport: "2086" },
      { proto: "tcp", dport: "1080" },
      { proto: "udp", dport: "1080" },
    ],
  },
  GRE: {
    name: "GRE",
    desc: "Generic Routing Encapsulation tunneling protocol",
    code: [{ proto: "47" }],
  },
  HKP: {
    name: "HKP",
    desc: "OpenPGP HTTP key server protocol traffic",
    code: [{ proto: "tcp", dport: "11371" }],
  },
  HTTP: {
    name: "HTTP",
    desc: "Hypertext Transfer Protocol (WWW)",
    code: [{ proto: "tcp", dport: "80" }],
  },
  "HTTP/3": {
    name: "HTTP/3",
    desc: "Hypertext Transfer Protocol v3",
    code: [{ proto: "udp", dport: "443" }],
  },
  HTTPS: {
    name: "HTTPS",
    desc: "Hypertext Transfer Protocol (WWW) over SSL",
    code: [{ proto: "tcp", dport: "443" }],
  },
  ICPV2: {
    name: "ICPV2",
    desc: "Internet Cache Protocol V2 (Squid) traffic",
    code: [{ proto: "udp", dport: "3130" }],
  },
  ICQ: {
    name: "ICQ",
    desc: "AOL Instant Messenger traffic",
    code: [{ proto: "tcp", dport: "5190" }],
  },
  IMAP: {
    name: "IMAP",
    desc: "Internet Message Access Protocol",
    code: [{ proto: "tcp", dport: "143" }],
  },
  IMAPS: {
    name: "IMAPS",
    desc: "Internet Message Access Protocol over SSL",
    code: [{ proto: "tcp", dport: "993" }],
  },
  IPIP: {
    name: "IPIP",
    desc: "IPIP capsulation traffic",
    code: [{ proto: "94" }],
  },
  IPsec: {
    name: "IPsec",
    desc: "IPsec traffic",
    code: [{ proto: "udp", dport: "500", sport: "500" }, { proto: "50" }],
  },
  IPsecah: {
    name: "IPsecah",
    desc: "IPsec authentication (AH) traffic",
    code: [{ proto: "udp", dport: "500", sport: "500" }, { proto: "51" }],
  },
  IPsecnat: {
    name: "IPsecnat",
    desc: "IPsec traffic and Nat-Traversal",
    code: [
      { proto: "udp", dport: "500" },
      { proto: "udp", dport: "4500" },
      { proto: "50" },
    ],
  },
  IRC: {
    name: "IRC",
    desc: "Internet Relay Chat traffic",
    code: [{ proto: "tcp", dport: "6667" }],
  },
  Jetdirect: {
    name: "Jetdirect",
    desc: "HP Jetdirect printing",
    code: [{ proto: "tcp", dport: "9100" }],
  },
  L2TP: {
    name: "L2TP",
    desc: "Layer 2 Tunneling Protocol traffic",
    code: [{ proto: "udp", dport: "1701" }],
  },
  LDAP: {
    name: "LDAP",
    desc: "Lightweight Directory Access Protocol traffic",
    code: [{ proto: "tcp", dport: "389" }],
  },
  LDAPS: {
    name: "LDAPS",
    desc: "Secure Lightweight Directory Access Protocol traffic",
    code: [{ proto: "tcp", dport: "636" }],
  },
  Mail: {
    name: "Mail",
    desc: "Mail traffic (SMTP, SMTPS, Submission)",
    code: [
      { proto: "tcp", dport: "25" },
      { proto: "tcp", dport: "465" },
      { proto: "tcp", dport: "587" },
    ],
  },
  MDNS: {
    name: "MDNS",
    desc: "Multicast DNS",
    code: [{ proto: "udp", dport: "5353" }],
  },
  MSNP: {
    name: "MSNP",
    desc: "Microsoft Notification Protocol",
    code: [{ proto: "tcp", dport: "1863" }],
  },
  MSSQL: {
    name: "MSSQL",
    desc: "Microsoft SQL Server",
    code: [{ proto: "tcp", dport: "1433" }],
  },
  Munin: {
    name: "Munin",
    desc: "Munin networked resource monitoring traffic",
    code: [{ proto: "tcp", dport: "4949" }],
  },
  MySQL: {
    name: "MySQL",
    desc: "MySQL server",
    code: [{ proto: "tcp", dport: "3306" }],
  },
  NeighborDiscovery: {
    name: "NeighborDiscovery",
    desc: "IPv6 neighbor solicitation, neighbor and router advertisement",
    code: [
      { proto: "icmpv6", "icmp-type": "nd-router-solicit" },
      { proto: "icmpv6", "icmp-type": "nd-router-advert" },
      { proto: "icmpv6", "icmp-type": "nd-neighbor-solicit" },
      { proto: "icmpv6", "icmp-type": "nd-neighbor-advert" },
    ],
  },
  NNTP: {
    name: "NNTP",
    desc: "NNTP traffic (Usenet).",
    code: [{ proto: "tcp", dport: "119" }],
  },
  NNTPS: {
    name: "NNTPS",
    desc: "Encrypted NNTP traffic (Usenet)",
    code: [{ proto: "tcp", dport: "563" }],
  },
  NTP: {
    name: "NTP",
    desc: "Network Time Protocol (ntpd)",
    code: [{ proto: "udp", dport: "123" }],
  },
  OpenVPN: {
    name: "OpenVPN",
    desc: "OpenVPN traffic",
    code: [{ proto: "udp", dport: "1194" }],
  },
  OSPF: {
    name: "OSPF",
    desc: "OSPF multicast traffic",
    code: [{ proto: "89" }],
  },
  PBS: {
    name: "PBS",
    desc: "Proxmox Backup Server",
    code: [{ proto: "tcp", dport: "8007" }],
  },
  PCA: {
    name: "PCA",
    desc: "Symantec PCAnywere (tm)",
    code: [
      { proto: "udp", dport: "5632" },
      { proto: "tcp", dport: "5631" },
    ],
  },
  Ping: {
    name: "Ping",
    desc: "ICMP echo request",
    code: [
      { proto: "icmp", "icmp-type": "echo-request" },
      { proto: "icmpv6", "icmp-type": "echo-request" },
    ],
  },
  PMG: {
    name: "PMG",
    desc: "Proxmox Mail Gateway web interface",
    code: [{ proto: "tcp", dport: "8006" }],
  },
  POP3: {
    name: "POP3",
    desc: "POP3 traffic",
    code: [{ proto: "tcp", dport: "110" }],
  },
  POP3S: {
    name: "POP3S",
    desc: "Encrypted POP3 traffic",
    code: [{ proto: "tcp", dport: "995" }],
  },
  PostgreSQL: {
    name: "PostgreSQL",
    desc: "PostgreSQL server",
    code: [{ proto: "tcp", dport: "5432" }],
  },
  PPtP: {
    name: "PPtP",
    desc: "Point-to-Point Tunneling Protocol",
    code: [{ proto: "47" }, { proto: "tcp", dport: "1723" }],
  },
  Printer: {
    name: "Printer",
    desc: "Line Printer protocol printing",
    code: [{ proto: "tcp", dport: "515" }],
  },
  Razor: {
    name: "Razor",
    desc: "Razor Antispam System",
    code: [{ proto: "tcp", dport: "2703" }],
  },
  Rdate: {
    name: "Rdate",
    desc: "Remote time retrieval (rdate)",
    code: [{ proto: "tcp", dport: "37" }],
  },
  RDP: {
    name: "RDP",
    desc: "Microsoft Remote Desktop Protocol traffic",
    code: [{ proto: "tcp", dport: "3389" }],
  },
  RIP: {
    name: "RIP",
    desc: "Routing Information Protocol (bidirectional)",
    code: [{ proto: "udp", dport: "520" }],
  },
  RNDC: {
    name: "RNDC",
    desc: "BIND remote management protocol",
    code: [{ proto: "tcp", dport: "953" }],
  },
  Rsync: {
    name: "Rsync",
    desc: "Rsync server",
    code: [{ proto: "tcp", dport: "873" }],
  },
  SANE: {
    name: "SANE",
    desc: "SANE network scanning",
    code: [{ proto: "tcp", dport: "6566" }],
  },
  SixXS: {
    name: "SixXS",
    desc: "SixXS IPv6 Deployment and Tunnel Broker",
    code: [
      { proto: "tcp", dport: "3874" },
      { proto: "udp", dport: "3740" },
      { proto: "41" },
      { proto: "udp", dport: "5072,8374" },
    ],
  },
  SMB: {
    name: "SMB",
    desc: "Microsoft SMB traffic",
    code: [
      { proto: "udp", dport: "135,445" },
      { proto: "udp", dport: "137:139" },
      { proto: "udp", dport: "1024:65535", sport: "137" },
      { proto: "tcp", dport: "135,139,445" },
    ],
  },
  SMBswat: {
    name: "SMBswat",
    desc: "Samba Web Administration Tool",
    code: [{ proto: "tcp", dport: "901" }],
  },
  SMTP: {
    name: "SMTP",
    desc: "Simple Mail Transfer Protocol",
    code: [{ proto: "tcp", dport: "25" }],
  },
  SMTPS: {
    name: "SMTPS",
    desc: "Encrypted Simple Mail Transfer Protocol",
    code: [{ proto: "tcp", dport: "465" }],
  },
  SNMP: {
    name: "SNMP",
    desc: "Simple Network Management Protocol",
    code: [
      { proto: "udp", dport: "161:162" },
      { proto: "tcp", dport: "161" },
    ],
  },
  SPAMD: {
    name: "SPAMD",
    desc: "Spam Assassin SPAMD traffic",
    code: [{ proto: "tcp", dport: "783" }],
  },
  SPICEproxy: {
    name: "SPICEproxy",
    desc: "Proxmox VE SPICE display proxy traffic",
    code: [{ proto: "tcp", dport: "3128" }],
  },
  Squid: {
    name: "Squid",
    desc: "Squid web proxy traffic",
    code: [{ proto: "tcp", dport: "3128" }],
  },
  SSH: {
    name: "SSH",
    desc: "Secure shell traffic",
    code: [{ proto: "tcp", dport: "22" }],
  },
  Submission: {
    name: "Submission",
    desc: "Mail message submission traffic",
    code: [{ proto: "tcp", dport: "587" }],
  },
  SVN: {
    name: "SVN",
    desc: "Subversion server (svnserve)",
    code: [{ proto: "tcp", dport: "3690" }],
  },
  Syslog: {
    name: "Syslog",
    desc: "Syslog protocol (RFC 5424) traffic",
    code: [
      { proto: "udp", dport: "514" },
      { proto: "tcp", dport: "514" },
    ],
  },
  Telnet: {
    name: "Telnet",
    desc: "Telnet traffic",
    code: [{ proto: "tcp", dport: "23" }],
  },
  Telnets: {
    name: "Telnets",
    desc: "Telnet over SSL",
    code: [{ proto: "tcp", dport: "992" }],
  },
  TFTP: {
    name: "TFTP",
    desc: "Trivial File Transfer Protocol traffic",
    code: [{ proto: "udp", dport: "69" }],
  },
  Time: {
    name: "Time",
    desc: "RFC 868 Time protocol",
    code: [{ proto: "tcp", dport: "37" }],
  },
  Trcrt: {
    name: "Trcrt",
    desc: "Traceroute (for up to 30 hops) traffic",
    code: [
      { proto: "udp", dport: "33434:33524" },
      { proto: "icmp", "icmp-type": "echo-request" },
      { proto: "icmpv6", "icmp-type": "echo-request" },
    ],
  },
  VNC: {
    name: "VNC",
    desc: "VNC traffic for VNC display's 0 - 99",
    code: [{ proto: "tcp", dport: "5900:5999" }],
  },
  VNCL: {
    name: "VNCL",
    desc: "VNC traffic from Vncservers to Vncviewers in listen mode",
    code: [{ proto: "tcp", dport: "5500" }],
  },
  Web: {
    name: "Web",
    desc: "WWW traffic (HTTP and HTTPS)",
    code: [
      { proto: "tcp", dport: "80" },
      { proto: "tcp", dport: "443" },
    ],
  },
  Webcache: {
    name: "Webcache",
    desc: "Web Cache/Proxy traffic (port 8080)",
    code: [{ proto: "tcp", dport: "8080" }],
  },
  Webmin: {
    name: "Webmin",
    desc: "Webmin traffic",
    code: [{ proto: "tcp", dport: "10000" }],
  },
  Whois: {
    name: "Whois",
    desc: "Whois (nicname, RFC 3912) traffic",
    code: [{ proto: "tcp", dport: "43" }],
  },
};

export const MACROS: string[] = Object.keys(MACRO_INFO);

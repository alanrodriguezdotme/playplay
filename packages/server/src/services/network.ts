import { networkInterfaces } from "node:os";

/**
 * Names (lowercased substrings) of virtual / tunnel adapters that commonly show
 * up alongside the real LAN adapter — especially on Windows laptops, where
 * Hyper-V, WSL, Docker, VirtualBox, VMware and VPN clients all add interfaces.
 * Their addresses are usually private (RFC 1918) but live on subnets the venue
 * phones can't reach, so they must rank below a genuine LAN address.
 */
const VIRTUAL_ADAPTER_HINTS = [
  "vethernet",
  "hyper-v",
  "wsl",
  "docker",
  "virtualbox",
  "vbox",
  "vmware",
  "vmnet",
  "hamachi",
  "zerotier",
  "tailscale",
  "tun",
  "tap",
  "loopback",
  "bluetooth",
];

function isPrivateIpv4(addr: string): boolean {
  // RFC 1918 ranges: 10/8, 172.16/12, 192.168/16.
  if (addr.startsWith("10.")) return true;
  if (addr.startsWith("192.168.")) return true;
  const m = /^172\.(\d+)\./.exec(addr);
  if (m) {
    const second = Number(m[1]);
    return second >= 16 && second <= 31;
  }
  return false;
}

function isLinkLocalIpv4(addr: string): boolean {
  // APIPA / link-local — never routable on the LAN.
  return addr.startsWith("169.254.");
}

function looksVirtual(name: string): boolean {
  const lower = name.toLowerCase();
  return VIRTUAL_ADAPTER_HINTS.some((hint) => lower.includes(hint));
}

/**
 * Best-effort detection of the host's LAN IPv4 address — the one a patron's
 * phone on the same Wi-Fi can actually reach. Plain "first non-internal IPv4"
 * is wrong on multi-homed machines (notably Windows laptops), where a virtual
 * or VPN adapter often sorts ahead of the real Wi-Fi/Ethernet adapter.
 *
 * Candidates are scored so a private address on a physical-looking adapter wins
 * over private-but-virtual adapters, which in turn beat anything else. When no
 * good candidate exists we fall back to the first non-internal IPv4 (old
 * behavior) rather than returning null. For full control the admin can set the
 * `lanAddressOverride` venue setting, which bypasses this entirely.
 */
export function getLocalIp(): string | null {
  const nets = networkInterfaces();
  let best: { score: number; address: string } | null = null;

  for (const [name, entries] of Object.entries(nets)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      if (isLinkLocalIpv4(entry.address)) continue;

      const priv = isPrivateIpv4(entry.address);
      const virtual = looksVirtual(name);
      // Real LAN (private, physical) is best; virtual private next; then any
      // routable address (e.g. a public IP) as a last resort.
      let score: number;
      if (priv && !virtual) score = 3;
      else if (priv && virtual) score = 2;
      else if (!virtual) score = 1;
      else score = 0;

      if (!best || score > best.score) {
        best = { score, address: entry.address };
      }
    }
  }

  return best?.address ?? null;
}

#!/usr/bin/env bash
# OpenResolve — full setup wizard
# Installs Docker if needed, optionally configures networking, then builds and starts the app.
# Usage: sudo ./setup.sh
set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
R='\033[0;31m' G='\033[0;32m' Y='\033[1;33m' B='\033[0;34m' C='\033[0;36m'
BOLD='\033[1m' RST='\033[0m'

step()   { echo -e "\n${BOLD}${B}── $* ──${RST}"; }
ok()     { echo -e "  ${G}✓${RST}  $*"; }
info()   { echo -e "  ${C}→${RST}  $*"; }
warn()   { echo -e "  ${Y}⚠${RST}  $*"; }
err()    { echo -e "  ${R}✗${RST}  $*" >&2; }
ask()    { echo -en "  ${BOLD}?${RST}  $* "; }

# ── Banner ────────────────────────────────────────────────────────────────────
clear
echo -e "${B}${BOLD}"
cat <<'BANNER'
  ╔═══════════════════════════════════════════════════╗
  ║             OpenResolve  Setup                    ║
  ║       Self-hosted case management platform        ║
  ╚═══════════════════════════════════════════════════╝
BANNER
echo -e "${RST}"

# ── Root / sudo ───────────────────────────────────────────────────────────────
SUDO=""
if [[ $EUID -ne 0 ]]; then
  if command -v sudo &>/dev/null; then
    SUDO="sudo"
    warn "Not root — will use sudo for system operations."
  else
    warn "Not root and sudo not available. Some steps may fail."
    SUDO=""
  fi
fi
RUN() { $SUDO "$@"; }

# ── OS detection ──────────────────────────────────────────────────────────────
OS_ID="unknown"
OS_LIKE=""
OS_CODENAME=""

if [[ -f /etc/os-release ]]; then
  source /etc/os-release
  OS_ID="${ID:-unknown}"
  OS_LIKE="${ID_LIKE:-}"
  OS_CODENAME="${VERSION_CODENAME:-${UBUNTU_CODENAME:-}}"
elif [[ -f /etc/alpine-release ]]; then
  OS_ID="alpine"
fi

is_debian() { [[ "$OS_ID" =~ ^(debian|ubuntu|raspbian|linuxmint|pop)$ ]] || [[ "$OS_LIKE" =~ debian ]]; }
is_rhel()   { [[ "$OS_ID" =~ ^(rhel|centos|fedora|rocky|almalinux|ol)$ ]] || [[ "$OS_LIKE" =~ (rhel|fedora) ]]; }
is_alpine() { [[ "$OS_ID" == "alpine" ]]; }

info "Detected OS: ${OS_ID}${OS_CODENAME:+ (${OS_CODENAME})}${OS_LIKE:+, like: ${OS_LIKE}}"


# ╔══════════════════════════════════════════════════════════════════════════════
# ║  STEP 1 — Docker & Dependencies
# ╚══════════════════════════════════════════════════════════════════════════════
step "Step 1 — Docker & Dependencies"

COMPOSE_CMD=""

# ── Docker Engine ─────────────────────────────────────────────────────────────
if command -v docker &>/dev/null; then
  DOCKER_VER=$(docker --version | grep -oP '\d+\.\d+' | head -1)
  ok "Docker ${DOCKER_VER} already installed"
else
  info "Docker not found — installing..."

  if is_debian; then
    RUN apt-get update -qq
    RUN apt-get install -y -qq ca-certificates curl gnupg lsb-release

    RUN install -m 0755 -d /etc/apt/keyrings
    curl -fsSL "https://download.docker.com/linux/${OS_ID}/gpg" \
      | RUN gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
    RUN chmod a+r /etc/apt/keyrings/docker.gpg

    # Resolve codename — handle Ubuntu derivatives that don't set VERSION_CODENAME
    if [[ -z "$OS_CODENAME" ]]; then
      OS_CODENAME=$(lsb_release -cs 2>/dev/null || echo "")
    fi
    if [[ -z "$OS_CODENAME" ]]; then
      err "Cannot determine OS codename. Set VERSION_CODENAME in /etc/os-release and retry."
      exit 1
    fi

    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/${OS_ID} ${OS_CODENAME} stable" \
      | RUN tee /etc/apt/sources.list.d/docker.list >/dev/null

    RUN apt-get update -qq
    RUN apt-get install -y -qq \
      docker-ce docker-ce-cli containerd.io \
      docker-buildx-plugin docker-compose-plugin

  elif is_rhel; then
    if command -v dnf &>/dev/null; then
      RUN dnf -y install dnf-plugins-core
      RUN dnf config-manager --add-repo \
        https://download.docker.com/linux/centos/docker-ce.repo
      RUN dnf -y install \
        docker-ce docker-ce-cli containerd.io \
        docker-buildx-plugin docker-compose-plugin
    else
      RUN yum install -y yum-utils
      RUN yum-config-manager --add-repo \
        https://download.docker.com/linux/centos/docker-ce.repo
      RUN yum install -y \
        docker-ce docker-ce-cli containerd.io \
        docker-buildx-plugin docker-compose-plugin
    fi

  elif is_alpine; then
    RUN apk add --no-cache docker docker-cli-compose
    RUN rc-update add docker boot 2>/dev/null || true
    RUN service docker start 2>/dev/null || true

  else
    warn "Unrecognised distro — using Docker's official convenience script"
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    RUN sh /tmp/get-docker.sh
    rm -f /tmp/get-docker.sh
  fi

  # Enable & start on systemd systems
  if command -v systemctl &>/dev/null && ! is_alpine; then
    RUN systemctl enable docker 2>/dev/null || true
    RUN systemctl start  docker 2>/dev/null || true
  fi

  ok "Docker installed"
fi

# Add non-root user to docker group so they can run compose without sudo
if [[ $EUID -ne 0 ]] && ! groups 2>/dev/null | grep -qw docker; then
  RUN usermod -aG docker "$USER" 2>/dev/null || true
  warn "Added $USER to the docker group — you may need to log out/in, or run: newgrp docker"
fi

# ── Docker Compose ────────────────────────────────────────────────────────────
if docker compose version &>/dev/null 2>&1; then
  ok "docker compose v2 plugin available"
  COMPOSE_CMD="docker compose"
elif command -v docker-compose &>/dev/null; then
  V1_VER=$(docker-compose --version | grep -oP '\d+\.\d+' | head -1)
  ok "docker-compose ${V1_VER} found (v1 — works fine, v2 plugin preferred)"
  COMPOSE_CMD="docker-compose"
else
  info "Installing docker compose plugin..."
  if is_debian; then
    RUN apt-get install -y -qq docker-compose-plugin
  elif is_rhel; then
    RUN dnf install -y docker-compose-plugin 2>/dev/null \
      || RUN yum install -y docker-compose-plugin 2>/dev/null || true
  fi

  if docker compose version &>/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
    ok "docker compose plugin installed"
  else
    err "Could not install docker compose. Install manually:"
    err "  https://docs.docker.com/compose/install/"
    exit 1
  fi
fi

# ── Other tools ───────────────────────────────────────────────────────────────
for tool in curl openssl; do
  if ! command -v $tool &>/dev/null; then
    info "Installing $tool..."
    if is_debian;  then RUN apt-get install -y -qq $tool
    elif is_rhel;  then RUN dnf install -y $tool 2>/dev/null || RUN yum install -y $tool
    elif is_alpine; then RUN apk add --no-cache $tool
    fi
    ok "$tool installed"
  fi
done


# ╔══════════════════════════════════════════════════════════════════════════════
# ║  STEP 2 — Network
# ╚══════════════════════════════════════════════════════════════════════════════
step "Step 2 — Network"

# ── Scan active interfaces ────────────────────────────────────────────────────
IFACE_NAMES=()
IFACE_IPS=()

if command -v ip &>/dev/null; then
  while IFS= read -r line; do
    iface=$(echo "$line" | awk -F': ' '{print $2}' | cut -d'@' -f1)
    [[ "$iface" == "lo" || -z "$iface" ]] && continue
    ip_addr=$(ip -4 addr show "$iface" 2>/dev/null \
      | grep -oP '(?<=inet )\d+\.\d+\.\d+\.\d+' | head -1)
    if [[ -n "$ip_addr" ]]; then
      IFACE_NAMES+=("$iface")
      IFACE_IPS+=("$ip_addr")
    fi
  done < <(ip -o link show 2>/dev/null || true)
fi

echo ""
if [[ ${#IFACE_NAMES[@]} -eq 0 ]]; then
  warn "No active network interfaces detected."
  warn "The app will start but may only be reachable from localhost."
  PRIMARY_IP="localhost"
else
  info "Active interfaces:"
  for i in "${!IFACE_NAMES[@]}"; do
    printf "     ${BOLD}%-14s${RST} %s\n" "${IFACE_NAMES[$i]}" "${IFACE_IPS[$i]}"
  done
  PRIMARY_IP="${IFACE_IPS[0]}"
fi

# ── Offer network configuration ───────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}Network configuration${RST} (optional — skip if already set up)"
echo "  Useful for: setting a static IP, configuring a VLAN, or switching to DHCP."
echo ""
ask "Configure network settings? [y/N]:"
read -r DO_NET
DO_NET="${DO_NET:-N}"

# Initialise these so they're always in scope for the URL banner
SEL_IFACE=""
ACTIVE_IFACE=""
VLAN_ID=""
STATIC_IP=""

if [[ "${DO_NET,,}" == "y" ]]; then

  # ── Select interface ────────────────────────────────────────────────────────
  echo ""
  if [[ ${#IFACE_NAMES[@]} -eq 0 ]]; then
    ask "Interface name (e.g. eth0):"
    read -r SEL_IFACE
  elif [[ ${#IFACE_NAMES[@]} -eq 1 ]]; then
    SEL_IFACE="${IFACE_NAMES[0]}"
    info "Using interface: ${SEL_IFACE}"
  else
    for i in "${!IFACE_NAMES[@]}"; do
      echo "     [$((i+1))]  ${IFACE_NAMES[$i]}  —  ${IFACE_IPS[$i]}"
    done
    ask "Select interface [1]:"
    read -r CHOICE
    CHOICE="${CHOICE:-1}"
    SEL_IFACE="${IFACE_NAMES[$((CHOICE-1))]}"
  fi
  ACTIVE_IFACE="$SEL_IFACE"

  # ── VLAN tagging ────────────────────────────────────────────────────────────
  echo ""
  ask "Does this interface use VLAN tagging (802.1Q)? [y/N]:"
  read -r DO_VLAN
  DO_VLAN="${DO_VLAN:-N}"

  if [[ "${DO_VLAN,,}" == "y" ]]; then
    ask "VLAN ID (e.g. 10, 100, 200):"
    read -r VLAN_ID
    ACTIVE_IFACE="${SEL_IFACE}.${VLAN_ID}"
    info "Will configure VLAN interface: ${ACTIVE_IFACE}"
  fi

  # ── IP assignment ───────────────────────────────────────────────────────────
  echo ""
  echo "  IP assignment:"
  echo "     [1] DHCP    — obtain address automatically from router/DHCP server"
  echo "     [2] Static  — fixed IP address"
  ask "Choice [1]:"
  read -r IP_MODE
  IP_MODE="${IP_MODE:-1}"

  STATIC_PREFIX="24"
  STATIC_GW=""
  STATIC_DNS="1.1.1.1,8.8.8.8"

  if [[ "$IP_MODE" == "2" ]]; then
    echo ""
    ask "IP address         (e.g. 192.168.1.100):"
    read -r STATIC_IP
    ask "Prefix length      [24]  (/24 = 255.255.255.0):"
    read -r inp; STATIC_PREFIX="${inp:-24}"
    ask "Default gateway    (e.g. 192.168.1.1):"
    read -r STATIC_GW
    ask "DNS servers        [1.1.1.1,8.8.8.8]:"
    read -r inp; STATIC_DNS="${inp:-1.1.1.1,8.8.8.8}"
    PRIMARY_IP="$STATIC_IP"
  fi

  # ── SSH / console warning ───────────────────────────────────────────────────
  echo ""
  warn "About to apply network changes to ${ACTIVE_IFACE}."
  warn "If you are connected over SSH you may briefly lose access."
  warn "Use the Proxmox web console to reconnect if needed."
  echo ""
  ask "Apply now? [y/N]:"
  read -r APPLY
  APPLY="${APPLY:-N}"

  if [[ "${APPLY,,}" == "y" ]]; then

    NET_DONE=false
    DNS_INLINE="[$(echo "$STATIC_DNS" | tr ',' ', ')]"

    # ── Netplan ───────────────────────────────────────────────────────────────
    if command -v netplan &>/dev/null; then
      info "Writing Netplan configuration..."
      CFG="/etc/netplan/60-openresolve.yaml"

      if   [[ "${DO_VLAN,,}" == "y" && "$IP_MODE" == "2" ]]; then
        RUN tee "$CFG" >/dev/null <<YAML
network:
  version: 2
  ethernets:
    ${SEL_IFACE}:
      dhcp4: false
  vlans:
    ${ACTIVE_IFACE}:
      id: ${VLAN_ID}
      link: ${SEL_IFACE}
      dhcp4: false
      addresses: [${STATIC_IP}/${STATIC_PREFIX}]
      routes:
        - to: default
          via: ${STATIC_GW}
      nameservers:
        addresses: ${DNS_INLINE}
YAML
      elif [[ "${DO_VLAN,,}" == "y" ]]; then
        RUN tee "$CFG" >/dev/null <<YAML
network:
  version: 2
  ethernets:
    ${SEL_IFACE}:
      dhcp4: false
  vlans:
    ${ACTIVE_IFACE}:
      id: ${VLAN_ID}
      link: ${SEL_IFACE}
      dhcp4: true
YAML
      elif [[ "$IP_MODE" == "2" ]]; then
        RUN tee "$CFG" >/dev/null <<YAML
network:
  version: 2
  ethernets:
    ${SEL_IFACE}:
      dhcp4: false
      addresses: [${STATIC_IP}/${STATIC_PREFIX}]
      routes:
        - to: default
          via: ${STATIC_GW}
      nameservers:
        addresses: ${DNS_INLINE}
YAML
      else
        RUN tee "$CFG" >/dev/null <<YAML
network:
  version: 2
  ethernets:
    ${SEL_IFACE}:
      dhcp4: true
YAML
      fi

      RUN chmod 600 "$CFG"
      RUN netplan apply
      NET_DONE=true
      ok "Netplan config written → ${CFG}"

    # ── /etc/network/interfaces (Debian classic) ──────────────────────────────
    elif [[ -f /etc/network/interfaces ]]; then
      info "Writing /etc/network/interfaces config..."

      if [[ "${DO_VLAN,,}" == "y" ]]; then
        RUN apt-get install -y -qq vlan 2>/dev/null || true
        RUN modprobe 8021q 2>/dev/null || true
        # Persist module on boot
        grep -q 8021q /etc/modules 2>/dev/null \
          || echo "8021q" | RUN tee -a /etc/modules >/dev/null
      fi

      IFACE_CFG="/etc/network/interfaces.d/openresolve"

      if   [[ "${DO_VLAN,,}" == "y" && "$IP_MODE" == "2" ]]; then
        RUN tee "$IFACE_CFG" >/dev/null <<IFACE
auto ${SEL_IFACE}
iface ${SEL_IFACE} inet manual

auto ${ACTIVE_IFACE}
iface ${ACTIVE_IFACE} inet static
  address ${STATIC_IP}/${STATIC_PREFIX}
  gateway ${STATIC_GW}
  dns-nameservers $(echo "$STATIC_DNS" | tr ',' ' ')
  vlan-raw-device ${SEL_IFACE}
IFACE
      elif [[ "${DO_VLAN,,}" == "y" ]]; then
        RUN tee "$IFACE_CFG" >/dev/null <<IFACE
auto ${SEL_IFACE}
iface ${SEL_IFACE} inet manual

auto ${ACTIVE_IFACE}
iface ${ACTIVE_IFACE} inet dhcp
  vlan-raw-device ${SEL_IFACE}
IFACE
      elif [[ "$IP_MODE" == "2" ]]; then
        RUN tee "$IFACE_CFG" >/dev/null <<IFACE
auto ${SEL_IFACE}
iface ${SEL_IFACE} inet static
  address ${STATIC_IP}/${STATIC_PREFIX}
  gateway ${STATIC_GW}
  dns-nameservers $(echo "$STATIC_DNS" | tr ',' ' ')
IFACE
      else
        RUN tee "$IFACE_CFG" >/dev/null <<IFACE
auto ${SEL_IFACE}
iface ${SEL_IFACE} inet dhcp
IFACE
      fi

      RUN ifdown "${ACTIVE_IFACE}" 2>/dev/null || RUN ifdown "${SEL_IFACE}" 2>/dev/null || true
      RUN ifup   "${ACTIVE_IFACE}" 2>/dev/null || RUN ifup   "${SEL_IFACE}" 2>/dev/null || true
      NET_DONE=true
      ok "Interfaces config written → ${IFACE_CFG}"

    # ── NetworkManager (nmcli) ────────────────────────────────────────────────
    elif command -v nmcli &>/dev/null; then
      info "Applying via NetworkManager..."
      CON="openresolve"
      nmcli con delete "$CON" 2>/dev/null || true

      if [[ "${DO_VLAN,,}" == "y" ]]; then
        RUN nmcli con add type vlan con-name "$CON" \
          dev "$SEL_IFACE" id "$VLAN_ID"
      else
        RUN nmcli con add type ethernet con-name "$CON" ifname "$SEL_IFACE"
      fi

      if [[ "$IP_MODE" == "2" ]]; then
        RUN nmcli con mod "$CON" \
          ipv4.method manual \
          ipv4.addresses "${STATIC_IP}/${STATIC_PREFIX}" \
          ipv4.gateway   "$STATIC_GW" \
          ipv4.dns       "$(echo "$STATIC_DNS" | tr ',' ' ')"
      else
        RUN nmcli con mod "$CON" ipv4.method auto
      fi

      RUN nmcli con up "$CON"
      NET_DONE=true
      ok "NetworkManager connection applied"

    else
      warn "Could not detect network manager (netplan / interfaces / nmcli)."
      warn "Configure networking manually and re-run setup."
    fi

    # ── Resolve DHCP-assigned IP after apply ──────────────────────────────────
    if [[ "$NET_DONE" == true && "$IP_MODE" == "1" ]]; then
      info "Waiting for DHCP lease on ${ACTIVE_IFACE}..."
      sleep 5
      DHCP_IP=$(ip -4 addr show "$ACTIVE_IFACE" 2>/dev/null \
        | grep -oP '(?<=inet )\d+\.\d+\.\d+\.\d+' | head -1 || echo "")
      if [[ -n "$DHCP_IP" ]]; then
        PRIMARY_IP="$DHCP_IP"
        ok "DHCP lease obtained: ${PRIMARY_IP}"
      else
        warn "Could not read IP — check with: ip addr show ${ACTIVE_IFACE}"
      fi
    fi

  else
    info "Network changes not applied."
  fi
fi


# ╔══════════════════════════════════════════════════════════════════════════════
# ║  STEP 3 — OpenResolve configuration
# ╚══════════════════════════════════════════════════════════════════════════════
step "Step 3 — OpenResolve Configuration"

ENV_FILE=".env"

if [[ -f "$ENV_FILE" ]]; then
  ok "Existing .env found — reusing settings."
  source "$ENV_FILE" 2>/dev/null || true
  HOST_PORT="${HOST_PORT:-3000}"
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-openresolve}"
else
  echo ""
  ask "Port to expose on this host [3000]:"
  read -r HOST_PORT
  HOST_PORT="${HOST_PORT:-3000}"

  ask "Admin password [openresolve]:"
  read -rs ADMIN_PASSWORD
  echo ""
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-openresolve}"

  info "Generating JWT secret..."
  JWT_SECRET=$(openssl rand -hex 32 2>/dev/null \
    || od -vN32 -An -tx1 /dev/urandom | tr -d ' \n')

  cat > "$ENV_FILE" <<EOF
# OpenResolve — generated by setup.sh on $(date)
# Do not commit this file to version control.
HOST_PORT=${HOST_PORT}
JWT_SECRET=${JWT_SECRET}
ADMIN_USERNAME=admin
ADMIN_PASSWORD=${ADMIN_PASSWORD}
EOF
  ok ".env written"
fi


# ╔══════════════════════════════════════════════════════════════════════════════
# ║  STEP 4 — Build & Start
# ╚══════════════════════════════════════════════════════════════════════════════
step "Step 4 — Build & Start"
echo ""
info "Building images (first run takes a few minutes)..."
$COMPOSE_CMD build

info "Starting services..."
$COMPOSE_CMD up -d

# Wait for backend healthcheck
info "Waiting for backend to be healthy..."
MAX=90; ELAPSED=0
until docker inspect openresolve-backend \
    --format='{{.State.Health.Status}}' 2>/dev/null | grep -q "healthy"; do
  sleep 2; ELAPSED=$((ELAPSED+2))
  if [[ $ELAPSED -ge $MAX ]]; then
    warn "Backend is taking longer than expected."
    warn "Check with: ${COMPOSE_CMD} logs backend"
    break
  fi
done


# ── Compile list of accessible URLs ───────────────────────────────────────────
ACCESS_URLS=()
ACCESS_URLS+=("http://localhost:${HOST_PORT}")

for ip in "${IFACE_IPS[@]+"${IFACE_IPS[@]}"}"; do
  [[ "$ip" == "127.0.0.1" ]] && continue
  ACCESS_URLS+=("http://${ip}:${HOST_PORT}")
done

# If a static IP was configured that differs from detected IPs, add it too
if [[ -n "$STATIC_IP" ]]; then
  ALREADY=false
  for u in "${ACCESS_URLS[@]}"; do
    [[ "$u" == *"$STATIC_IP"* ]] && ALREADY=true
  done
  [[ "$ALREADY" == false ]] && ACCESS_URLS+=("http://${STATIC_IP}:${HOST_PORT}")
fi


# ╔══════════════════════════════════════════════════════════════════════════════
# ║  Done
# ╚══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${G}${BOLD}"
echo '  ╔══════════════════════════════════════════════════════════════╗'
echo '  ║                OpenResolve is running!                      ║'
echo '  ╠══════════════════════════════════════════════════════════════╣'
echo '  ║                                                              ║'
echo '  ║  Access the app at:                                          ║'
for url in "${ACCESS_URLS[@]}"; do
  printf "  ║    %-58s║\n" "$url"
done
echo '  ║                                                              ║'
printf "  ║  Username: %-50s║\n" "admin"
printf "  ║  Password: %-50s║\n" "${ADMIN_PASSWORD}"
echo '  ║                                                              ║'
echo '  ║  Useful commands:                                            ║'
printf "  ║    %-58s║\n" "${COMPOSE_CMD} logs -f        (live logs)"
printf "  ║    %-58s║\n" "${COMPOSE_CMD} down           (stop)"
printf "  ║    %-58s║\n" "./backup.sh                  (backup data)"
echo '  ║                                                              ║'
echo '  ╚══════════════════════════════════════════════════════════════╝'
echo -e "${RST}"

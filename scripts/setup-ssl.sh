#!/bin/bash
# =============================================================================
# MASSAJ CRM — Nginx Reverse Proxy + Let's Encrypt SSL Setup Script
# Server: 104.248.29.65  |  Run as root or with sudo
# =============================================================================
set -euo pipefail

# ─── CONFIG ──────────────────────────────────────────────────────────────────
DOMAIN="${1:-}"          # e.g. api.massaj.uz  (pass as first argument)
EMAIL="${2:-}"           # e.g. admin@massaj.uz (pass as second argument)
APP_PORT="${3:-3000}"    # NestJS port (default 3000)

if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "Usage: sudo bash setup-ssl.sh <domain> <admin-email> [app-port]"
  echo "Example: sudo bash setup-ssl.sh api.massaj.uz admin@massaj.uz 3000"
  exit 1
fi

echo "=== [1/6] Installing Nginx & Certbot ==="
apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx

echo "=== [2/6] Writing initial Nginx HTTP config ==="
cat > /etc/nginx/sites-available/massaj <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    # Let's Encrypt ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all other traffic to HTTPS (after cert is issued)
    location / {
        return 301 https://\$host\$request_uri;
    }
}
EOF

ln -sf /etc/nginx/sites-available/massaj /etc/nginx/sites-enabled/massaj
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "=== [3/6] Obtaining Let's Encrypt certificate ==="
certbot --nginx \
  --non-interactive \
  --agree-tos \
  --email "${EMAIL}" \
  -d "${DOMAIN}"

echo "=== [4/6] Writing full HTTPS Nginx reverse proxy config ==="
cat > /etc/nginx/sites-available/massaj <<EOF
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

# HTTPS reverse proxy
server {
    listen 443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options    "nosniff" always;
    add_header X-Frame-Options           "SAMEORIGIN" always;
    add_header Referrer-Policy           "strict-origin-when-cross-origin" always;

    client_max_body_size 20M;
    keepalive_timeout    65;

    location / {
        proxy_pass         http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
EOF

nginx -t && systemctl reload nginx

echo "=== [5/6] Updating .env: COOKIE_SECURE=true ==="
ENV_FILE="/root/massaj-backend/.env"
if [[ -f "$ENV_FILE" ]]; then
  sed -i 's/^COOKIE_SECURE=.*/COOKIE_SECURE=true/' "$ENV_FILE"
  sed -i 's|^FRONTEND_URL=.*|FRONTEND_URL=https://massaj-frontent.vercel.app|' "$ENV_FILE"
  echo "  .env updated: COOKIE_SECURE=true"
else
  echo "  WARNING: $ENV_FILE not found. Set COOKIE_SECURE=true manually!"
fi

echo "=== [6/6] Testing Certbot auto-renewal ==="
certbot renew --dry-run

echo ""
echo "SSL setup complete!"
echo "   Domain : https://${DOMAIN}"
echo "   Renewal: certbot auto-renew is active via systemd timer"
echo ""
echo "NEXT STEPS:"
echo "  1. DNS: Point A-record for '${DOMAIN}' -> 104.248.29.65"
echo "  2. Frontend: Update API base URL to https://${DOMAIN}/api/v1"
echo "  3. Restart app: pm2 restart massaj-backend  (or systemctl restart massaj)"

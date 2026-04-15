#!/usr/bin/env bash
# Issue / renew SSL for QuizUp on nginx, then reload nginx.
#
# Prerequisites:
#   1. At your registrar (Namecheap), for domain quizup.site:
#        A Record  @   → 82.29.160.45
#        A Record  www → 82.29.160.45
#      Remove parking / conflicting www CNAMEs.
#   2. Wait until DNS works:  dig +short quizup.site A
#      should print 82.29.160.45 (from your PC or this server).
#
# Usage:
#   export CERTBOT_EMAIL="you@yourdomain.com"   # required by Let's Encrypt
#   sudo -E ./deploy/certbot-quizup-site.sh
#
set -euo pipefail

EMAIL="${CERTBOT_EMAIL:-}"
if [[ -z "$EMAIL" ]]; then
  echo "Set CERTBOT_EMAIL to a real address (Let's Encrypt account / expiry notices)."
  echo "Example:  export CERTBOT_EMAIL=admin@quizup.site && sudo -E ./deploy/certbot-quizup-site.sh"
  exit 1
fi

sudo certbot --nginx \
  -d www.quizup.site \
  -d quizup.site \
  --non-interactive \
  --agree-tos \
  -m "$EMAIL" \
  --redirect

echo "Certbot done. Update backend/.env to HTTPS, e.g.:"
echo "  CLIENT_URL=https://www.quizup.site"
echo "  FRONTEND_URL=https://www.quizup.site"
echo "  ALLOWED_ORIGINS=... include https://www.quizup.site,https://quizup.site,..."
echo "Then:  pm2 restart quizup --update-env"

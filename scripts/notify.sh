#!/bin/bash
# Local notification evaluator — hits the cron endpoint every 15 minutes via launchd.
# Falls back gracefully if the server is unreachable.

CRON_SECRET=$(grep CRON_SECRET /Users/Jen/life-os/dashboard/.env.local | head -1 | cut -d= -f2)
ENDPOINT="https://life-os-zeta-brown.vercel.app/api/cron/notifications"

curl -sf -H "x-cron-secret: $CRON_SECRET" "$ENDPOINT" > /dev/null 2>&1

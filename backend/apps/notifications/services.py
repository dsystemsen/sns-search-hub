"""Webhook-based notifications to Slack and Discord.

Both services accept an incoming-webhook URL with a JSON payload. The two
formats are subtly different — Slack expects ``{"text": "..."}`` while Discord
expects ``{"content": "..."}`` — and we send each in its native format.

Failures are swallowed and logged: a flaky webhook should never crash the
business action that triggered it.
"""

from __future__ import annotations

import logging

import requests

logger = logging.getLogger(__name__)


def _post(url: str, payload: dict) -> bool:
    try:
        resp = requests.post(url, json=payload, timeout=5)
        if resp.status_code >= 300:
            logger.warning("Webhook returned %s: %s", resp.status_code, resp.text[:200])
            return False
        return True
    except requests.RequestException as exc:
        logger.warning("Webhook delivery failed: %s", exc)
        return False


def send_slack(webhook_url: str, text: str) -> bool:
    if not webhook_url:
        return False
    return _post(webhook_url, {"text": text})


def send_discord(webhook_url: str, text: str) -> bool:
    if not webhook_url:
        return False
    return _post(webhook_url, {"content": text})


def notify_tenant(tenant, text: str) -> dict:
    """Send the same text to whichever webhooks the tenant has configured."""
    results = {"slack": False, "discord": False}
    if tenant.slack_webhook_url:
        results["slack"] = send_slack(tenant.slack_webhook_url, text)
    if tenant.discord_webhook_url:
        results["discord"] = send_discord(tenant.discord_webhook_url, text)
    return results

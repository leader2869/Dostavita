# Dostavita Telegram Mini App

Launch URL: https://www.dostavita.by/telegram

## Bot setup

1. The account owner creates a bot in the verified @BotFather via /newbot.
2. In /mybots → the bot → Bot Settings → Configure Mini App, enable the main mini app and set the launch URL above.
3. Set the menu button via /setmenubutton: label «Открыть Dostavita», URL above.
4. Set the bot description and icon from Dostavita assets. Do not send the token in chat or commit it.

This initial version needs no bot token on the application server: it uses the existing Dostavita password login and database session. Telegram SDK data is never trusted for authentication or role assignment. No Telegram identity is linked yet. Roles, organization membership and balances remain in the existing system.

The SDK loads only in Telegram launch context and subsequent same-tab navigation. Native Telegram expands the window without requesting fullscreen. Web framing is restricted by CSP to same-origin and official Telegram Web origins. Verify reverse proxies do not add a conflicting X-Frame-Options header.

## Acceptance checks before public launch

- iOS and Android: open bot menu, see entry page, sign in, correct role dashboard, reload and sign out.
- Telegram Web: frame loads; check session persistence under browser third-party-cookie restrictions. Native clients are preferred if the browser blocks cookies.
- Company: order board and assignment; driver: active orders and finance; client: order creation.
- Denied geolocation and minimized app: do not promise background tracking.
- Non-Telegram browser: existing login, dashboard and notifications continue working.

## Follow-up integration

Automatic Telegram login requires a separate verified-account linking flow, server-side initData signature/freshness checks, replay defenses, account unlinking and a bot token stored only on the server. No account may be linked by matching a Telegram username or phone number alone. Bot notifications require an opt-in and server-side delivery handling; they are not part of this initial shell.

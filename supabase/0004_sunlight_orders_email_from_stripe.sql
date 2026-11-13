-- 0004: one-step Download & Print checkout.
--
-- The buy button now goes straight to Stripe Checkout. We no longer ask for a
-- name and email first; Stripe collects the email (always) and the cardholder
-- name (card payments), and fulfilSession() copies both onto the order when
-- payment succeeds. So a *pending* order has no name/email yet.
--
-- Safe to run before or after the deploy: the old code always fills both
-- columns, so relaxing NOT NULL changes nothing for it.

alter table sk_orders alter column name  drop not null;
alter table sk_orders alter column email drop not null;

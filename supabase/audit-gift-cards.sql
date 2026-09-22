-- ============================================================
-- Gift cards - consistency check
-- ============================================================
-- Read-only. Run in the Supabase SQL Editor after rls-lockdown.sql.
-- Each query stands alone: if one fails on a column this table does
-- not have, skip it and run the next.
--
-- Legitimately, a card's balance only ever goes down, and every change
-- has a matching gift_card_transactions row. Anything below that is not
-- empty deserves a look.
-- ============================================================

-- 0. The columns this table actually has (the queries below assume the
--    usual ones: initial_balance, current_balance, created_at, updated_at).
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'gift_cards'
ORDER BY ordinal_position;

-- 1. Totals: how many cards, how much is outstanding.
SELECT count(*) AS cards,
       sum(current_balance) AS outstanding,
       sum(initial_balance) AS issued
FROM gift_cards;

-- 2. Balance higher than the card was issued for: never legitimate.
SELECT id, initial_balance, current_balance, created_at, updated_at
FROM gift_cards
WHERE current_balance > initial_balance;

-- 3. Cards changed after they were created (any update at all), newest first.
--    Compare against what the register actually redeemed.
SELECT id, initial_balance, current_balance, created_at, updated_at
FROM gift_cards
WHERE updated_at > created_at + interval '1 minute'
ORDER BY updated_at DESC
LIMIT 100;

-- 4. Cards created recently: anything the store did not sell is suspect.
SELECT id, initial_balance, current_balance, created_at
FROM gift_cards
WHERE created_at > now() - interval '120 days'
ORDER BY created_at DESC;

-- 5. Balance that the transaction log does not account for:
--    issued amount minus redemptions should equal the current balance.
SELECT g.id, g.initial_balance, g.current_balance,
       g.initial_balance - COALESCE(sum(t.amount) FILTER (WHERE t.type <> 'purchase'), 0) AS expected_balance
FROM gift_cards g
LEFT JOIN gift_card_transactions t ON t.gift_card_id = g.id
GROUP BY g.id, g.initial_balance, g.current_balance
HAVING g.current_balance <> g.initial_balance - COALESCE(sum(t.amount) FILTER (WHERE t.type <> 'purchase'), 0)
ORDER BY g.current_balance DESC;

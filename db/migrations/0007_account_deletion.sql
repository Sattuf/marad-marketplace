-- Account deletion (docs/EXECUTION_PLAN.md L-D5, L1.3).
-- users.deleted_at: set when the owner asks to delete the account; the account is closed
-- at once and permanently scrubbed 30 days later (signing in before that restores it).
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;
CREATE INDEX idx_users_deleted_at ON users (deleted_at) WHERE deleted_at IS NOT NULL;

-- listings.owner_hidden_at: listings of an account pending deletion are hidden from every
-- public query and from search, without touching their own status (restorable as they were).
ALTER TABLE listings ADD COLUMN owner_hidden_at TIMESTAMPTZ;
CREATE INDEX idx_listings_owner_hidden ON listings (user_id) WHERE owner_hidden_at IS NOT NULL;

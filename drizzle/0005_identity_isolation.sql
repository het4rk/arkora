-- Identity Mode Isolation: add authorNullifier + postIdentityMode to posts and replies
-- authorNullifier stores the real (internal) nullifier for rate limiting, moderation, and ownership.
-- nullifierHash becomes the derived public identifier (anon/alias/named).

-- Posts: add new columns
ALTER TABLE posts ADD COLUMN IF NOT EXISTS author_nullifier text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_identity_mode text NOT NULL DEFAULT 'anonymous';

-- Replies: add new columns
ALTER TABLE replies ADD COLUMN IF NOT EXISTS author_nullifier text;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS post_identity_mode text NOT NULL DEFAULT 'anonymous';

-- Backfill: set authorNullifier = nullifierHash for all existing rows (pre-migration data)
UPDATE posts SET author_nullifier = nullifier_hash WHERE author_nullifier IS NULL;
UPDATE replies SET author_nullifier = nullifier_hash WHERE author_nullifier IS NULL;

-- Backfill postIdentityMode: posts without pseudoHandle are anonymous, others are alias
UPDATE posts SET post_identity_mode = 'anonymous' WHERE pseudo_handle IS NULL;
UPDATE posts SET post_identity_mode = 'alias' WHERE pseudo_handle IS NOT NULL;
UPDATE replies SET post_identity_mode = 'anonymous' WHERE pseudo_handle IS NULL;
UPDATE replies SET post_identity_mode = 'alias' WHERE pseudo_handle IS NOT NULL;

-- Indexes for internal identity lookups
CREATE INDEX IF NOT EXISTS posts_author_nullifier_idx ON posts(author_nullifier);
CREATE INDEX IF NOT EXISTS replies_author_nullifier_idx ON replies(author_nullifier);

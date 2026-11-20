CREATE TABLE classes (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at AND expires_at - created_at <= 86400)
);
--> statement-breakpoint
CREATE TABLE invites (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at AND expires_at - created_at <= 7200),
  revoked_at INTEGER
);
--> statement-breakpoint
CREATE INDEX invites_class ON invites(class_id, expires_at);
--> statement-breakpoint
CREATE TABLE memberships (
  id TEXT PRIMARY KEY NOT NULL,
  invite_id TEXT NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at AND expires_at - created_at <= 7200)
);
--> statement-breakpoint
CREATE INDEX memberships_invite ON memberships(invite_id, expires_at);
--> statement-breakpoint
CREATE TABLE drawings (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  membership_id TEXT NOT NULL,
  label TEXT NOT NULL CHECK (label IN ('Sun and hills', 'Kite in the breeze', 'Moon and stars')),
  state TEXT NOT NULL CHECK (state IN ('writing', 'approved', 'reported', 'removed')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at AND expires_at - created_at <= 86400)
);
--> statement-breakpoint
CREATE INDEX drawings_class ON drawings(class_id, state, expires_at);
--> statement-breakpoint
CREATE INDEX drawings_expiry ON drawings(state, expires_at);

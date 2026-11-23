CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));

CREATE TYPE document_role AS ENUM ('OWNER', 'EDITOR', 'VIEWER');
CREATE TYPE link_access   AS ENUM ('NONE', 'VIEWER', 'EDITOR');

CREATE TABLE documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(255) NOT NULL DEFAULT 'Untitled document',
  content_state BYTEA,
  owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  link_access   link_access NOT NULL DEFAULT 'NONE',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document_members (
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        document_role NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, user_id)
);
CREATE UNIQUE INDEX one_owner_per_document ON document_members (document_id) WHERE role = 'OWNER';
CREATE INDEX document_members_user_idx ON document_members (user_id);

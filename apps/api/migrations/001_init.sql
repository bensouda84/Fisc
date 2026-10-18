create table users (
  id          bigserial primary key,
  email       text not null unique,
  display     text not null,
  role        text not null check (role in ('consultant', 'client', 'validator', 'admin')),
  specialty   text check (specialty in ('LEGAL', 'ACCOUNTING')),
  pass_hash   text not null,
  created_at  timestamptz not null default now(),
  check (role <> 'validator' or specialty is not null)
);

create table rule_version (
  id          text not null,
  version     integer not null,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  primary key (id, version)
);

create table registry_snapshot (
  version       text primary key,
  published_at  timestamptz not null,
  hash          text not null,
  data          jsonb not null
);

create table audit_log (
  seq        bigint primary key,
  at         timestamptz not null,
  actor      text not null,
  action     text not null,
  target     text not null,
  detail     jsonb not null,
  prev_hash  text,
  hash       text not null
);

-- Journal en lecture seule : aucune modification ni suppression, même pour le rôle applicatif.
create function audit_log_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'audit_log est en ajout seul';
end $$;
create trigger audit_log_no_update before update or delete on audit_log
  for each row execute function audit_log_immutable();
create trigger audit_log_no_truncate before truncate on audit_log
  for each statement execute function audit_log_immutable();

create table diagnostic (
  user_id     bigint primary key references users(id) on delete cascade,
  answers     jsonb not null,
  updated_at  timestamptz not null default now()
);

create table calculation (
  id               bigserial primary key,
  user_id          bigint not null references users(id) on delete cascade,
  mode             text not null check (mode in ('INTERNAL', 'CLIENT')),
  registry_version text not null,
  as_of            date not null,
  input            jsonb not null,
  commercial       jsonb not null,
  result           jsonb not null,
  created_at       timestamptz not null default now()
);

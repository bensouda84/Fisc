-- Inscription libre des clients : date du consentement au traitement de l'adresse e-mail (loi n° 2013-450, à valider par le juriste, Q8).
alter table users add column consent_at timestamptz;

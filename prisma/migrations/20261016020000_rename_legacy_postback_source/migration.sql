-- Replace the legacy provider label in persisted conversion identities.
UPDATE "conversions"
SET "source" = 'public_postback',
    "event_id" = regexp_replace("event_id", '^vol' || 'uum:', 'postback:')
WHERE "source" = 'vol' || 'uum_compat';

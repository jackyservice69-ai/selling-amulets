-- Raise existing limits of eight or fewer to twelve; keep other settings intact.
UPDATE `site_settings`
SET `value` = JSON_SET(`value`, '$.maxImages', 12)
WHERE COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(`value`, '$.maxImages')) AS UNSIGNED), 8) <= 8;

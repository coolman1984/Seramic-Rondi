-- ════════════════════════════════════════════════════════════════
-- حراسة البيانات على مستوى قاعدة البيانات نفسها (مش بس في البرنامج)
-- ١) مفيش مسح نهائي لأي سجل مهم.
-- ٢) سجل العمليات ميتعدلش وميتمسحش.
-- ٣) كل سطر في السجل مربوط باللي قبله ببصمة (hash chain) عشان أي تلاعب يبان.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION rondi_forbid_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'rondi: deleting rows from % is not allowed; deactivate instead', TG_TABLE_NAME
    USING ERRCODE = 'P0001';
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'roles','users','audit_log','product_models','sizes','product_variants',
    'shades','calibers','materials','production_lines','equipment','shifts'
  ] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION rondi_forbid_delete()',
                   t || '_no_delete', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION rondi_audit_forbid_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'rondi: audit_log is append-only' USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION rondi_audit_forbid_update();

-- البصمة: sha256 لمحتوى السطر + بصمة السطر اللي قبله.
-- القفل بيضمن إن السطور بتتسلسل واحد ورا التاني حتى لو في عمليات كتير في نفس اللحظة.
CREATE OR REPLACE FUNCTION rondi_audit_payload(r audit_log) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT concat_ws('|',
    r.id::text,
    (extract(epoch FROM r.at) * 1000000)::bigint::text,
    coalesce(r.actor_id::text, ''),
    coalesce(r.actor_name, ''),
    r.action,
    r.entity,
    coalesce(r.entity_id, ''),
    coalesce(r.before::text, ''),
    coalesce(r.after::text, ''),
    coalesce(r.ip, ''),
    r.prev_hash)
$$;

CREATE OR REPLACE FUNCTION rondi_audit_chain() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE prev text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('rondi_audit_chain'));
  NEW.id := nextval(pg_get_serial_sequence('audit_log', 'id'));
  NEW.at := clock_timestamp();
  SELECT hash INTO prev FROM audit_log ORDER BY id DESC LIMIT 1;
  NEW.prev_hash := coalesce(prev, repeat('0', 64));
  NEW.hash := encode(sha256(convert_to(rondi_audit_payload(NEW), 'UTF8')), 'hex');
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_log_chain BEFORE INSERT ON audit_log
  FOR EACH ROW EXECUTE FUNCTION rondi_audit_chain();

-- فحص السلسلة: بيرجّع أول سطر مكسور (أو ولا حاجة لو كله سليم)
CREATE OR REPLACE FUNCTION rondi_audit_verify()
RETURNS TABLE(broken_id bigint, reason text)
LANGUAGE sql STABLE AS $$
  WITH ordered AS (
    SELECT a.id, a.hash, a.prev_hash,
           encode(sha256(convert_to(rondi_audit_payload(a), 'UTF8')), 'hex') AS calc,
           lag(a.hash) OVER (ORDER BY a.id) AS expected_prev
    FROM audit_log a
  )
  SELECT id, CASE WHEN hash <> calc THEN 'content_changed' ELSE 'chain_broken' END
  FROM ordered
  WHERE hash <> calc OR prev_hash <> coalesce(expected_prev, repeat('0', 64))
  ORDER BY id
  LIMIT 1
$$;

-- أكواد فريدة من غير فرق بين الحروف الكبيرة والصغيرة
CREATE UNIQUE INDEX users_username_lower_key ON users (lower(username));

DO $$
DECLARE
  r RECORD;
  col_exists BOOLEAN;
  mode TEXT := 'open'; -- change to 'secure' to restore authentication
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, cmd
    FROM pg_policies
    WHERE (qual ILIKE '%auth.uid()%' OR qual ILIKE '%true%')
  LOOP
    -- check if table has a user_id column
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = r.schemaname
        AND table_name = r.tablename
        AND column_name = 'user_id'
    ) INTO col_exists;

    IF mode = 'open' THEN
      -- open everything
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I USING (true);',
        r.policyname, r.schemaname, r.tablename
      );
      RAISE NOTICE '🔓 Opened % (now USING true) on %.%', r.policyname, r.schemaname, r.tablename;

    ELSIF mode = 'secure' THEN
      -- revert only if the table has user_id
      IF col_exists THEN
        EXECUTE format(
          'ALTER POLICY %I ON %I.%I USING (auth.uid() = user_id);',
          r.policyname, r.schemaname, r.tablename
        );
        RAISE NOTICE '🔒 Secured % (auth.uid() check restored) on %.%', r.policyname, r.schemaname, r.tablename;
      ELSE
        RAISE NOTICE '⚠️ Skipped %.% (no user_id column)', r.schemaname, r.tablename;
      END IF;
    END IF;
  END LOOP;
END $$;
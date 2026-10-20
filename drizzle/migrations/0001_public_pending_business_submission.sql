CREATE OR REPLACE FUNCTION public.submit_pending_business(submission_name text, submission_category text, submission_room text, submission_phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE saved_id uuid;
BEGIN
 IF submission_name IS NULL OR char_length(btrim(submission_name)) NOT BETWEEN 2 AND 120
 OR submission_category IS NULL OR char_length(btrim(submission_category)) NOT BETWEEN 2 AND 80
 OR submission_room IS NULL OR char_length(btrim(submission_room)) NOT BETWEEN 1 AND 120
 OR submission_phone IS NULL OR submission_phone !~ '^[1-9][0-9]{9,14}$' THEN
 RAISE EXCEPTION 'Invalid business details' USING ERRCODE = '22023';
 END IF;
 INSERT INTO public.business_submissions(name, category, room, phone, status)
 VALUES(btrim(submission_name), btrim(submission_category), btrim(submission_room), submission_phone, 'pending')
 RETURNING id INTO saved_id;
 RETURN saved_id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_pending_business(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_pending_business(text,text,text,text) TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.submit_pending_business(text,text,text,text) IS 'Public validated pending-only submission; no catalog writes, review permissions or inbox reads.';
CREATE TABLE public.business_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
 category text NOT NULL CHECK (char_length(category) BETWEEN 2 AND 80),
 room text NOT NULL CHECK (char_length(room) BETWEEN 1 AND 120),
 phone text NOT NULL CHECK (phone ~ '^[1-9][0-9]{9,14}$'),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,
 reviewed_by uuid,
 business_id uuid
);
GRANT SELECT ON public.business_submissions TO authenticated;
GRANT ALL ON public.business_submissions TO service_role;
ALTER TABLE public.business_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read submissions" ON public.business_submissions FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX business_submissions_pending_idx ON public.business_submissions (created_at) WHERE status = 'pending';
CREATE OR REPLACE FUNCTION public.review_business_submission(submission_id uuid, decision text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.business_submissions; listing_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'Admin access required'; END IF;
 IF decision NOT IN ('approved','rejected') OR decision IS NULL THEN RAISE EXCEPTION 'Invalid decision'; END IF;
 SELECT * INTO s FROM public.business_submissions WHERE id = submission_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
 IF s.status <> 'pending' THEN
   IF s.status = decision THEN RETURN s.business_id; END IF;
   RAISE EXCEPTION 'Submission already reviewed';
 END IF;
 IF decision = 'approved' THEN
   INSERT INTO public.businesses(name,category,room,contact_type,contact,added_by)
   VALUES(s.name,s.category,s.room,'phone',s.phone,auth.uid()) RETURNING id INTO listing_id;
 END IF;
 UPDATE public.business_submissions SET status = decision, reviewed_at = now(), reviewed_by = auth.uid(), business_id = listing_id WHERE id = submission_id;
 RETURN listing_id;
END $$;
REVOKE ALL ON FUNCTION public.review_business_submission(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_business_submission(uuid,text) TO authenticated;

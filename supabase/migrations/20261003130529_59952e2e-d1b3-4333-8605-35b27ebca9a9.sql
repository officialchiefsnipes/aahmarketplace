CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
ALTER POLICY "Admins can add businesses" ON public.businesses WITH CHECK (private.has_role(auth.uid(), 'admin') AND added_by = auth.uid());
ALTER POLICY "Admins can update businesses" ON public.businesses USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "Admins can remove businesses" ON public.businesses USING (private.has_role(auth.uid(), 'admin'));
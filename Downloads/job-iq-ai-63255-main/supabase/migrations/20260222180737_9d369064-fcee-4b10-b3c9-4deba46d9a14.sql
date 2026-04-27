
DROP TRIGGER IF EXISTS audit_expert_profiles ON public.expert_profiles;
DROP TRIGGER IF EXISTS audit_certifications ON public.certifications;
DROP TRIGGER IF EXISTS audit_placements ON public.placements;
DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;

CREATE TRIGGER audit_expert_profiles
AFTER INSERT OR UPDATE OR DELETE ON public.expert_profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_certifications
AFTER INSERT OR UPDATE OR DELETE ON public.certifications
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_placements
AFTER INSERT OR UPDATE OR DELETE ON public.placements
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

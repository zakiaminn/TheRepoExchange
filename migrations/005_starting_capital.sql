-- new accounts open with $100,000. sets the cash_balance default and the signup trigger
-- (handle_new_user) to seed 100000.00. existing accounts keep their balance.
-- safe to run more than once.

ALTER TABLE public.users ALTER COLUMN cash_balance SET DEFAULT 100000.00;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.users (id, cash_balance)
  VALUES (new.id, 100000.00);
  RETURN new;
END;
$function$;

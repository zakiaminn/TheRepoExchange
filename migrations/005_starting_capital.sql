-- Starting capital: every new account opens with $100,000, as the site, FAQ and
-- landing page all state. The signup trigger and the column default were both
-- still seeding 10,000.00, so new accounts opened with a tenth of what was promised.
--
-- Only affects accounts created after this runs. Existing accounts keep their
-- balance (they have traded against it, so topping them up is a separate call).
--
-- Safe to run more than once.

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

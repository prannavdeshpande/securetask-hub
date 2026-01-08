-- Update the handle_new_user function to NOT automatically insert a role
-- The role will be inserted by the application based on user selection
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  -- DO NOT insert a default role here anymore
  -- The role will be inserted by the application
  
  RETURN NEW;
END;
$function$;
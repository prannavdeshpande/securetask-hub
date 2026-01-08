-- Enable realtime for profiles table so deleted users get logged out
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
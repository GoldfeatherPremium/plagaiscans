DELETE FROM public.push_subscriptions
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM public.push_subscriptions
  ORDER BY user_id, created_at DESC
);
alter type public.task_status rename value 'todo' to 'start';
alter type public.task_status rename value 'in_progress' to 'hold_pause';
alter type public.task_status rename value 'done' to 'finish';

select
  to_char(created_at at time zone 'Africa/Johannesburg', 'DD.MM.YYYY') as "Date",
  to_char(created_at at time zone 'Africa/Johannesburg', 'HH24:MI:SS') as "Time",
  teacher_name as "Staff Member",
  action as "Action",
  signature_data_url as "Signature"
from public.attendance_records
order by created_at desc;

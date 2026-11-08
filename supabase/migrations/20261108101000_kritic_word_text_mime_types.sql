-- Extend the private coursework bucket; retain its 10 MB size cap and RLS.
UPDATE storage.buckets SET
 allowed_mime_types=ARRAY[
 'application/pdf','image/png','image/jpeg','image/webp',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/msword','text/plain','application/octet-stream'
 ]::text[],
 file_size_limit=10485760,
 public=false
WHERE id='kritic_attachments';

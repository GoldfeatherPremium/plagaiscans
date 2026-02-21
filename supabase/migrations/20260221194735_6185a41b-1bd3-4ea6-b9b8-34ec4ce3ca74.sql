
-- Create a BEFORE DELETE trigger to log documents before they are deleted
CREATE OR REPLACE FUNCTION public.log_deleted_document()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.deleted_documents_log (
    original_document_id,
    user_id,
    file_name,
    file_path,
    scan_type,
    similarity_percentage,
    ai_percentage,
    similarity_report_path,
    ai_report_path,
    remarks,
    uploaded_at,
    completed_at,
    deleted_by_type,
    customer_email,
    customer_name,
    magic_link_id
  )
  SELECT
    OLD.id,
    OLD.user_id,
    OLD.file_name,
    COALESCE(OLD.file_path, ''),
    COALESCE(OLD.scan_type, 'full'),
    OLD.similarity_percentage,
    OLD.ai_percentage,
    OLD.similarity_report_path,
    OLD.ai_report_path,
    OLD.remarks,
    OLD.uploaded_at,
    OLD.completed_at,
    CASE 
      WHEN OLD.deleted_by_user = true THEN 'customer'
      WHEN OLD.user_id IS NULL AND OLD.magic_link_id IS NOT NULL THEN 'guest'
      ELSE 'system'
    END,
    p.email,
    p.full_name,
    OLD.magic_link_id
  FROM (SELECT 1) AS dummy
  LEFT JOIN public.profiles p ON p.id = OLD.user_id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER log_document_before_delete
  BEFORE DELETE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.log_deleted_document();

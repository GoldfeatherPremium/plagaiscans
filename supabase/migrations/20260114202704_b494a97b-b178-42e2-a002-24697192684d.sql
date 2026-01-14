-- Add column to control which announcements show on guest pages
ALTER TABLE announcements 
ADD COLUMN show_on_guest_pages BOOLEAN DEFAULT false;
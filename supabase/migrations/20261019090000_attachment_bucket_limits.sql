-- Homework attachments go from the phone or browser straight to storage with
-- a signed link, so the server's checks (images to photos, documents to
-- assignment-files, 10 MB, as ASSIGNMENT_UPLOAD_MAX_BYTES) only cover what
-- the client reports. Storage now holds the bytes to the same rules, as it
-- does for exam-papers. Both clients send the type /api/school/upload/sign
-- resolved (lib/attachments); the aliases cover older senders.
UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'image/jpg', 'image/pjpeg'
    ]
WHERE id = 'photos';

UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain', 'text/plain;charset=utf-8', 'text/plain;charset=UTF-8'
    ]
WHERE id = 'assignment-files';

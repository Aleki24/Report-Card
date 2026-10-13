-- The exam-papers bucket accepted any file type and size through signed
-- uploads, which the browser sends straight to storage. Limit it to what the
-- app accepts (PDF and Word, 15 MB, as MAX_PAPER_BYTES); the server also
-- checks each file's first bytes before saving or serving it.
UPDATE storage.buckets
SET file_size_limit = 15728640,
    allowed_mime_types = ARRAY[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
WHERE id = 'exam-papers';

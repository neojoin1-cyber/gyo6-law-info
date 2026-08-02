ALTER TABLE consultations ADD COLUMN is_popup INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS board_attachments (
  id TEXT PRIMARY KEY,
  post_id INTEGER NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  author_uid TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (post_id) REFERENCES consultations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_board_attachments_post_created
  ON board_attachments (post_id, created_at);

UPDATE consultations
SET is_popup = 1,
    body = REPLACE(
      body,
      '[[image:assets/news/education-experts-invitation.png|교육전문가 검수·자문 인력풀 초대 안내]]' || char(10) || char(10),
      ''
    ),
    updated_at = '2026-08-02T15:00:00.000Z'
WHERE room = 'promotion'
  AND title = '교육의 다음 장을 함께 만들 전문가를 기다립니다';

INSERT INTO board_attachments (
  id, post_id, object_key, file_name, content_type, size_bytes, author_uid, created_at
)
SELECT
  'b7f3c0a2-4d65-4b1c-9e7f-2a8d6c4e9011',
  id,
  'boards/featured/b7f3c0a2-4d65-4b1c-9e7f-2a8d6c4e9011.png',
  '전문가 모집 안내.png',
  'image/png',
  1770854,
  'system:featured-news',
  '2026-08-02T15:00:00.000Z'
FROM consultations
WHERE room = 'promotion'
  AND title = '교육의 다음 장을 함께 만들 전문가를 기다립니다'
  AND NOT EXISTS (
    SELECT 1 FROM board_attachments
    WHERE id = 'b7f3c0a2-4d65-4b1c-9e7f-2a8d6c4e9011'
  );

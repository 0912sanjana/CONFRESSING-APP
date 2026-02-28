-- Wait a moment to ensure tables are ready
-- Usage: docker exec -i <db_container> psql -U kiit -d kiit_conference < seed_analytics.sql

-- Clear prior test analytics logic so we don't duplicate
DELETE FROM mom_documents;
DELETE FROM teacher_contribution_daily;

-- Assuming a teacher profile exists (test user ID: us_123 or whatever devUser uses, we'll insert a dummy meeting to link)
-- We'll just generate fresh dummy UUIDs for meetings if they don't overlap, or use generic ones.

INSERT INTO meetings (id, title, mode, host_user_id, status, planned_topics, created_at)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Data Structures Intro', 'online', 'usr_teacher_123', 'ended', 'Data Structures', NOW() - INTERVAL '5 days'),
  ('22222222-2222-2222-2222-222222222222', 'Advanced Algorithms', 'hybrid', 'usr_teacher_123', 'ended', 'Algorithms', NOW() - INTERVAL '4 days'),
  ('33333333-3333-3333-3333-333333333333', 'OS Memory Management', 'offline', 'usr_teacher_123', 'ended', 'Operating Systems', NOW() - INTERVAL '3 days'),
  ('44444444-4444-4444-4444-444444444444', 'Data Structures Trees', 'online', 'usr_teacher_123', 'ended', 'Data Structures', NOW() - INTERVAL '2 days'),
  ('55555555-5555-5555-5555-555555555555', 'Network Protocols', 'online', 'usr_teacher_123', 'ended', 'Networks', NOW() - INTERVAL '1 days')
ON CONFLICT (id) DO NOTHING;

-- Seed Analytics data associated to the meetings
INSERT INTO teacher_contribution_daily (id, teacher_id, meeting_id, record_date, classes_taken, attendance_avg, regularity_score, punctuality_score)
VALUES
  (gen_random_uuid(), 'usr_teacher_123', '11111111-1111-1111-1111-111111111111', CURRENT_DATE - 5, 1, 85.0, 75.0, 90.0),
  (gen_random_uuid(), 'usr_teacher_123', '22222222-2222-2222-2222-222222222222', CURRENT_DATE - 4, 1, 92.0, 88.0, 95.0),
  (gen_random_uuid(), 'usr_teacher_123', '33333333-3333-3333-3333-333333333333', CURRENT_DATE - 3, 1, 78.0, 65.0, 85.0),
  (gen_random_uuid(), 'usr_teacher_123', '44444444-4444-4444-4444-444444444444', CURRENT_DATE - 2, 1, 88.0, 82.0, 92.0),
  (gen_random_uuid(), 'usr_teacher_123', '55555555-5555-5555-5555-555555555555', CURRENT_DATE - 1, 1, 95.0, 91.0, 98.0);

-- Seed MOM Documents for AI testing on the most recent meeting
INSERT INTO mom_documents (id, meeting_id, summary, key_points, action_items, created_at)
VALUES
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'Discussed TCP/IP and UDP packet drop logic.', ARRAY['TCP Handshake', 'UDP Checksums'], ARRAY['Review routing table chapter', 'Prep for quiz'], NOW());

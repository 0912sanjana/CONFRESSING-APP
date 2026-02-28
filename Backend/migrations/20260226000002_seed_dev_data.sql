INSERT INTO users (id, email, name, role) VALUES
('00000000-0000-0000-0000-000000000001', 'teacher@test.com', 'Test Teacher', 'teacher'),
('00000000-0000-0000-0000-000000000002', 'student@test.com', 'Test Student', 'student')
ON CONFLICT (email) DO NOTHING;

INSERT INTO courses (id, name, description, teacher_id) VALUES
('CS-201', 'Data Structures', 'Core CS course focusing on trees, graphs, and algorithms.', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO enrollments (course_id, student_id) VALUES
('CS-201', '00000000-0000-0000-0000-000000000002')
ON CONFLICT (course_id, student_id) DO NOTHING;

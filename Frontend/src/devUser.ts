import { User } from './app/types';

// Export a single dev user to simulate LMS login
// You can change this object to test as different roles (teacher/student)
export const devUser: User = {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Test Student",
    email: "student@test.com",
    role: "student"
};

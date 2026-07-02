CREATE TABLE IF NOT EXISTS users (
    user_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          VARCHAR(20) NOT NULL DEFAULT 'customer'
                    CHECK (role IN ('customer', 'analyst', 'admin')),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

ALTER TABLE analysts
    ADD COLUMN IF NOT EXISTS user_id         BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS employee_number VARCHAR(20) UNIQUE,
    ADD COLUMN IF NOT EXISTS designation     VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_analysts_user_id ON analysts (user_id);

INSERT INTO users (email, password_hash, role, is_active) VALUES
('analyst1@rupya.ai', '$2b$12$EqnYf55ypRaxfAAkHbZNe.ZTBIrjM37LuAR9RiCJ17Z6wfQFBjICu', 'analyst', TRUE),
('analyst2@rupya.ai', '$2b$12$EqnYf55ypRaxfAAkHbZNe.ZTBIrjM37LuAR9RiCJ17Z6wfQFBjICu', 'analyst', TRUE),
('navin@rupya.ai', '$2b$12$EqnYf55ypRaxfAAkHbZNe.ZTBIrjM37LuAR9RiCJ17Z6wfQFBjICu', 'customer', TRUE);

INSERT INTO analysts (user_id, employee_number, first_name, last_name, email, department, role, designation, is_active)
SELECT u.user_id, 'EMP-2024-001', 'Priya', 'Sharma', 'analyst1@rupya.ai', 'Retail Credit', 'Analyst', 'Senior Credit Analyst', TRUE
FROM users u WHERE u.email = 'analyst1@rupya.ai'
ON CONFLICT (email) DO NOTHING;

INSERT INTO analysts (user_id, employee_number, first_name, last_name, email, department, role, designation, is_active)
SELECT u.user_id, 'EMP-2024-002', 'Arjun', 'Mehta', 'analyst2@rupya.ai', 'SME Credit', 'Analyst', 'Credit Analyst', TRUE
FROM users u WHERE u.email = 'analyst2@rupya.ai'
ON CONFLICT (email) DO NOTHING;

INSERT INTO applicants (first_name, last_name, email, phone, dob, address_line1, city, pincode, monthly_income, is_active)
SELECT 'Navin', 'Vishwa', 'navin@rupya.ai', '9876543210', '2000-01-01', 'To be updated', 'To be updated', '000000', 0, TRUE
WHERE NOT EXISTS (SELECT 1 FROM applicants WHERE email = 'navin@rupya.ai');
